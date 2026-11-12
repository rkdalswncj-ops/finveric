import { useState } from "react";
import {
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  SIGNAL_THRESHOLDS,
  type SignalKind,
} from "../../../../../packages/core/src/index.ts";
import type {
  CustomerDto,
  ProductEntryDto,
} from "../../../../../packages/core/src/api.ts";
import type { LoadState } from "../../../../../packages/ui/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import { Badge, Heading } from "../../../../../packages/ui/src/components.tsx";
import { short } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import {
  productName,
  saleProduct,
  type Sale,
} from "../../../../../packages/ui/src/sales.ts";
import { saleSignals } from "../signals.ts";

const s = { ...ui, ...client, ...local };

/** 원장 기록(진단 회차, 청약·확정)으로 계산한 위험 신호 5종. 감독기관 화면과 같은 계산이다. */
export function Signals({
  load,
  sales,
  products,
  customer,
  open,
}: {
  load: LoadState;
  sales: Sale[];
  products: ProductEntryDto[];
  customer?: CustomerDto;
  open: (id: string) => void;
}) {
  const [kind, setKind] = useState<SignalKind | "">("");
  const signals = saleSignals(customer, sales);
  const shown = signals.filter((signal) => !kind || signal.kind === kind);
  /** 신호에 판매 ID가 없으면(재진단 반복, 짧은 간격 재진단) 그 고객의 가장 최근 판매 건을 연다. */
  const saleFor = (customerRef: string, saleId?: string) =>
    sales.find((sale) => sale.id === saleId) ??
    [...sales]
      .filter(
        (sale) => sale.customerRef.toLowerCase() === customerRef.toLowerCase(),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return (
    <>
      <Heading
        title="위험 신호를 확인하세요"
        description={`진단 ${SIGNAL_THRESHOLDS.repeatAttempts}회 이상, 투자성향이 오른 회차로 청약, 부적합 가입 확정, 설명 확인 ${SIGNAL_THRESHOLDS.shortExplanationSeconds}초 미만, ${SIGNAL_THRESHOLDS.shortIntervalSeconds / 60}분 안의 재진단을 신호로 표시합니다. 근거는 원장 기록입니다.`}
      />
      <div className={s.chips} role="group" aria-label="위험 신호 종류 필터">
        {(["", ...SIGNAL_KINDS] as const).map((value) => (
          <button
            key={value || "all"}
            aria-pressed={kind === value}
            className={kind === value ? s.chipActive : ""}
            onClick={() => setKind(value)}
          >
            {value ? SIGNAL_LABELS[value] : "전체"}{" "}
            {signals.filter((signal) => !value || signal.kind === value).length}
          </button>
        ))}
      </div>
      <div className={`${s.panel} ${s.salesTable}`}>
        <p className={s.tableNote}>
          위험 신호 목록 · 판매 건을 열어 회차 이력을 확인합니다.
        </p>
        <div className={s.tableWrap}>
          <table>
            <caption className={s.srOnly}>위험 신호 목록</caption>
            <thead>
              <tr>
                <th scope="col">신호</th>
                <th scope="col">고객 가명 ID</th>
                <th scope="col">판매 ID</th>
                <th scope="col">상품</th>
                <th scope="col">회차</th>
                <th scope="col">근거</th>
                <th scope="col">보기</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((signal, index) => {
                const sale = saleFor(signal.customerRef, signal.saleId);
                return (
                  <tr
                    key={`${signal.kind}:${signal.saleId ?? signal.customerRef}:${index}`}
                  >
                    <td>
                      <Badge tone="warning">{SIGNAL_LABELS[signal.kind]}</Badge>
                    </td>
                    <td>
                      <code title={signal.customerRef}>
                        {short(signal.customerRef)}
                      </code>
                    </td>
                    <td>
                      {signal.saleId ? (
                        <code title={signal.saleId}>
                          {short(signal.saleId)}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={s.wrapCell}>
                      {signal.saleId
                        ? productName(saleProduct(products, sale)?.document)
                        : "—"}
                    </td>
                    <td>{signal.attempt ? `${signal.attempt}회차` : "—"}</td>
                    <td>{signal.detail}</td>
                    <td>
                      <Button
                        variant="ghost"
                        disabled={!sale}
                        onClick={() => sale && open(sale.id)}
                        aria-label={`${SIGNAL_LABELS[signal.kind]} 판매 건 보기`}
                      >
                        판매·검토
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 0 &&
          (load === "ready" && kind ? (
            <div className={s.empty}>
              <p>{SIGNAL_LABELS[kind]} 신호가 없습니다.</p>
              <Button variant="outline" onClick={() => setKind("")}>
                전체 보기
              </Button>
            </div>
          ) : (
            <p className={s.empty}>
              {load === "ready"
                ? "표시할 위험 신호가 없습니다."
                : load === "failed"
                  ? "위험 신호를 계산할 자료를 불러오지 못했습니다. 연결을 확인하고 화면을 새로 고치세요."
                  : "위험 신호를 계산할 자료를 불러오고 있습니다."}
            </p>
          ))}
      </div>
    </>
  );
}
