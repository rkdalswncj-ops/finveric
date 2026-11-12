// 감독기관 화면이 함께 쓰는 원장 상태 줄과 대기·오류 표시.
import type { ReactNode } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { LedgerSnapshot } from "../../../../packages/core/src/ledger.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import { Notice } from "../../../../packages/ui/src/components.tsx";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./auditor.module.css";
import type { Ledger } from "./useLedger.ts";

const s = { ...ui, ...local };

/** 원장을 언제, 어느 블록까지 읽었는지 보여 주고 다시 읽게 한다. */
export function LedgerLine({ ledger }: { ledger: Ledger }) {
  return (
    <div className={s.ledgerLine}>
      <span role="status" aria-live="polite">
        {ledger.loading
          ? "지정 RPC에서 원장을 읽고 있어요."
          : ledger.snapshot
            ? `블록 ${ledger.snapshot.latestBlock.toString()}까지 읽었어요 · ${ledger.loadedAt?.toLocaleTimeString("ko-KR") ?? ""}`
            : "원장을 아직 읽지 않았어요."}
      </span>
      <Button
        variant="outline"
        type="button"
        disabled={ledger.loading}
        onClick={() => void ledger.reload()}
      >
        {ledger.loading ? (
          <LoaderCircle className={s.spin} size={15} />
        ) : (
          <RefreshCw size={15} />
        )}
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
              ? "지정 RPC에서 원장 이벤트를 읽고 있어요."
              : "검증 설정을 불러오고 있어요."}
          </p>
        </div>
      ) : null}
    </>
  );
}
