import { Link, useSearchParams } from "react-router";
import { UserRound } from "lucide-react";
import {
  computeSignals,
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  SIGNAL_THRESHOLDS,
  type Signal,
  type SignalKind,
} from "@finveric/core";
import type { LedgerSnapshot } from "@finveric/core/ledger";
import {
  Badge,
  Count,
  DetailColumn,
  DetailRow,
  FilterChip,
  Heading,
  TableScroll,
} from "../../shared/components.tsx";
import { dateTime } from "../../shared/format.ts";
import ui from "../../shared/ui.module.css";
import local from "../auditor.module.css";
import { LedgerGate, LedgerLine } from "../components.tsx";
import { customerPath, productName, salePath, short } from "../format.ts";
import type { Ledger } from "../useLedger.ts";

const s = { ...ui, ...local };

/** 신호 조건. 기준값은 core의 SIGNAL_THRESHOLDS(시연용 가정)다. */
const CONDITIONS: Record<SignalKind, string> = {
  repeat: `같은 고객 가명 ID의 진단이 ${SIGNAL_THRESHOLDS.repeatAttempts}회 이상`,
  rise: "직전 회차보다 투자성향이 오른 회차로 청약",
  unsuitable: "부적합 상태로 청약하고 확정",
  shortExplanation: `핵심 설명 카드 확인 시간이 ${SIGNAL_THRESHOLDS.shortExplanationSeconds}초 미만`,
  shortInterval: `이전 회차와 ${SIGNAL_THRESHOLDS.shortIntervalSeconds / 60}분 안에 다시 진단`,
};

const EVIDENCE: Record<SignalKind, string> = {
  repeat: "진단 기록",
  rise: "진단 기록, 청약 기록",
  unsuitable: "청약 기록, 확정 기록",
  shortExplanation: "청약 기록의 확인 시간",
  shortInterval: "진단 기록의 블록 시각",
};

/** 위험 신호. 판매사 콘솔과 같은 computeSignals를 원장 이벤트에만 적용한다. */
export function Signals({ ledger }: { ledger: Ledger }) {
  return (
    <div className={s.page}>
      <Heading
        title="위험 신호를 원장 이벤트로 확인하세요"
        description="판매사 콘솔과 같은 기준으로 원장의 진단·청약·확정 이벤트만 써서 계산합니다."
      />
      <LedgerLine ledger={ledger} />
      <LedgerGate ledger={ledger}>
        {(snapshot) => <SignalList snapshot={snapshot} />}
      </LedgerGate>
    </div>
  );
}

/** 신호가 난 시각. 판매 건 신호는 청약 시각, 진단 신호는 그 회차의 블록 시각이다. */
function signalTime(snapshot: LedgerSnapshot, signal: Signal) {
  if (signal.saleId)
    return snapshot.sales.find((sale) => sale.saleId === signal.saleId)
      ?.subscribed.at;
  return snapshot.diagnoses.find(
    (entry) =>
      entry.customerRef.toLowerCase() === signal.customerRef.toLowerCase() &&
      entry.attempt === signal.attempt,
  )?.at;
}

