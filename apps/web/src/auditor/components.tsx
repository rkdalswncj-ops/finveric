// 감독기관 화면이 함께 쓰는 원장 상태 줄, 대기·오류 표시, 비율 줄.
import type { ReactNode } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { LedgerSnapshot } from "@finveric/core/ledger";
import { Button } from "../shared/button.tsx";
import { Notice } from "../shared/components.tsx";
import { dateTime } from "../shared/format.ts";
import ui from "../shared/ui.module.css";
import local from "./auditor.module.css";
import { percent } from "./format.ts";
import type { Ledger } from "./useLedger.ts";

const s = { ...ui, ...local };

/**
 * 비율 한 줄: 이름, 큰 백분율, 막대, 한 줄 근거. 대시보드와 보고서가 같은 모양으로 쓴다.
 * `note`에는 분모와 분자를 건수로 적는다. 패딩이 있는 패널(`pad`) 안에서는 `inPad`를 준다.
 */
export function Ratio({
  label,
  part,
  whole,
  note,
  inPad,
}: {
  label: string;
  part: number;
  whole: number;
  note: string;
  inPad?: boolean;
}) {
  const value = percent(part, whole);
  return (
    <div className={inPad ? `${s.ratio} ${s.ratioInPad}` : s.ratio}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={s.bar} role="img" aria-label={`${label} ${value}`}>
        <span style={{ width: whole ? `${(part / whole) * 100}%` : 0 }} />
      </div>
      <p>{note}</p>
    </div>
  );
}

/** 원장을 언제, 어느 블록까지 읽었는지 보여 주고 다시 읽게 한다. */
export function LedgerLine({ ledger }: { ledger: Ledger }) {
  return (
    <div className={s.ledgerLine}>
      <span role="status" aria-live="polite">
        {ledger.loading
          ? "지정 RPC에서 원장을 읽고 있습니다."
          : ledger.error
            ? "원장을 읽지 못했습니다."
            : ledger.snapshot
              ? `블록 ${ledger.snapshot.latestBlock.toString()}까지 읽었습니다 · ${dateTime(ledger.loadedAt)}`
              : "원장을 아직 읽지 않았습니다."}
        {ledger.snapshot &&
          (ledger.loading || ledger.error) &&
          ` 마지막으로 읽은 기록을 표시합니다 · 블록 ${ledger.snapshot.latestBlock.toString()} · ${dateTime(ledger.loadedAt)}`}
      </span>
      <Button
        variant="outline"
        type="button"
        busy={ledger.loading}
        onClick={() => void ledger.reload()}
      >
        {!ledger.loading && <RefreshCw size={16} />}
        원장 다시 읽기
      </Button>
    </div>
  );
}

/** 원장을 읽기 전에는 대기·오류를 보여 주고, 읽은 뒤에 화면을 그린다. */
export function LedgerGate({
  ledger,
  children,
}: {
  ledger: Ledger;
  children: (snapshot: LedgerSnapshot) => ReactNode;
}) {
  return (
    <>
      {ledger.error && (
        <div role="alert">
          <Notice tone="danger">{ledger.error}</Notice>
        </div>
      )}
      {ledger.snapshot ? (
        children(ledger.snapshot)
      ) : !ledger.error ? (
        <div className={`${s.panel} ${s.empty}`}>
          <LoaderCircle className={s.spin} size={22} />
          <p>
            {ledger.configured
              ? "지정 RPC에서 원장 이벤트를 읽고 있습니다."
              : "검증 설정을 불러오고 있습니다."}
          </p>
        </div>
      ) : null}
    </>
  );
}
