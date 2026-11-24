// 감독기관 화면이 함께 쓰는 원장 도구, 대기·오류 표시, 비율 줄.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp, RefreshCw } from "lucide-react";
import type { LedgerSnapshot } from "@finveric/core/ledger";
import { Button } from "../shared/button.tsx";
import { Notice, Skeleton } from "../shared/components.tsx";
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

/** 상단에서 원장을 다시 읽고 마지막으로 읽은 블록과 시각을 확인한다. */
export function LedgerTools({ ledger }: { ledger: Ledger }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const info = useRef<HTMLDivElement>(null);
  const infoId = useId();
  const readConfig = !ledger.configured || ledger.needsConfiguration;
  const reloadLabel = readConfig ? "설정 다시 불러오기" : "원장 다시 읽기";
  const status = ledger.loading
    ? ledger.configured
      ? "원장을 읽고 있습니다."
      : "검증 설정을 불러오고 있습니다."
    : ledger.error
      ? ledger.snapshot
        ? "원장을 읽지 못했습니다. 마지막으로 읽은 기록을 표시합니다."
        : "원장을 읽지 못했습니다."
      : ledger.snapshot
        ? "원장을 읽었습니다."
        : "원장을 아직 읽지 않았습니다.";

  useEffect(() => {
    if (!infoOpen) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfoOpen(false);
    };
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !info.current?.contains(event.target))
        setInfoOpen(false);
    };
    document.addEventListener("keydown", dismissOnEscape);
    document.addEventListener("pointerdown", dismissOutside);
    return () => {
      document.removeEventListener("keydown", dismissOnEscape);
      document.removeEventListener("pointerdown", dismissOutside);
    };
  }, [infoOpen]);

  return (
    <div className={s.ledgerTools}>
      <span className={s.srOnly} role="status">
        {status}
      </span>
      <div
        ref={info}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setInfoOpen(true);
        }}
        onPointerLeave={(event) => {
          if (
            event.pointerType !== "touch" &&
            !event.currentTarget.querySelector(":focus-visible")
          )
            setInfoOpen(false);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.matches(":hover")) setInfoOpen(false);
        }}
      >
        <Button
          className={s.ledgerIcon}
          variant="ghost"
          type="button"
          aria-label="원장 조회 정보"
          aria-describedby={infoId}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible"))
              setInfoOpen(true);
          }}
          onClick={() => setInfoOpen(true)}
        >
          <CircleHelp size={18} aria-hidden="true" />
        </Button>
        <div
          id={infoId}
          role="tooltip"
          hidden={!infoOpen}
          className={s.ledgerInfo}
        >
          <div className={s.ledgerInfoCard}>
            {ledger.snapshot ? (
              <dl>
                <div>
                  <dt>마지막 조회 블록</dt>
                  <dd>{ledger.snapshot.latestBlock.toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>조회 시각</dt>
                  <dd>{dateTime(ledger.loadedAt)}</dd>
                </div>
              </dl>
            ) : (
              status
            )}
          </div>
        </div>
      </div>
      <Button
        className={s.ledgerIcon}
        variant="ghost"
        type="button"
        aria-label={reloadLabel}
        title={reloadLabel}
        busy={ledger.loading}
        onClick={() =>
          readConfig ? ledger.reloadConfiguration() : void ledger.reload()
        }
      >
        {!ledger.loading && <RefreshCw size={18} aria-hidden="true" />}
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
        <div
          className={`${s.panel} ${s.pad} ${s.ledgerSkeleton}`}
          aria-hidden="true"
        >
          <Skeleton width="9rem" height="1.25rem" />
          <Skeleton />
          <Skeleton width="75%" />
          <Skeleton width="88%" />
        </div>
      ) : null}
    </>
  );
}
