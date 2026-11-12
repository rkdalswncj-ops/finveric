import { useState } from "react";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import {
  saleProductName,
  short,
  status,
  type Sale,
} from "../../../../../packages/ui/src/sale.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./operations.module.css";
import {
  REPEAT_THRESHOLD,
  riskSignals,
  signalLabels,
  type SignalKind,
} from "../signals.ts";

const s = { ...ui, ...local };
const kinds = Object.keys(signalLabels) as SignalKind[];

/** 판매 기록에서 계산한 위험 신호. 근거 기록은 원장에 있다. */
export function Signals({
  sales,
  open,
}: {
  sales: Sale[];
  open: (id: string) => void;
}) {
  const [kind, setKind] = useState<SignalKind | "">("");
  const signals = riskSignals(sales);
  const shown = signals.filter((signal) => !kind || signal.kind === kind);
  return (
    <>
      <Heading
        title="위험 신호를 확인하세요"
        description={`같은 판매 건의 진단이 ${REPEAT_THRESHOLD}회 이상이거나, 투자성향이 오른 뒤 청약하거나, 부적합 상태로 가입하면 신호를 표시합니다.`}
      />
      <Notice>
        짧은 설명 확인과 짧은 간격 재진단 신호는 원장 v5부터 계산합니다. 지금
        원장은 설명 확인 시간과 진단 시각을 회차마다 기록하지 않습니다.
      </Notice>
      <div className={s.chips} aria-label="위험 신호 종류 필터">
        {[
          ["", "전체"] as const,
          ...kinds.map((k) => [k, signalLabels[k]] as const),
        ].map(([value, label]) => (
          <button
            key={label}
            aria-pressed={kind === value}
            className={kind === value ? s.chipActive : ""}
            onClick={() => setKind(value)}
          >
            {label}{" "}
            {signals.filter((signal) => !value || signal.kind === value).length}
          </button>
        ))}
      </div>
      <div className={`${s.panel} ${s.tableWrap} ${s.salesTable}`}>
        <table>
          <caption>
            위험 신호 목록 · 판매 건을 열어 회차 이력을 확인합니다.
          </caption>
          <thead>
            <tr>
              <th scope="col">신호</th>
              <th scope="col">판매 ID</th>
              <th scope="col">상품</th>
              <th scope="col">내용</th>
              <th scope="col">판매 절차</th>
              <th scope="col">보기</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((signal) => (
              <tr key={`${signal.kind}:${signal.sale.id}`}>
                <td>
                  <Badge tone="warning">{signalLabels[signal.kind]}</Badge>
                </td>
                <td>
                  <code title={signal.sale.id}>{short(signal.sale.id)}</code>
                </td>
                <td>{saleProductName(signal.sale)}</td>
                <td>{signal.detail}</td>
                <td>{status(signal.sale)}</td>
                <td>
                  <Button
                    variant="ghost"
                    onClick={() => open(signal.sale.id)}
                    aria-label={`${short(signal.sale.id)} 판매 건 보기`}
                  >
                    보기
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className={s.empty}>표시할 위험 신호가 없습니다.</p>
        )}
      </div>
    </>
  );
}