function SignalList({ snapshot }: { snapshot: LedgerSnapshot }) {
  const [params, setParams] = useSearchParams();
  const signals = computeSignals(snapshot);
  const kind = SIGNAL_KINDS.find((entry) => entry === params.get("kind"));
  const shown = kind
    ? signals.filter((signal) => signal.kind === kind)
    : signals;
  const count = (value: SignalKind) =>
    signals.filter((signal) => signal.kind === value).length;
  const filter = (value?: SignalKind) =>
    setParams(value ? { kind: value } : {}, { replace: true });
  return (
    <>
      <div
        className={`${s.chips} ${s.section}`}
        role="group"
        aria-label="신호 종류"
      >
        <FilterChip
          label="전체"
          count={signals.length}
          pressed={!kind}
          onClick={() => filter()}
        />
        {SIGNAL_KINDS.map((value) => (
          <FilterChip
            key={value}
            label={SIGNAL_LABELS[value]}
            count={count(value)}
            pressed={kind === value}
            onClick={() => filter(value)}
          />
        ))}
      </div>
      <section className={`${s.panel} ${s.section}`}>
        <p className={s.panelNote}>
          {kind
            ? `${SIGNAL_LABELS[kind]}: ${CONDITIONS[kind]}`
            : "신호 5종 전체. 판매 ID나 고객 가명 ID를 열면 분쟁 조회로 이동합니다."}
        </p>
        <TableScroll label="위험 신호 목록">
          <table>
            <caption className={s.srOnly}>위험 신호 목록</caption>
            <thead>
              <tr>
                <th scope="col">신호</th>
                <th scope="col">근거</th>
                <th scope="col">고객 가명 ID</th>
                <th scope="col">판매 건</th>
                <th scope="col">회차</th>
                <th scope="col">블록 시각</th>
                <DetailColumn label="신호 상세" />
              </tr>
            </thead>
            <tbody>
              {shown.map((signal, index) => {
                const sale = snapshot.sales.find(
                  (entry) => entry.saleId === signal.saleId,
                );
                const customer = short(signal.customerRef, 10, 8);
                const customerHistory = customerPath(signal.customerRef);
                return (
                  <DetailRow
                    key={`${signal.kind}:${signal.customerRef}:${signal.saleId ?? signal.attempt}:${index}`}
                    destination={
                      signal.saleId
                        ? {
                            to: salePath(signal.saleId),
                            label: `판매 건 대조 · ${SIGNAL_LABELS[signal.kind]} · ${short(signal.saleId)}`,
                          }
                        : {
                            to: customerHistory,
                            label: `고객 이력 · ${SIGNAL_LABELS[signal.kind]} · ${customer}`,
                          }
                    }
                  >
                    <td>
                      <Badge tone="warning">{SIGNAL_LABELS[signal.kind]}</Badge>
                    </td>
                    <td className={s.wrap}>{signal.detail}</td>
                    <td>
                      <code title={signal.customerRef}>{customer}</code>
                      {signal.saleId && (
                        <Link
                          to={customerHistory}
                          className={s.customerHistoryLink}
                          aria-label={`고객 이력 · ${customer}`}
                          title="고객 이력"
                        >
                          <UserRound size={16} aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                    <td>
                      {signal.saleId ? (
                        <>
                          <code title={signal.saleId}>
                            {short(signal.saleId)}
                          </code>
                          {sale &&
                            ` · ${productName(snapshot, sale.productId, sale.productVersion)}`}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{signal.attempt ? `${signal.attempt}회차` : "—"}</td>
                    <td>{dateTime(signalTime(snapshot, signal))}</td>
                  </DetailRow>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
        {shown.length === 0 && (
          <p className={s.panelNote}>
            {kind
              ? `${SIGNAL_LABELS[kind]} 신호가 없습니다.`
              : "원장 이벤트에서 계산한 위험 신호가 없습니다."}
          </p>
        )}
      </section>
      <TableScroll
        as="section"
        label="신호 조건"
        className={`${s.panel} ${s.section}`}
      >
        <table>
          <caption className={s.tableCaption}>신호 조건</caption>
          <thead>
            <tr>
              <th scope="col">신호</th>
              <th scope="col">조건</th>
              <th scope="col">근거 기록</th>
              <th scope="col" className={s.numeric}>
                건수
              </th>
            </tr>
          </thead>
          <tbody>
            {SIGNAL_KINDS.map((value) => (
              <tr key={value}>
                <td>{SIGNAL_LABELS[value]}</td>
                <td className={s.wrap}>{CONDITIONS[value]}</td>
                <td>{EVIDENCE[value]}</td>
                <Count value={count(value)} warn />
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </>
  );
}
