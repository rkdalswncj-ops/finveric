import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertTriangle,
  Check,
  FileText,
  LoaderCircle,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import {
  computeSignals,
  SIGNAL_LABELS,
  type Deployment,
  type EvidenceReceipt,
  type OriginalBundle,
} from "../../../../../packages/core/src/index.ts";
import type {
  ConfigDto,
  ExportResponse,
} from "../../../../../packages/core/src/api.ts";
import type {
  LedgerDiagnosis,
  LedgerSnapshot,
} from "../../../../../packages/core/src/ledger.ts";
import {
  CHECK_NAMES,
  OUTCOME_LABELS,
  verifySale,
  type SaleVerification,
  type VerifyOutcome,
} from "../../../../../packages/core/src/verify.ts";
import { api } from "../../../../../packages/ui/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  AccessCodeForm,
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "../auditor.module.css";
import { LedgerGate, LedgerLine } from "../components.tsx";
import {
  customerPath,
  dateTime,
  gradeLabel,
  koreanError,
  productName,
  profileLabel,
  REFERENCE_LABELS,
  ruleLabel,
  salePath,
  saleSignals,
  short,
  STATUS_LABELS,
  STATUS_TONES,
  won,
} from "../format.ts";
import type { Ledger } from "../useLedger.ts";

const s = { ...ui, ...local };

const OUTCOME_TONES: Record<VerifyOutcome, string> = {
  match: "success",
  mismatch: "warning",
  missing: "neutral",
};
const OUTCOME_TEXT: Record<VerifyOutcome, string> = {
  match: "대조한 모든 항목이 원장 기록과 같아요.",
  mismatch: "일부 항목이 원장 기록과 달라요. 확인 필요 항목을 보세요.",
  missing: "지정한 원장에 이 판매 ID의 청약 기록이 없어요.",
};
const CUSTOMER_REF = /^0x[0-9a-fA-F]{64}$/;

/** 분쟁 조회. 판매 ID는 verifySale로 단계별 대조를, 고객 가명 ID는 원장의 진단·판매 기록을 보여 준다. */
export function Disputes({
  deployment,
  ledger,
  search,
}: {
  deployment?: Deployment;
  ledger: Ledger;
  search: string;
}) {
  const params = new URLSearchParams(search);
  const customer = params.get("customer");
  const saleId = params.get("sale") ?? "";
  const byCustomer = customer !== null;
  return (
    <div className={s.page}>
      <Heading
        title="판매 기록을 원장과 대조해요"
        description="판매 ID로 단계별 원장 기록과 제출 자료를 대조하거나, 고객 가명 ID로 모든 진단 회차와 판매 건을 확인해요."
      />
      <LedgerLine ledger={ledger} />
      <nav aria-label="조회 방법" className={s.actions}>
        <Button variant={byCustomer ? "outline" : "default"} asChild>
          <Link to="/disputes" aria-current={!byCustomer ? "page" : undefined}>
            판매 ID로 조회
          </Link>
        </Button>
        <Button variant={byCustomer ? "default" : "outline"} asChild>
          <Link
            to="/disputes?customer="
            aria-current={byCustomer ? "page" : undefined}
          >
            고객 가명 ID로 조회
          </Link>
        </Button>
      </nav>
      {byCustomer ? (
        <CustomerLookup key={customer} ledger={ledger} customerRef={customer} />
      ) : (
        <SaleLookup
          key={search}
          deployment={deployment}
          ledger={ledger}
          initialId={saleId}
          initialSource={params.get("source") === "file" ? "file" : "ledger"}
        />
      )}
    </div>
  );
}

type Source = "ledger" | "seller" | "file";
type Result = {
  primary: SaleVerification;
  ledgerOnly: SaleVerification;
  snapshot: LedgerSnapshot;
  source: Source;
  hasReceipt: boolean;
  hasOriginal: boolean;
  sellerError?: string;
};

