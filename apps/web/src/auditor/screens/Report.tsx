import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Download, FileText } from "lucide-react";
import {
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  type Deployment,
} from "../../../../../packages/core/src/index.ts";
import {
  OUTCOME_LABELS,
  type VerifyOutcome,
} from "../../../../../packages/core/src/verify.ts";
import { saveFile } from "../../../../../packages/ui/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Notice,
  type Tone,
} from "../../../../../packages/ui/src/components.tsx";
import { dateTime } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "../auditor.module.css";
import { LedgerLine } from "../components.tsx";
import {
  koreanError,
  productName,
  salePath,
  short,
  STATUS_LABELS,
} from "../format.ts";
import {
  buildReport,
  reportCsv,
  saveText,
  type AuditReport,
  type ReportScope,
} from "../report.ts";
import type { Ledger } from "../useLedger.ts";

const s = { ...ui, ...local };
const OUTCOME_TONES: Record<VerifyOutcome, Tone> = {
  match: "success",
  mismatch: "warning",
  missing: "neutral",
};

/** 보고서. 범위 안의 판매 건을 브라우저에서 독립 검증하고 JSON·CSV로 내려받는다. */
export function Report({
  deployment,
  ledger,
}: {
  deployment?: Deployment;
  ledger: Ledger;
}) {
  const [params] = useSearchParams();
  const initialSale = params.get("sale") ?? "";
  const [kind, setKind] = useState<ReportScope["kind"]>(
    initialSale ? "sale" : "confirmed",
  );
  const [saleId, setSaleId] = useState(initialSale);
  const [report, setReport] = useState<AuditReport>();
  const [progress, setProgress] = useState<[number, number]>();
  const [error, setError] = useState("");
  const busy = !!progress && progress[0] < progress[1];
  const [loading, setLoading] = useState(false);
  const sales = [...(ledger.snapshot?.sales ?? [])].reverse();
  const confirmed = sales.filter((sale) => sale.status === "confirmed").length;

  const build = async () => {
    if (!deployment || loading) return;
    setLoading(true);
    setReport(undefined);
    setError("");
    setProgress(undefined);
    try {
      const snapshot = await ledger.reload();
      if (!snapshot)
        throw new Error(
          "원장 기록을 불러오지 못했습니다. 지정 RPC 연결을 확인하세요.",
        );
      const scope: ReportScope =
        kind === "sale" ? { kind, saleId: saleId.trim() } : { kind };
      setReport(
        await buildReport(deployment, snapshot, scope, (done, total) =>
          setProgress([done, total]),
        ),
      );
    } catch (e) {
      setError(
        koreanError(e, "보고서를 만들지 못했습니다. 잠시 후 다시 시도하세요."),
      );
    } finally {
      setLoading(false);
    }
  };
  const fileName = (extension: string) =>
    `finveric-audit-report-${report?.scope.kind === "sale" ? `sale-${report.scope.saleId.slice(0, 10)}` : "confirmed"}-${report?.generatedAt.replace(/[:.]/g, "-")}.${extension}`;

  return (
    <div className={s.page}>
      <Heading
        title="대조 결과를 보고서로 내려받으세요"
        description="이 브라우저가 지정 RPC에서 원장을 읽고 판매 건마다 독립 검증을 실행합니다. 판매사 API를 쓰지 않습니다."
      />
      <LedgerLine ledger={ledger} />
      <div className={s.verifyGrid}>
        <form
          className={`${s.panel} ${s.pad}`}
          onSubmit={(e) => {
            e.preventDefault();
            void build();
          }}
        >
          <h2>보고서 범위</h2>
          <fieldset className={s.sources}>
            <legend>대조할 판매 건</legend>
            <label>
              <input
                type="radio"
                name="scope"
                checked={kind === "confirmed"}
                disabled={loading}
                onChange={() => setKind("confirmed")}
              />
              <span>
                가입 확정 전체
                <small>
                  {ledger.snapshot
                    ? `원장의 가입 확정 ${confirmed}건`
                    : "원장을 읽으면 건수를 보여 줍니다."}
                </small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="scope"
                checked={kind === "sale"}
                disabled={loading}
                onChange={() => setKind("sale")}
              />
              <span>
                판매 건 하나
                <small>청약·숙려 중이거나 철회한 건도 고를 수 있습니다.</small>
              </span>
            </label>
          </fieldset>
          {kind === "sale" && (
            <label className={s.field}>
              판매 건
              <select
                value={saleId}
                disabled={loading || sales.length === 0}
                onChange={(e) => setSaleId(e.target.value)}
              >
                <option value="">판매 건을 선택하세요</option>
                {saleId && !sales.some((sale) => sale.saleId === saleId) && (
                  <option value={saleId}>
                    {short(saleId)} · 원장에서 확인 전
                  </option>
                )}
                {sales.map((sale) => (
                  <option key={sale.saleId} value={sale.saleId}>
                    {productName(
                      ledger.snapshot,
                      sale.productId,
                      sale.productVersion,
                    )}{" "}
                    · {short(sale.saleId)} · {STATUS_LABELS[sale.status]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            type="submit"
            busy={loading}
            blocked={!deployment || (kind === "sale" && !saleId)}
          >
            {loading ? (
              progress ? (
                `${progress[0]}/${progress[1]}건 대조 중`
              ) : (
                "원장을 읽는 중"
              )
            ) : (
              <>
                보고서 만들기
                <FileText size={16} data-icon="end" />
              </>
            )}
          </Button>
          <p className={s.small}>
            원본 파일 없이 원장 기록만 대조합니다. 제출 자료와 대조하려면 분쟁
            조회를 쓰세요.
          </p>
        </form>
        <section className={`${s.panel} ${s.pad}`} aria-live="polite">
          {(error || (!ledger.snapshot && ledger.error)) && (
            <div role="alert">
              <Notice tone="danger">{error || ledger.error}</Notice>
            </div>
          )}
          {report ? (
            <ReportView
              report={report}
              json={() => saveFile(report, fileName("json"))}
              csv={() =>
                saveText(
                  reportCsv(report),
                  fileName("csv"),
                  "text/csv;charset=utf-8",
                )
              }
            />
          ) : (
            <>
              <h2>보고서 미리보기</h2>
              <p className={s.intro}>
                {busy
                  ? "판매 건마다 원장 기록을 대조하고 있습니다."
                  : "범위를 고르고 보고서 만들기를 누르세요. 만든 보고서는 JSON과 CSV로 내려받을 수 있습니다."}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportView({
  report,
  json,
  csv,
}: {
  report: AuditReport;
  json: () => void;
  csv: () => void;
}) {
  const { summary, source } = report;
  return (
    <>
      <div className={s.row}>
        <h2>보고서 미리보기</h2>
        <div className={s.actions}>
          <Button variant="outline" type="button" onClick={json}>
            <Download size={16} />
            JSON 내려받기
          </Button>
          <Button variant="outline" type="button" onClick={csv}>
            <Download size={16} />
            CSV 내려받기
          </Button>
        </div>
      </div>
      <Notice>
        이 보고서는 이 브라우저가 만들었습니다. 지정 RPC({source.rpcUrl})에서
        원장 {short(source.ledger, 10, 8)}의 이벤트를 블록 {source.latestBlock}
        까지 읽고 판매 건마다 verifySale을 실행했습니다. 판매사 API는 쓰지
        않았습니다.
      </Notice>
      <Facts
        rows={[
          [
            "범위",
            report.scope.kind === "sale"
              ? `판매 건 하나 · ${short(report.scope.saleId)}`
              : `가입 확정 전체 · ${report.sales.length}건`,
          ],
          [
            "대조 결과",
            (["match", "mismatch", "missing"] as const)
              .map(
                (outcome) =>
                  `${OUTCOME_LABELS[outcome]} ${summary.verified[outcome]}건`,
              )
              .join(" · "),
          ],
          [
            "원장 요약",
            `기준 ${summary.rules}개 버전 · 상품 설명서 ${summary.productVersions}개 버전 · 진단 ${summary.diagnoses}회 · 고객 가명 ID ${summary.customers}개`,
          ],
          [
            "원장 전체 판매 건",
            `가입 확정 ${summary.sales.confirmed}건 · 청약·숙려 중 ${summary.sales.subscribed}건 · 철회 ${summary.sales.withdrawn}건`,
          ],
          [
            "위험 신호",
            SIGNAL_KINDS.map(
              (kind) =>
                `${SIGNAL_LABELS[kind]} ${summary.signals[SIGNAL_LABELS[kind]] ?? 0}`,
            ).join(" · "),
          ],
          ["만든 시각", dateTime(report.generatedAt)],
        ]}
      />
      <div className={`${s.tableWrap} ${s.section}`}>
        <table>
          <caption>판매 건별 대조 결과</caption>
          <thead>
            <tr>
              <th scope="col">판매 ID</th>
              <th scope="col">상품</th>
              <th scope="col">회차</th>
              <th scope="col">적합</th>
              <th scope="col">상태</th>
              <th scope="col">대조 결과</th>
              <th scope="col">확인 필요 항목</th>
              <th scope="col">위험 신호</th>
            </tr>
          </thead>
          <tbody>
            {report.sales.map((sale) => {
              const failed = sale.checks.filter((check) => !check.ok);
              return (
                <tr key={sale.saleId}>
                  <td>
                    <Link to={salePath(sale.saleId)}>
                      <code title={sale.saleId}>{short(sale.saleId)}</code>
                    </Link>
                  </td>
                  <td className={s.wrap}>
                    {sale.product
                      ? `${sale.product} v${sale.productVersion}`
                      : "—"}
                  </td>
                  <td>{sale.attempt ? `${sale.attempt}회차` : "—"}</td>
                  <td>
                    {sale.outcome === "missing"
                      ? "—"
                      : sale.suitable
                        ? "적합"
                        : "부적합"}
                  </td>
                  <td>{sale.status}</td>
                  <td>
                    <Badge tone={OUTCOME_TONES[sale.outcome]}>
                      {sale.outcomeLabel}
                    </Badge>
                  </td>
                  <td className={s.wrap}>
                    {failed.length
                      ? failed.map((check) => check.name).join(", ")
                      : "—"}
                  </td>
                  <td className={s.wrap}>
                    {sale.signals.length ? sale.signals.join(", ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {report.sales.length === 0 && (
          <p className={s.small}>범위 안에 판매 건이 없습니다.</p>
        )}
      </div>
    </>
  );
}
