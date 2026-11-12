import { Link, useSearchParams } from "react-router";
import {
  computeSignals,
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  SIGNAL_THRESHOLDS,
  type Signal,
  type SignalKind,
} from "../../../../../packages/core/src/index.ts";
import type { LedgerSnapshot } from "../../../../../packages/core/src/ledger.ts";
import { Badge, Heading } from "../../../../../packages/ui/src/components.tsx";
import { dateTime } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
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
        <button
          type="button"
          className={!kind ? s.chipActive : undefined}
          aria-pressed={!kind}
          onClick={() => filter()}
        >
          전체 {signals.length}
        </button>
        {SIGNAL_KINDS.map((value) => (
          <button
            key={value}
            type="button"
            className={kind === value ? s.chipActive : undefined}
            aria-pressed={kind === value}
            onClick={() => filter(value)}
          >
            {SIGNAL_LABELS[value]} {count(value)}
          </button>
        ))}
      </div>
      <section className={`${s.panel} ${s.section}`}>
        <p className={s.panelNote}>
          {kind
            ? `${SIGNAL_LABELS[kind]}: ${CONDITIONS[kind]}`
            : "신호 5종 전체. 판매 ID나 고객 가명 ID를 열면 분쟁 조회로 이동합니다."}
        </p>
        <div className={s.tableWrap}>
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
              </tr>
            </thead>
            <tbody>
              {shown.map((signal, index) => {
                const sale = snapshot.sales.find(
                  (entry) => entry.saleId === signal.saleId,
                );
                return (
                  <tr
                    key={`${signal.kind}:${signal.customerRef}:${signal.saleId ?? signal.attempt}:${index}`}
                  >
                    <td>
                      <Badge tone="warning">{SIGNAL_LABELS[signal.kind]}</Badge>
                    </td>
                    <td className={s.wrap}>{signal.detail}</td>
                    <td>
                      <Link to={customerPath(signal.customerRef)}>
                        <code title={signal.customerRef}>
                          {short(signal.customerRef, 10, 8)}
                        </code>
                      </Link>
                    </td>
                    <td>
                      {signal.saleId ? (
                        <Link to={salePath(signal.saleId)}>
                          <code title={signal.saleId}>
                            {short(signal.saleId)}
                          </code>
                          {sale &&
                            ` · ${productName(snapshot, sale.productId, sale.productVersion)}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{signal.attempt ? `${signal.attempt}회차` : "—"}</td>
                    <td>{dateTime(signalTime(snapshot, signal))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <p className={s.panelNote}>
            {kind
              ? `${SIGNAL_LABELS[kind]} 신호가 없습니다.`
              : "원장 이벤트에서 계산한 위험 신호가 없습니다."}
          </p>
        )}
      </section>
      <section className={`${s.panel} ${s.tableWrap} ${s.section}`}>
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
                <td className={s.numeric}>{count(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
