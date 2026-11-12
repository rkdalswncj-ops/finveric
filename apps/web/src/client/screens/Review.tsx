import { useState } from "react";
import { Link } from "react-router";
import { LEDGER_ERRORS } from "../../../../../packages/core/src/index.ts";
import type {
  CustomerDto,
  ProductEntryDto,
  SaleAction,
  TamperRequest,
  TamperResponse,
} from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { api } from "../../../../../packages/ui/src/api.ts";
import { dateTime, short, won } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import type { Run } from "../App.tsx";
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

/** 판매 건 목록, 선택한 건의 회차 이력·필수 확인·타임라인, 관리자 승인, 사후 변경 시도. */
export function Review({
  loaded,
  sales,
  products,
  customer,
  selected,
  select,
  busy,
  run,
  action,
}: {
  loaded: boolean;
  sales: Sale[];
  products: ProductEntryDto[];
  customer?: CustomerDto;
  selected: string;
  select: (id: string) => void;
  busy: boolean;
  run: Run;
  action: (id: string, name: SaleAction, label: string) => unknown;
}) {
  const now = nowSeconds();
  const [filter, setFilter] = useState<StatusKey | "">("");
  const [tamperAttempt, setTamperAttempt] = useState<number>();
  const [tamper, setTamper] = useState<TamperResponse>();
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
  const attempts = customer?.diagnoses ?? [];
  const tamperTarget =
    tamperAttempt ?? Math.max(1, (attempts.at(-1)?.attempt ?? 1) - 1);
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
  const doTamper = async () => {
    if (!customer) return;
    setTamper(undefined);
    const result = await run("기록한 회차의 변경을 시도하고 있습니다", () =>
      api<TamperResponse>("/demo/tamper", {
        customerNo: customer.number,
        attempt: tamperTarget,
      } satisfies TamperRequest),
    );
    if (result) setTamper(result);
  };
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
      <div className={`${s.panel} ${s.tableWrap} ${s.salesTable}`}>
        <table>
          <caption>
            판매 건 목록 · 행을 골라 회차 이력과 처리 근거를 봅니다.
          </caption>
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
                    {abandoned ? "—" : yesNo(record.suitable, "적합", "부적합")}
                  </td>
                  <td>
                    {abandoned ? "—" : yesNo(record.protectedSale, "대상", "—")}
                  </td>
                  <td>
                    {awaitingApproval(record) ? (
                      <Badge tone="warning">승인 필요</Badge>
                    ) : record.chain?.approved ||
                      (record.status === "draft" && record.approvalRequired) ? (
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
                  "모의 결제",
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
                이 고객의 회차는 판매사 고객 번호로만 조회합니다. 시연 고객의
                판매 건을 골라 주세요.
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
              {sale.status === "confirmed" && (
                <Button
                  variant="outline"
                  disabled={busy || sale.settled}
                  onClick={() =>
                    action(sale.id, "settle", "모의 결제를 기록하고 있습니다")
                  }
                >
                  {sale.settled
                    ? "모의 결제 기록 완료"
                    : "모의 결제 기록(인프라 키)"}
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/chain">처리 근거 보기</Link>
              </Button>
            </section>
            <section className={`${s.panel} ${s.pad}`}>
              <h2>사후 변경 시도</h2>
              <p>
                판매사가 이미 기록한 회차를 더 높은 투자성향으로 다시 쓰려는
                시연입니다. 판매사 키로 원장 호출을 시뮬레이션만 하고 거래는
                보내지 않습니다.
              </p>
              {attempts.length ? (
                <>
                  <label className={s.field}>
                    바꿀 회차
                    <select
                      value={tamperTarget}
                      onChange={(e) => {
                        setTamperAttempt(Number(e.target.value));
                        setTamper(undefined);
                      }}
                    >
                      {attempts.map((diagnosis) => (
                        <option
                          key={diagnosis.attempt}
                          value={diagnosis.attempt}
                        >
                          {diagnosis.attempt}회차 ·{" "}
                          {profileName(diagnosis.profile)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void doTamper()}
                  >
                    {tamperTarget}회차 결과 변경 시도
                  </Button>
                </>
              ) : (
                <p className={s.small}>기록한 진단 회차가 없습니다.</p>
              )}
              {tamper && (
                <Notice tone={tamper.rejected ? "warning" : "danger"}>
                  <strong>
                    {tamper.rejected
                      ? `원장이 ${tamper.attempt}회차 변경을 거절했습니다.`
                      : "원장이 변경 요청을 거절하지 않았습니다."}
                  </strong>
                  <br />
                  {tamper.error
                    ? `${tamper.error} · ${LEDGER_ERRORS[tamper.error]}`
                    : tamper.reason}
                </Notice>
              )}
            </section>
          </aside>
        </div>
      ) : (
        loaded && (
          <Empty
            title="아직 판매 건이 없습니다"
            text="판매 채널 시연에서 고객이 상품을 고르면 판매 건이 생깁니다."
          />
        )
      )}
    </>
  );
}
