import { useState } from "react";
import { useLocation } from "react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import type {
  Deployment,
  Trace,
} from "../../../../../packages/core/src/index.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Notice,
  TransactionFacts,
} from "../../../../../packages/ui/src/components.tsx";
import {
  profileName,
  saleProductName,
  type Sale,
} from "../../../../../packages/ui/src/sale.ts";
import type { SaleAction } from "../../../../../packages/core/src/api.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./operations.module.css";
import { receiptEvents, registrationActions, traceLabel } from "../traces.ts";

const s = { ...ui, ...local };

export function Chain({
  traces,
  sale,
  action,
  busy,
  refresh,
  deployment,
}: {
  traces: Trace[];
  sale?: Sale;
  action: (a: SaleAction) => unknown;
  busy: boolean;
  refresh: () => unknown;
  deployment?: Deployment;
}) {
  const location = useLocation();
  const [selected, setSelected] = useState<{ search: string; id: string }>();
  const selectedId =
    selected?.search === location.search
      ? selected.id
      : new URLSearchParams(location.search).get("trace");
  const visibleTraces = traces.filter(
    (trace) =>
      !sale ||
      sale.traces.some((item) => item.id === trace.id) ||
      registrationActions.has(trace.action),
  );
  const log =
    visibleTraces.find((t) => t.id === selectedId) ?? visibleTraces.at(-1);
  const events = receiptEvents(log, deployment?.ledger);
  const profile = events
    .filter((event) => event.eventName === "DiagnosisRecorded")
    .at(-1)?.args.profile;
  const eventNames = [...new Set(events.map((event) => event.eventName))];
  return (
    <>
      <Heading
        title="가입 처리 기록"
        description="기록을 선택해 서버 처리 결과와 블록체인 거래 근거를 확인하세요."
      >
        <Button variant="outline" disabled={busy} onClick={refresh}>
          <RefreshCw size={16} />
          새로고침
        </Button>
      </Heading>
      <Notice>
        서버가 진단 증명을 만들고 관리자 승인 결과를 보관합니다. 시연 서비스가
        고객 역할의 테스트 키로 서명한 거래에 증명과 확인 내용을 기록합니다.
      </Notice>
      {sale && (
        <p className={s.small}>
          {saleProductName(sale)} · 판매 ID <code>{sale.id}</code>
        </p>
      )}
      <div className={`${s.panel} ${s.logGrid}`}>
        <div className={s.logList}>
          {visibleTraces.length ? (
            visibleTraces.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setSelected({ search: location.search, id: t.id })
                }
                className={log?.id === t.id ? s.logSelected : ""}
              >
                <time>
                  {new Date(t.at).toLocaleTimeString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    hour12: false,
                  })}
                </time>
                <div>
                  <strong>{traceLabel(t, deployment?.ledger)}</strong>
                  <small>{t.txHash ? "블록체인 거래" : t.source}</small>
                </div>
                <Badge
                  tone={
                    t.status === "confirmed"
                      ? "success"
                      : t.status === "failed"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {t.status === "confirmed"
                    ? "완료"
                    : t.status === "failed"
                      ? "실패"
                      : "대기"}
                </Badge>
              </button>
            ))
          ) : (
            <div className={s.empty}>아직 처리 기록이 없어요.</div>
          )}
        </div>
        <section className={s.logDetail}>
          {log ? (
            <>
              <h2>{traceLabel(log, deployment?.ledger)}</h2>
              {log.txHash && (
                <TransactionFacts hash={log.txHash} block={log.blockNumber} />
              )}
              {profile !== undefined && (
                <Facts rows={[["투자성향", profileName(profile)]]} />
              )}
              <Facts
                rows={[
                  ["처리 출처", log.source],
                  [
                    "이벤트",
                    eventNames.length > 0 ? (
                      <code>{eventNames.join(" · ")}</code>
                    ) : log.event ? (
                      <code>{log.event}</code>
                    ) : (
                      "—"
                    ),
                  ],
                ]}
              />
              {deployment?.chainId === 11155111 && log.txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Etherscan에서 보기
                  <ExternalLink size={14} />
                </a>
              )}
              <details>
                <summary>
                  {log.txHash ? "거래 영수증 JSON" : "처리 응답 JSON"}
                </summary>
                <pre>
                  {JSON.stringify(
                    log.detail ?? { status: log.status },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          ) : (
            <p>기록을 선택하세요.</p>
          )}
        </section>
      </div>
      <h2 className={s.sectionTitle}>모의 매입 처리</h2>
      <div className={s.actions}>
        <Button
          variant="outline"
          disabled={
            busy || !sale?.state.finalized || sale.state.purchaseState === 3
          }
          onClick={() => action("purchase")}
        >
          모의 매입 결과 반영
        </Button>
      </div>
      <p className={s.small}>
        모의 매입 결과는 가입 완료 후 별도 거래로 기록합니다.
      </p>
    </>
  );
}
