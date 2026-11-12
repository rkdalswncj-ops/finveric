import { useState } from "react";
import { Link } from "react-router";
import type {
  CustomerDto,
  ProductEntryDto,
  SaleAction,
} from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { dateTime, short, won } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import { DiagnosisTable, Empty, StatusBadge } from "../components.tsx";
import {
  awaitingApproval,
  nowSeconds,
  productName,
  profileName,
  saleProduct,
  STATUS_KEYS,
  STATUS_LABELS,
  statusKey,
  type Sale,
  type StatusKey,
} from "../sales.ts";
import { traceLabel, traceStatus } from "../traces.ts";

const s = { ...ui, ...client, ...local };

const yesNo = (value?: boolean, yes = "예", no = "아니요") =>
  value === undefined ? "—" : value ? yes : no;

function approvalText(sale: Sale) {
  if (sale.status === "abandoned") return "—";
  const attempt = sale.chain?.attempt ?? sale.latestAttempt;
  if (!sale.approvalRequired) return `대상 아님 · ${attempt || 0}회차`;
  if (sale.chain) return sale.chain.approved ? `승인 · ${attempt}회차` : "없음";
  return sale.approvedAttempt === sale.latestAttempt
    ? `승인 · ${attempt}회차`
    : sale.approvedAttempt
      ? `다시 필요 · ${sale.approvedAttempt}회차 승인 뒤 ${attempt}회차 진단`
      : `필요 · ${attempt}회차`;
}