function SaleLookup({
  deployment,
  ledger,
  initialId,
  initialSource,
}: {
  deployment?: Deployment;
  ledger: Ledger;
  initialId: string;
  initialSource: Source;
}) {
  const [id, setId] = useState(initialId);
  const [source, setSource] = useState<Source>(initialSource);
  const [receipt, setReceipt] = useState<EvidenceReceipt>();
  const [original, setOriginal] = useState<OriginalBundle>();
  const [files, setFiles] = useState<
    Partial<Record<"receipt" | "original", string>>
  >({});
  const [result, setResult] = useState<Result>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenRequired, setTokenRequired] = useState(false);
  const autoRun = useRef(false);
  const saleId = id.trim();
  const sales = [...(ledger.snapshot?.sales ?? [])].reverse();

  const load = async (file: File | undefined, kind: "receipt" | "original") => {
    if (!file) return;
    setResult(undefined);
    setError("");
    if (kind === "receipt") setReceipt(undefined);
    else setOriginal(undefined);
    setFiles((current) => ({ ...current, [kind]: undefined }));
    if (file.size > 2_000_000) {
      setError("2MB 이하 JSON 파일을 선택해 주세요.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (
        parsed?.format !== `finveric-${kind}-v5` ||
        typeof parsed.saleId !== "string"
      )
        throw new Error(
          kind === "receipt"
            ? "원장 v5의 가입 증명서 파일(finveric-receipt-v5)을 선택해 주세요."
            : "원장 v5의 원본 묶음 파일(finveric-original-v5)을 선택해 주세요.",
        );
      const other = kind === "receipt" ? original : receipt;
      if (other && other.saleId !== parsed.saleId)
        throw new Error("같은 판매 건의 증명서와 원본을 선택해 주세요.");
      if (kind === "receipt") setReceipt(parsed);
      else setOriginal(parsed);
      setId((current) => current.trim() || parsed.saleId);
      setFiles((current) => ({ ...current, [kind]: file.name }));
    } catch (e) {
      setError(
        koreanError(
          e,
          "파일을 읽을 수 없어요. 내려받은 JSON 파일을 선택해 주세요.",
        ),
      );
    }
  };

  const verify = async () => {
    if (!deployment || !saleId || loading) return;
    setLoading(true);
    setResult(undefined);
    setError("");
    try {
      const snapshot = await ledger.reload();
      if (!snapshot)
        throw new Error(
          "원장 기록을 불러오지 못했어요. 지정 RPC 연결을 확인해 주세요.",
        );
      let evidence = source === "file" ? receipt : undefined;
      let witness = source === "file" ? original : undefined;
      let sellerError: string | undefined;
      if (source === "seller") {
        try {
          [evidence, witness] = await Promise.all([
            api<ExportResponse["receipt"]>(`/sales/${saleId}/export/receipt`),
            api<ExportResponse["original"]>(`/sales/${saleId}/export/original`),
          ]);
          setTokenRequired(false);
        } catch {
          const config = await api<ConfigDto>("/config").catch(() => undefined);
          setTokenRequired(!!config?.requiresToken);
          sellerError = config?.requiresToken
            ? "판매사 제출 자료를 받으려면 시연 접근 코드를 입력해 주세요. 원장 기록만 대조했어요."
            : "판매사 제출 자료를 불러오지 못했어요. 원장 기록만 대조했어요.";
        }
      }
      const ledgerOnly = await verifySale(
        deployment,
        saleId,
        undefined,
        undefined,
        { snapshot },
      );
      const primary =
        evidence || witness
          ? await verifySale(deployment, saleId, evidence, witness, {
              snapshot,
            })
          : ledgerOnly;
      setResult({
        primary,
        ledgerOnly,
        snapshot,
        source,
        hasReceipt: !!evidence,
        hasOriginal: !!witness,
        sellerError,
      });
    } catch (e) {
      setError(
        koreanError(
          e,
          "원장 기록을 대조하지 못했어요. 잠시 후 다시 시도해 주세요.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // 다른 화면에서 판매 ID로 들어오면 원장만 바로 대조한다.
  useEffect(() => {
    if (
      autoRun.current ||
      !deployment ||
      !initialId ||
      initialSource !== "ledger"
    )
      return;
    autoRun.current = true;
    void verify();
    // verify는 처음 렌더의 값(초기 판매 ID, 원장만)을 쓴다. 한 번만 실행한다.
  }, [deployment, initialId, initialSource]);

  return (
    <div className={s.verifyGrid}>
      <form
        className={`${s.panel} ${s.pad}`}
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <h2>조회할 판매 건</h2>
        <label className={s.field}>
          원장의 판매 건에서 선택
          <select
            value={sales.some((sale) => sale.saleId === saleId) ? saleId : ""}
            disabled={loading || sales.length === 0}
            onChange={(e) => {
              setId(e.target.value);
              setResult(undefined);
            }}
          >
            <option value="">
              {!ledger.snapshot
                ? "원장을 읽고 있어요"
                : sales.length
                  ? "판매 건을 선택해 주세요"
                  : "원장에 판매 건이 없어요"}
            </option>
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
        <label className={s.field}>
          판매 ID
          <input
            className={s.breakWord}
            value={id}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            onChange={(e) => {
              setId(e.target.value);
              setResult(undefined);
            }}
            placeholder="판매 ID(10진수)를 입력해 주세요"
          />
        </label>
        <fieldset className={s.sources}>
          <legend>함께 대조할 자료</legend>
          {(
            [
              ["ledger", "원장만", "판매사 자료 없이 원장 기록만 대조해요."],
              [
                "seller",
                "판매사 제출 자료 불러오기",
                "이 판매 건의 증명서와 원본을 판매사 API에서 GET으로 받아요.",
              ],
              [
                "file",
                "파일 선택",
                "증명서나 원본 파일을 이 브라우저에서 읽어요.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value}>
              <input
                type="radio"
                name="source"
                value={value}
                checked={source === value}
                disabled={loading}
                onChange={() => {
                  setSource(value);
                  setResult(undefined);
                }}
              />
              <span>
                {label}
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {source === "file" && (
          <>
            <label className={s.upload}>
              가입 증명서 (finveric-receipt-v5)
              <input
                type="file"
                accept="application/json,.json"
                disabled={loading}
                onChange={(e) => void load(e.target.files?.[0], "receipt")}
              />
              {files.receipt && (
                <span className={`${s.small} ${s.breakWord}`}>
                  {files.receipt}
                </span>
              )}
            </label>
            <label className={s.upload}>
              원본 묶음 (finveric-original-v5)
              <input
                type="file"
                accept="application/json,.json"
                disabled={loading}
                onChange={(e) => void load(e.target.files?.[0], "original")}
              />
              {files.original && (
                <span className={`${s.small} ${s.breakWord}`}>
                  {files.original}
                </span>
              )}
            </label>
          </>
        )}
        {source === "seller" && tokenRequired && (
          <AccessCodeForm connect={() => void verify()} busy={loading} />
        )}
        <Button type="submit" disabled={!deployment || !saleId || loading}>
          {loading ? (
            <>
              <LoaderCircle className={s.spin} size={16} />
              원장과 대조하는 중
            </>
          ) : (
            <>
              원장과 대조하기
              <ShieldCheck size={17} />
            </>
          )}
        </Button>
        {source === "file" && (receipt || original) && (
          <Button
            variant="ghost"
            type="button"
            disabled={loading}
            onClick={() => {
              setReceipt(undefined);
              setOriginal(undefined);
              setFiles({});
              setResult(undefined);
            }}
          >
            선택한 파일 비우기
          </Button>
        )}
      </form>
      <section className={`${s.panel} ${s.pad}`} aria-live="polite">
        {error && (
          <div role="alert">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        {result ? (
          <SaleResult result={result} deployment={deployment} files={files} />
        ) : (
          <>
            <h2>대조 결과</h2>
            <p className={s.intro}>
              {loading
                ? "지정 RPC에서 원장을 읽고 판매 건을 대조하고 있어요."
                : "판매 건을 고르거나 판매 ID를 입력하고 원장과 대조하기를 눌러 주세요. 원본 묶음이 있으면 모든 회차의 답변으로 판정을 다시 계산해요."}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function SaleResult({
  result,
  deployment,
  files,
}: {
  result: Result;
  deployment?: Deployment;
  files: Partial<Record<"receipt" | "original", string>>;
}) {
  const { primary, ledgerOnly, snapshot } = result;
  const sale = primary.sale;
  const outcome = primary.outcome;
  const hasEvidence = result.hasReceipt || result.hasOriginal;
  // 제출 자료 대조: 원장만으로 통과한 항목이 자료를 넣고 실패하지 않았고, 증명서·원본 항목이 통과했다.
  const evidenceOk = primary.checks.every(
    (check) =>
      check.ok ||
      ledgerOnly.checks.find((entry) => entry.name === check.name)?.ok ===
        false,
  );
  const signals = sale ? saleSignals(computeSignals(snapshot), sale) : [];
  const fileNames = [files.receipt, files.original].filter(Boolean).join(", ");
  return (
    <>
      <div className={s.outcome}>
        {outcome === "match" ? (
          <ShieldCheck className={s.successIcon} />
        ) : outcome === "mismatch" ? (
          <AlertTriangle className={s.warningIcon} />
        ) : (
          <SearchX className={s.neutralIcon} />
        )}
        <div>
          <Badge tone={OUTCOME_TONES[outcome]}>{OUTCOME_LABELS[outcome]}</Badge>
          <h2>
            {sale
              ? productName(snapshot, sale.productId, sale.productVersion)
              : "판매 기록 없음"}
          </h2>
          <p>{OUTCOME_TEXT[outcome]}</p>
          <p>
            판매 ID <code>{primary.saleId}</code>
          </p>
        </div>
      </div>
      {result.sellerError && (
        <Notice tone="warning">{result.sellerError}</Notice>
      )}
      {outcome !== "missing" && (
        <div className={s.split}>
          <div>
            <strong>원장 기록과 가입 조건</strong>
            <Badge
              tone={ledgerOnly.outcome === "match" ? "success" : "warning"}
            >
              {ledgerOnly.outcome === "match" ? "검증 완료" : "확인 필요"}
            </Badge>
            <small>
              판매 기록, 상품 버전, 진단 기준·회차와 증명, 필수 확인, 숙려를
              원장으로 대조했어요.
            </small>
          </div>
          <div>
            <strong>제출 자료 대조</strong>
            <Badge
              tone={
                !hasEvidence ? "neutral" : evidenceOk ? "success" : "warning"
              }
            >
              {!hasEvidence ? "자료 없음" : evidenceOk ? "일치" : "불일치"}
            </Badge>
            <small>
              {!hasEvidence
                ? "증명서나 원본을 넣으면 원장 기록과 대조해요."
                : result.source === "seller"
                  ? "판매사 API에서 받은 증명서와 원본을 원장 기록과 대조했어요."
                  : `선택한 파일을 원장 기록과 대조했어요. ${fileNames}`}
            </small>
          </div>
        </div>
      )}
      <h3 className={s.subhead}>항목별 결과</h3>
      {Object.values(CHECK_NAMES).map((name) => {
        const check = primary.checks.find((entry) => entry.name === name);
        if (!check) {
          if (outcome === "missing") return null;
          const needs =
            name === CHECK_NAMES.original
              ? "원본 묶음을 넣으면 모든 회차의 답변·임의값으로 커밋먼트와 판정을 다시 계산해요."
              : name === CHECK_NAMES.receipt
                ? "증명서를 넣으면 증명서의 판매 ID, 상품 버전, 회차, 금액, 거래를 원장과 대조해요."
                : "이 항목은 확인하지 않았어요.";
          return (
            <div className={s.checkResult} key={name}>
              <FileText className={s.neutralIcon} />
              <div>
                <strong>{name}</strong>
                <p>{needs}</p>
              </div>
              <Badge>자료 없음</Badge>
            </div>
          );
        }
        const absent = outcome === "missing" && !check.ok;
        return (
          <div className={s.checkResult} key={name}>
            {check.ok ? (
              <Check className={s.successIcon} />
            ) : absent ? (
              <SearchX className={s.neutralIcon} />
            ) : (
              <AlertTriangle className={s.warningIcon} />
            )}
            <div>
              <strong>{check.name}</strong>
              <p>{check.detail}</p>
            </div>
            <Badge tone={check.ok ? "success" : absent ? "neutral" : "warning"}>
              {check.ok ? "일치" : absent ? "기록 없음" : "확인 필요"}
            </Badge>
          </div>
        );
      })}
      {sale && (
        <>
          <h3 className={s.subhead}>판매 건 기록</h3>
          <Facts
            rows={[
              [
                "상품",
                <Link to={`/products?product=${sale.productId}`}>
                  {productName(snapshot, sale.productId, sale.productVersion)} v
                  {sale.productVersion}
                </Link>,
              ],
              [
                "고객 가명 ID",
                <Link to={customerPath(sale.customerRef)}>
                  <code title={sale.customerRef}>
                    {short(sale.customerRef, 10, 8)}
                  </code>
                </Link>,
              ],
              ["청약 회차", `${sale.attempt}회차`],
              [
                "적합 여부",
                sale.suitable ? (
                  "적합"
                ) : (
                  <Badge tone="warning">부적합 · 추가 위험 확인</Badge>
                ),
              ],
              ["녹취·숙려 대상", sale.protectedSale ? "대상" : "대상 아님"],
              [
                "관리자 승인",
                sale.attempt >= 3
                  ? sale.approved
                    ? "승인 기록 있음"
                    : "승인 기록 없음"
                  : "대상 아님(3회차 미만)",
              ],
              ["설명 확인 시간", `${sale.explanationSeconds}초`],
              ["청약 금액", won(sale.amount)],
              [
                "상태",
                <Badge tone={STATUS_TONES[sale.status]}>
                  {STATUS_LABELS[sale.status]}
                </Badge>,
              ],
              ["청약 시각", dateTime(sale.subscribed.at)],
              [
                sale.withdrawn ? "철회 시각" : "확정 시각",
                dateTime((sale.withdrawn ?? sale.confirmed)?.at),
              ],
            ]}
          />
          <DiagnosisTable
            diagnoses={primary.diagnoses}
            snapshot={snapshot}
            saleAttempt={sale.attempt}
            caption="이 고객 가명 ID의 진단 회차"
          />
          <h3 className={s.subhead}>위험 신호</h3>
          {signals.length ? (
            <ul className={s.choices}>
              {signals.map((signal, index) => (
                <li key={index}>
                  <Badge tone="warning">{SIGNAL_LABELS[signal.kind]}</Badge>
                  <span className={s.small}>{signal.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.small}>이 판매 건에 해당하는 위험 신호가 없어요.</p>
          )}
        </>
      )}
      <h3 className={s.subhead}>대조에 쓴 원장</h3>
      <Facts
        rows={[
          [
            "네트워크",
            primary.chainId === 11155111
              ? "Sepolia (11155111)"
              : "Anvil (31337)",
          ],
          ["RPC", <code>{deployment?.rpcUrl}</code>],
          ["원장 컨트랙트", <code>{deployment?.ledger}</code>],
          ["Verifier", <code>{deployment?.verifier}</code>],
          ["대조 시각", new Date(primary.verifiedAt).toLocaleString("ko-KR")],
        ]}
      />
      {primary.references.length > 0 && (
        <details>
          <summary>블록·거래 근거 보기 ({primary.references.length}건)</summary>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">기록</th>
                  <th scope="col">블록</th>
                  <th scope="col">거래 해시</th>
                </tr>
              </thead>
              <tbody>
                {primary.references.map((reference, index) => (
                  <tr key={index}>
                    <td>
                      {REFERENCE_LABELS[reference.kind]}
                      {reference.attempt ? ` ${reference.attempt}회차` : ""}
                    </td>
                    <td className={s.numeric}>{reference.block}</td>
                    <td>
                      <code>{reference.txHash}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {sale && (
        <Button variant="outline" asChild>
          <Link to={`/report?sale=${encodeURIComponent(primary.saleId)}`}>
            이 판매 건으로 보고서 만들기
          </Link>
        </Button>
      )}
    </>
  );
}

function DiagnosisTable({
  diagnoses,
  snapshot,
  saleAttempt,
  caption,
}: {
  diagnoses: LedgerDiagnosis[];
  snapshot: LedgerSnapshot;
  saleAttempt?: number;
  caption: string;
}) {
  const [technical, setTechnical] = useState(false);
  return (
    <>
      <div className={s.row}>
        <h3 className={s.subhead}>{caption}</h3>
        <label className={s.toggle}>
          <input
            type="checkbox"
            checked={technical}
            onChange={(e) => setTechnical(e.target.checked)}
          />
          블록·거래 보기
        </label>
      </div>
      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th scope="col">회차</th>
              <th scope="col">투자성향</th>
              <th scope="col">권유 가능 최고 위험등급</th>
              <th scope="col">고령 표시</th>
              <th scope="col">기준</th>
              <th scope="col">블록 시각</th>
              {technical && <th scope="col">블록</th>}
              {technical && <th scope="col">거래 해시</th>}
            </tr>
          </thead>
          <tbody>
            {diagnoses.map((diagnosis) => (
              <tr
                key={diagnosis.attempt}
                className={
                  diagnosis.attempt === saleAttempt ? s.selectedRow : undefined
                }
              >
                <td>
                  {diagnosis.attempt}회차{" "}
                  {diagnosis.attempt === saleAttempt && (
                    <Badge tone="blue">청약 회차</Badge>
                  )}
                </td>
                <td>{profileLabel(diagnosis.profile)}</td>
                <td>{gradeLabel(diagnosis.limit)}까지</td>
                <td>{diagnosis.elderly ? "고령" : "—"}</td>
                <td>{ruleLabel(snapshot, diagnosis.ruleHash)}</td>
                <td>{dateTime(diagnosis.at)}</td>
                {technical && (
                  <td className={s.numeric}>{diagnosis.block.toString()}</td>
                )}
                {technical && (
                  <td>
                    <code title={diagnosis.txHash}>
                      {short(diagnosis.txHash, 10, 8)}
                    </code>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {diagnoses.length === 0 && (
        <p className={s.small}>원장에 진단 기록이 없어요.</p>
      )}
    </>
  );
}

function CustomerLookup({
  ledger,
  customerRef,
}: {
  ledger: Ledger;
  customerRef: string;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(customerRef);
  const [error, setError] = useState("");
  const snapshot = ledger.snapshot;
  const known = snapshot
    ? [
        ...new Set(
          [...snapshot.diagnoses, ...snapshot.sales].map(
            (entry) => entry.customerRef,
          ),
        ),
      ]
    : [];
  const submit = (ref: string) => {
    const next = ref.trim();
    if (!CUSTOMER_REF.test(next)) {
      setError("고객 가명 ID는 0x로 시작하는 64자리 16진수예요.");
      return;
    }
    setError("");
    navigate(customerPath(next.toLowerCase()));
  };
  return (
    <div className={s.verifyGrid}>
      <form
        className={`${s.panel} ${s.pad}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <h2>조회할 고객</h2>
        <label className={s.field}>
          원장의 고객 가명 ID에서 선택
          <select
            value={known.find((ref) => ref === value.toLowerCase()) ?? ""}
            disabled={known.length === 0}
            onChange={(e) => {
              setValue(e.target.value);
              if (e.target.value) submit(e.target.value);
            }}
          >
            <option value="">
              {!snapshot
                ? "원장을 읽고 있어요"
                : known.length
                  ? "고객 가명 ID를 선택해 주세요"
                  : "원장에 고객 기록이 없어요"}
            </option>
            {known.map((ref) => (
              <option key={ref} value={ref}>
                {short(ref, 10, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          고객 가명 ID
          <input
            className={s.breakWord}
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0x로 시작하는 64자리 16진수"
          />
        </label>
        {error && (
          <p role="alert" className={s.small}>
            {error}
          </p>
        )}
        <Button type="submit" disabled={!value.trim()}>
          원장에서 조회하기
          <ShieldCheck size={17} />
        </Button>
        <p className={s.small}>
          원장에는 고객 번호와 개인정보가 없어요. 실제 고객과의 연결 정보는
          판매사가 분쟁 절차에 따라 내요.
        </p>
      </form>
      <section className={`${s.panel} ${s.pad}`}>
        <LedgerGate ledger={ledger}>
          {(snapshot) =>
            customerRef && CUSTOMER_REF.test(customerRef) ? (
              <CustomerRecord snapshot={snapshot} customerRef={customerRef} />
            ) : (
              <>
                <h2>고객 기록</h2>
                <p className={s.intro}>
                  고객 가명 ID를 고르거나 입력해 주세요. 그 고객의 모든 진단
                  회차와 판매 건을 원장에서 보여 줘요.
                </p>
              </>
            )
          }
        </LedgerGate>
      </section>
    </div>
  );
}

function CustomerRecord({
  snapshot,
  customerRef,
}: {
  snapshot: LedgerSnapshot;
  customerRef: string;
}) {
  const ref = customerRef.toLowerCase();
  const diagnoses = snapshot.diagnoses
    .filter((entry) => entry.customerRef.toLowerCase() === ref)
    .sort((a, b) => a.attempt - b.attempt);
  const sales = snapshot.sales.filter(
    (entry) => entry.customerRef.toLowerCase() === ref,
  );
  const signals = computeSignals(snapshot).filter(
    (signal) => signal.customerRef.toLowerCase() === ref,
  );
  const found = diagnoses.length > 0 || sales.length > 0;
  return (
    <>
      <div className={s.outcome}>
        {found ? (
          <ShieldCheck className={s.successIcon} />
        ) : (
          <SearchX className={s.neutralIcon} />
        )}
        <div>
          <Badge tone={found ? "blue" : "neutral"}>
            {found ? "원장 기록 있음" : OUTCOME_LABELS.missing}
          </Badge>
          <h2>
            진단 {diagnoses.length}회 · 판매 {sales.length}건 · 위험 신호{" "}
            {signals.length}건
          </h2>
          <p>
            고객 가명 ID <code>{customerRef}</code>
          </p>
        </div>
      </div>
      {found && (
        <>
          <DiagnosisTable
            diagnoses={diagnoses}
            snapshot={snapshot}
            caption="진단 회차"
          />
          <h3 className={s.subhead}>판매 건</h3>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">판매 ID</th>
                  <th scope="col">상품</th>
                  <th scope="col">청약 회차</th>
                  <th scope="col">적합</th>
                  <th scope="col">상태</th>
                  <th scope="col">청약 시각</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.saleId}>
                    <td>
                      <Link to={salePath(sale.saleId)}>
                        <code title={sale.saleId}>{short(sale.saleId)}</code>
                      </Link>
                    </td>
                    <td className={s.wrap}>
                      {productName(
                        snapshot,
                        sale.productId,
                        sale.productVersion,
                      )}{" "}
                      v{sale.productVersion}
                    </td>
                    <td>{sale.attempt}회차</td>
                    <td>
                      {sale.suitable ? (
                        "적합"
                      ) : (
                        <Badge tone="warning">부적합</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONES[sale.status]}>
                        {STATUS_LABELS[sale.status]}
                      </Badge>
                    </td>
                    <td>{dateTime(sale.subscribed.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sales.length === 0 && (
            <p className={s.small}>
              청약 기록이 없어요. 가입을 중단해도 진단 회차는 원장에 남아요.
            </p>
          )}
          <h3 className={s.subhead}>위험 신호</h3>
          {signals.length ? (
            <ul className={s.choices}>
              {signals.map((signal, index) => (
                <li key={index}>
                  <Badge tone="warning">{SIGNAL_LABELS[signal.kind]}</Badge>
                  <span className={s.small}>
                    {signal.detail}
                    {signal.saleId ? ` · 판매 ${short(signal.saleId)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.small}>이 고객의 위험 신호가 없어요.</p>
          )}
        </>
      )}
      {!found && (
        <p className={s.intro}>
          이 고객 가명 ID의 진단·판매 기록이 지정한 원장에 없어요.
        </p>
      )}
    </>
  );
}