/** 판매 건 목록, 선택한 건의 회차 이력·필수 확인·타임라인, 관리자 승인. */
export function Review({
  loaded,
  sales,
  products,
  customer,
  selected,
  select,
  busy,
  action,
}: {
  loaded: boolean;
  sales: Sale[];
  products: ProductEntryDto[];
  customer?: CustomerDto;
  selected: string;
  select: (id: string) => void;
  busy: boolean;
  action: (id: string, name: SaleAction, label: string) => unknown;
}) {
  const now = nowSeconds();
  const [filter, setFilter] = useState<StatusKey | "">("");
  const ordered = [...sales].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const count = (key: StatusKey | "") =>
    ordered.filter((sale) => !key || statusKey(sale, now) === key).length;
  const shown = ordered.filter(
    (sale) => !filter || statusKey(sale, now) === filter,
  );
  const sale = sales.find((entry) => entry.id === selected) ?? shown[0];
  const product = saleProduct(products, sale);
  const knownCustomer =
    !!sale &&
    !!customer &&
    customer.ref.toLowerCase() === sale.customerRef.toLowerCase();
  const diagnoses = knownCustomer ? customer.diagnoses : [];
  const usedAttempt = sale?.chain?.attempt;
  const usedDiagnosis = diagnoses.find(
    (diagnosis) => diagnosis.attempt === (usedAttempt ?? sale?.latestAttempt),
  );
  const timeline = sale
    ? [
        ...diagnoses.map((diagnosis) => ({
          key: `d${diagnosis.attempt}`,
          at: diagnosis.at * 1000,
          label: `진단 ${diagnosis.attempt}회차 기록 · ${profileName(diagnosis.profile)}`,
          status: ["완료", "success"] as [string, string],
        })),
        ...sale.traces
          .filter((trace) => trace.action !== "recordDiagnosis")
          .map((trace) => ({
            key: trace.id,
            at: Date.parse(trace.at),
            label: traceLabel(trace),
            status: traceStatus(trace),
          })),
      ].sort((a, b) => a.at - b.at)
    : [];
  return (
    <>
      <Heading
        title="판매 건과 진단 회차를 검토하세요"
        description="고객 가명 ID별 진단 회차와 판매 건의 필수 확인을 봅니다. 3회차 이상 진단한 고객의 청약은 회차 이력을 보고 관리자가 승인합니다."
      />
      <div className={s.chips} aria-label="판매 건 상태 필터">
        {(["", ...STATUS_KEYS] as const).map((key) => (
          <button
            key={key || "all"}
            aria-pressed={filter === key}
            className={filter === key ? s.chipActive : ""}
            onClick={() => setFilter(key)}
          >
            {key ? STATUS_LABELS[key] : "전체"} {count(key)}
          </button>
        ))}
      </div>
      <div className={`${s.panel} ${s.salesTable}`}>
        <p className={s.tableNote}>
          판매 건 목록 · 행을 골라 회차 이력과 처리 근거를 봅니다.
        </p>
        <div className={s.tableWrap}>
          <table>
            <caption className={s.srOnly}>판매 건 목록</caption>
            <thead>
              <tr>
                <th scope="col">판매 ID</th>
                <th scope="col">상품</th>
                <th scope="col">상태</th>
                <th scope="col">회차</th>
                <th scope="col">적합성</th>
                <th scope="col">녹취·숙려</th>
                <th scope="col">관리자 승인</th>
                <th scope="col">신청 시각</th>
                <th scope="col">선택</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((record) => {
                const attempt = record.chain?.attempt ?? record.latestAttempt;
                const abandoned = record.status === "abandoned";
                return (
                  <tr
                    key={record.id}
                    className={record.id === sale?.id ? s.selectedRow : ""}
                  >
                    <td>
                      <code title={record.id}>{short(record.id)}</code>
                    </td>
                    <td className={s.wrapCell}>
                      {productName(saleProduct(products, record)?.document)} v
                      {record.productVersion}
                    </td>
                    <td>
                      <StatusBadge sale={record} now={now} />
                    </td>
                    <td>
                      {abandoned
                        ? "—"
                        : attempt
                          ? `${attempt}회차${attempt > 1 ? " · 재진단" : ""}`
                          : "진단 전"}
                    </td>
                    <td>
                      {abandoned
                        ? "—"
                        : yesNo(record.suitable, "적합", "부적합")}
                    </td>
                    <td>
                      {abandoned
                        ? "—"
                        : yesNo(record.protectedSale, "대상", "—")}
                    </td>
                    <td>
                      {awaitingApproval(record) ? (
                        <Badge tone="warning">승인 필요</Badge>
                      ) : record.chain?.approved ||
                        (record.status === "draft" &&
                          record.approvalRequired) ? (
                        "승인"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{dateTime(record.createdAt)}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => select(record.id)}
                        aria-label={`${short(record.id)} 판매 건 보기`}
                      >
                        보기
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <p className={s.empty}>
            {loaded
              ? "이 상태의 판매 건이 없습니다."
              : "판매 건을 불러오고 있습니다."}
          </p>
        )}
      </div>
      {sale ? (
        <div className={s.detailGrid}>
          <section className={`${s.panel} ${s.pad}`}>
            <div className={s.row}>
              <h2>
                {productName(product?.document)} v{sale.productVersion}
              </h2>
              <StatusBadge sale={sale} now={now} />
            </div>
            <Facts
              rows={[
                ["판매 ID", <code>{sale.id}</code>],
                ["고객 가명 ID", <code>{sale.customerRef}</code>],
                ["청약 금액", won(sale.amount)],
                [
                  sale.chain ? "청약 회차" : "최신 회차",
                  `${usedAttempt ?? sale.latestAttempt}회차 · ${profileName(usedDiagnosis?.profile)}`,
                ],
                [
                  "적합성",
                  sale.suitable === undefined
                    ? "진단 전"
                    : sale.suitable
                      ? "적합"
                      : sale.chain
                        ? `부적합 · 추가 위험 확인 ${sale.chain.higherRiskConfirmed ? "기록" : "없음"}`
                        : "부적합 · 추가 위험 확인 필요",
                ],
                [
                  "녹취·숙려 대상",
                  sale.protectedSale === undefined
                    ? "—"
                    : sale.protectedSale
                      ? sale.chain
                        ? `대상 · 녹취 지문 ${/^0x0+$/.test(sale.chain.recordingHash) ? "없음" : "기록"}`
                        : "대상"
                      : "대상 아님",
                ],
                [
                  "숙려 종료",
                  sale.coolingEndsAt ? dateTime(sale.coolingEndsAt) : "—",
                ],
                [
                  "설명 확인 시간",
                  sale.chain ? `${sale.chain.explanationSeconds}초` : "청약 전",
                ],
                ["관리자 승인", approvalText(sale)],
                [
                  "결제 기록",
                  sale.settled
                    ? "기록"
                    : sale.status === "confirmed"
                      ? "대기"
                      : "—",
                ],
              ]}
            />
            {awaitingApproval(sale) && (
              <Notice tone="warning">
                {sale.latestAttempt}회차 진단한 고객입니다. 회차 이력과 위험
                신호를 확인한 뒤 승인하세요. 승인은 이 판매 ID와 최신 회차에
                묶입니다.
              </Notice>
            )}
            <h3 className={s.subTitle}>진단 회차</h3>
            {knownCustomer ? (
              <DiagnosisTable diagnoses={diagnoses} used={usedAttempt} />
            ) : (
              <p className={s.small}>
                이 판매 건의 고객 번호를 연결하지 않아 진단 회차를 표시하지
                않습니다.
              </p>
            )}
            <h3 className={s.subTitle}>타임라인</h3>
            <ol className={s.timeline}>
              {timeline.map((item) => (
                <li key={item.key}>
                  <time>{dateTime(new Date(item.at).toISOString())}</time>
                  <span className={s.timelineLabel}>{item.label}</span>
                  <Badge tone={item.status[1]}>{item.status[0]}</Badge>
                </li>
              ))}
            </ol>
          </section>
          <aside className={s.editorAside}>
            <section className={`${s.panel} ${s.pad}`}>
              <h2>관리자 승인</h2>
              <p>
                3회차 이상 진단한 고객의 청약은 소비자보호 담당이 승인 키로
                서명해야 원장이 받습니다.
              </p>
              <Facts rows={[["승인 상태", approvalText(sale)]]} />
              {awaitingApproval(sale) && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(
                      sale.id,
                      "approve",
                      "관리자 승인 서명을 만들고 있습니다",
                    )
                  }
                >
                  회차 이력을 확인하고 승인
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/chain">처리 근거 보기</Link>
              </Button>
            </section>
          </aside>
        </div>
      ) : (
        loaded && (
          <Empty
            title="아직 판매 건이 없습니다"
            text="판매 채널에서 고객이 상품을 고르면 판매 건이 생깁니다."
          />
        )
      )}
    </>
  );
}
