import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  Check,
  FileText,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type {
  Deployment,
  EvidenceReceipt,
  OriginalBundle,
} from "../../../../packages/core/src/index.ts";
import type { verifyEvidence } from "../../../../packages/core/src/verify.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import { api } from "../../../../packages/ui/src/api.ts";
import {
  AccessCodeForm,
  Badge,
  Facts,
  FundFilter,
  Heading,
  Notice,
  TransactionFacts,
} from "../../../../packages/ui/src/components.tsx";
import {
  getProduct,
  procedureLabels,
  profileName,
  saleProduct,
  saleProductName,
  short,
  type Sale,
} from "../../../../packages/ui/src/sale.ts";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./verify.module.css";

const s = { ...ui, ...local };

export function Independent({
  deployment,
  initialId,
  source,
}: {
  deployment?: Deployment;
  initialId: string;
  source: "history" | "file";
}) {
  const [id, setId] = useState(initialId);
  const [history, setHistory] = useState<
    | { status: "loading" }
    | { status: "ready"; sales: Sale[] }
    | { status: "error"; requiresToken: boolean }
  >({ status: "loading" });
  const [historyRequest, setHistoryRequest] = useState(0);
  const [historyProduct, setHistoryProduct] = useState("");
  const [receipt, setReceipt] = useState<EvidenceReceipt>();
  const [original, setOriginal] = useState<OriginalBundle>();
  const [result, setResult] = useState<
    Awaited<ReturnType<typeof verifyEvidence>> & {
      deployment: Deployment;
      hasOriginal: boolean;
    }
  >();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({});
  const fromHistory = source === "history";
  const historySales = history.status === "ready" ? history.sales : [];
  const filteredHistory = historySales.filter(
    (sale) => !historyProduct || saleProduct(sale)?.id === historyProduct,
  );
  const selectedHistory = filteredHistory.find((sale) => sale.id === id);
  const saleId = fromHistory ? selectedHistory?.id : id.trim();
  const displayedDeployment = result?.deployment ?? deployment;
  const procedureTransactions = new Map<
    string,
    { block: string; labels: string[] }
  >();
  for (const entry of result?.procedureReferences ?? []) {
    const current = procedureTransactions.get(entry.txHash);
    const label = procedureLabels[entry.kind];
    if (current) current.labels.push(label);
    else
      procedureTransactions.set(entry.txHash, {
        block: entry.block,
        labels: [label],
      });
  }
  useEffect(() => {
    if (!fromHistory) return;
    let active = true;
    setHistory({ status: "loading" });
    api<Sale[]>("/sales")
      .then((sales) => {
        if (active)
          setHistory({
            status: "ready",
            sales: sales.filter((sale) => sale.state.finalized),
          });
      })
      .catch(async () => {
        if (!active) return;
        const config = await api<{ requiresToken: boolean }>("/config").catch(
          () => undefined,
        );
        if (active)
          setHistory({
            status: "error",
            requiresToken: !!config?.requiresToken,
          });
      });
    return () => {
      active = false;
    };
  }, [fromHistory, historyRequest]);
  const retryHistory = () => setHistoryRequest((current) => current + 1);
  const load = async (file: File | undefined, kind: "receipt" | "original") => {
    if (!file) return;
    setResult(undefined);
    setError("");
    if (kind === "receipt") setReceipt(undefined);
    else setOriginal(undefined);
    setFiles((current) => ({ ...current, [kind]: "" }));
    if (file.size > 2_000_000) {
      setError("2MB 이하 JSON 파일을 선택해 주세요.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (
        ![
          `finveric-${kind}-v1`,
          `finveric-${kind}-v2`,
          `finveric-${kind}-v3`,
          `finveric-${kind}-v4`,
        ].includes(parsed?.format) ||
        typeof parsed.saleId !== "string"
      )
        throw new Error(
          kind === "receipt"
            ? "검증 영수증 파일을 선택해 주세요."
            : "가입 원본 파일을 선택해 주세요.",
        );
      if (kind === "receipt") {
        setReceipt(parsed);
        setId(parsed.saleId);
      } else {
        setOriginal(parsed);
        setId((current) => current || parsed.saleId);
      }
      setFiles((f) => ({ ...f, [kind]: file.name }));
    } catch (e) {
      setError(
        e instanceof Error && /^[가-힣]/.test(e.message)
          ? e.message
          : "파일을 읽을 수 없어요. 내려받은 JSON 파일을 선택해 주세요.",
      );
    }
  };
  const verify = async () => {
    if (!deployment || !saleId || loading) return;
    setLoading(true);
    setResult(undefined);
    setError("");
    try {
      let evidence = receipt;
      let witness = original;
      if (fromHistory) {
        try {
          [evidence, witness] = await Promise.all([
            api<EvidenceReceipt>(`/sales/${saleId}/export/receipt`),
            api<OriginalBundle>(`/sales/${saleId}/export/original`),
          ]);
        } catch {
          throw new Error(
            "선택한 가입 건의 서류를 불러오지 못했어요. 다시 시도하거나 저장한 파일로 검증해 주세요.",
          );
        }
      }
      const receiptVersion = evidence?.format.slice(-2);
      const originalVersion = witness?.format.slice(-2);
      if (
        receiptVersion &&
        originalVersion &&
        receiptVersion !== originalVersion
      )
        throw new Error(
          "같은 신청에서 받은 가입 원본과 영수증을 선택해 주세요.",
        );
      let target = deployment;
      const fileVersion = receiptVersion ?? originalVersion;
      const currentVersion = `v${deployment.ledgerVersion ?? deployment.ruleVersion ?? 1}`;
      if (!fromHistory && fileVersion && fileVersion !== currentVersion) {
        if (
          fileVersion !== "v1" &&
          fileVersion !== "v2" &&
          fileVersion !== "v3"
        )
          throw new Error("이 가입 서류에 맞는 검증 설정을 찾지 못했어요.");
        const response = await fetch(`/deployment-${fileVersion}.json`);
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw new Error("이전 원장의 검증 설정을 불러올 수 없어요.");
        target = (await response.json()) as Deployment;
      }
      const { verifyEvidence } =
        await import("../../../../packages/core/src/verify.ts");
      setResult({
        ...(await verifyEvidence(target, saleId, evidence, witness)),
        deployment: target,
        hasOriginal: !!witness,
      });
    } catch (e) {
      setError(
        e instanceof Error && /^[가-힣]/.test(e.message)
          ? e.message
          : "블록체인 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Heading
        title="가입 기록 검증"
        description="가입 이력을 선택하거나 저장한 파일을 열어 블록체인 기록과 대조할 수 있어요."
      />
      <nav aria-label="검증 자료 선택" className={s.actions}>
        <Button variant={fromHistory ? "default" : "outline"} asChild>
          <Link
            to={
              initialId && fromHistory
                ? `/?sale=${encodeURIComponent(initialId)}`
                : "/"
            }
            aria-current={fromHistory ? "page" : undefined}
          >
            가입 이력에서 선택
          </Link>
        </Button>
        <Button variant={fromHistory ? "outline" : "default"} asChild>
          <Link
            to="/?source=file"
            aria-current={!fromHistory ? "page" : undefined}
          >
            파일로 검증
          </Link>
        </Button>
      </nav>
      <Notice>
        {fromHistory
          ? "선택한 가입 건의 원본과 영수증을 판매사에서 받아 이 브라우저에서 검증해요."
          : "저장한 파일은 이 브라우저에서 읽어요. 판매사에서 서류를 다시 받지 않아도 검증할 수 있어요."}
      </Notice>
      {fromHistory && history.status === "error" && history.requiresToken && (
        <AccessCodeForm connect={retryHistory} busy={false} />
      )}
      <div className={s.verifyGrid}>
        <form
          className={`${s.panel} ${s.pad}`}
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          onReset={() => {
            setReceipt(undefined);
            setOriginal(undefined);
            setFiles({});
            setResult(undefined);
            setError("");
          }}
        >
          <h2>검증할 기록</h2>
          {fromHistory ? (
            <>
              {history.status === "loading" ? (
                <p role="status">가입 이력을 불러오고 있어요.</p>
              ) : history.status === "error" ? (
                <>
                  <p role="alert">
                    {history.requiresToken
                      ? "가입 이력을 보려면 시연 접근 코드를 확인해 주세요."
                      : "가입 이력을 불러오지 못했어요. 다시 불러오거나 저장한 파일로 검증해 주세요."}
                  </p>
                  {!history.requiresToken && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={retryHistory}
                    >
                      다시 불러오기
                    </Button>
                  )}
                </>
              ) : historySales.length === 0 ? (
                <p>
                  아직 가입 기록이 없어요. 저장한 서류가 있다면 파일로 검증할 수
                  있어요.
                </p>
              ) : (
                <>
                  <FundFilter
                    value={historyProduct}
                    disabled={loading}
                    change={(productId) => {
                      setHistoryProduct(productId);
                      if (
                        productId &&
                        saleProduct(selectedHistory)?.id !== productId
                      ) {
                        setId("");
                        setResult(undefined);
                        setError("");
                      }
                    }}
                  />
                  {filteredHistory.length === 0 && (
                    <p>
                      이 펀드의 가입 기록이 없어요. 다른 펀드를 선택해 주세요.
                    </p>
                  )}
                  <label className={s.field}>
                    가입 신청 선택
                    <select
                      value={selectedHistory?.id ?? ""}
                      disabled={loading || filteredHistory.length === 0}
                      onChange={(e) => {
                        setId(e.target.value);
                        setResult(undefined);
                        setError("");
                      }}
                    >
                      <option value="">가입 신청을 선택해 주세요</option>
                      {filteredHistory.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {saleProductName(sale)} · {sale.id.slice(-6)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {id && !selectedHistory && (
                    <p>
                      이력에서 해당 가입 신청을 찾을 수 없어요. 목록에서 선택해
                      주세요.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <label className={s.field}>
                가입 신청 번호
                <input
                  className={s.breakWord}
                  value={id}
                  disabled={loading}
                  onChange={(e) => {
                    setId(e.target.value);
                    setResult(undefined);
                  }}
                  placeholder="가입 신청 번호를 입력하세요"
                />
              </label>
              <label className={s.upload}>
                검증 영수증 선택
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="검증 영수증 파일"
                  disabled={loading}
                  onChange={(e) => void load(e.target.files?.[0], "receipt")}
                />
              </label>
              <label className={s.upload}>
                가입 원본 선택
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="가입 원본 파일"
                  disabled={loading}
                  onChange={(e) => void load(e.target.files?.[0], "original")}
                />
              </label>
              {Object.values(files)
                .filter(Boolean)
                .map((f, i) => (
                  <p className={`${s.small} ${s.breakWord}`} key={i}>
                    {f}
                  </p>
                ))}
            </>
          )}
          <Button type="submit" disabled={!deployment || !saleId || loading}>
            {loading ? (
              <>
                <LoaderCircle className={s.spin} size={16} />
                블록체인 기록 확인 중
              </>
            ) : (
              <>
                기록 검증하기
                <ShieldCheck size={17} />
              </>
            )}
          </Button>
          {!fromHistory && (
            <Button variant="ghost" type="reset" disabled={loading}>
              선택한 파일 비우기
            </Button>
          )}
        </form>
        <section className={`${s.panel} ${s.pad}`}>
          <h2>검증 결과</h2>
          {error && (
            <div role="alert">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          {result ? (
            <div>
              <h3>
                {getProduct(result.state.productId)?.document.name ??
                  "가입 상품"}
              </h3>
              {result.checks.map((c) => {
                const signature = c.name === "고객 모의 서명";
                const enrollmentSignature = c.name === "고객 거래 서명";
                const originalIntegrity = c.name === "고객 원본 무결성";
                const needsOriginal =
                  (signature || originalIntegrity) && !result.hasOriginal;
                return (
                  <div className={s.checkResult} key={c.name}>
                    {needsOriginal ? (
                      <FileText />
                    ) : c.ok ? (
                      <Check className={s.successIcon} />
                    ) : (
                      <AlertTriangle className={s.warningIcon} />
                    )}
                    <div>
                      <strong>
                        {enrollmentSignature
                          ? "가입 거래 서명"
                          : signature
                            ? "서명 검증"
                            : originalIntegrity
                              ? "가입 원본 확인"
                              : c.name}
                      </strong>
                      <p>
                        {needsOriginal
                          ? "가입 원본 파일을 선택하면 확인할 수 있어요."
                          : signature
                            ? "테스트 서명, 서명에 사용한 계정, 원장에 기록한 서명 해시를 대조했어요."
                            : originalIntegrity
                              ? "진단 답변과 설명서가 가입 당시 기록과 일치하는지 확인했어요."
                              : c.detail}
                      </p>
                    </div>
                    <Badge
                      tone={
                        needsOriginal ? "neutral" : c.ok ? "success" : "warning"
                      }
                    >
                      {needsOriginal
                        ? "원본 필요"
                        : c.ok
                          ? "확인 완료"
                          : "확인 필요"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={s.intro}>
              {fromHistory
                ? "가입 신청을 선택하고 기록 검증하기를 눌러 주세요."
                : "가입 신청 번호를 입력하거나 가입 서류를 선택해 주세요. 원본 파일이 있으면 진단 답변도 대조할 수 있어요."}
            </p>
          )}
          {procedureTransactions.size > 0 && (
            <>
              <h3>블록체인 기록</h3>
              {[...procedureTransactions].map(([hash, entry]) => (
                <div key={hash}>
                  <strong>{entry.labels.join(" · ")}</strong>
                  <TransactionFacts hash={hash} block={entry.block} />
                </div>
              ))}
            </>
          )}
          <h3>검증에 사용한 네트워크</h3>
          <Facts
            rows={[
              [
                "네트워크",
                displayedDeployment
                  ? displayedDeployment.chainId === 11155111
                    ? "Sepolia (11155111)"
                    : "Anvil (31337)"
                  : "설정 대기",
              ],
              [
                "가입 원장",
                displayedDeployment
                  ? `v${displayedDeployment.ledgerVersion ?? displayedDeployment.ruleVersion ?? 1}`
                  : "설정 대기",
              ],
              [
                "진단 기준",
                displayedDeployment
                  ? `v${displayedDeployment.ruleVersion ?? 1}`
                  : "설정 대기",
              ],
              [
                "RPC",
                <code>{displayedDeployment?.rpcUrl ?? "설정 대기"}</code>,
              ],
              [
                "컨트랙트",
                <code>{displayedDeployment?.ledger ?? "설정 대기"}</code>,
              ],
            ]}
          />
          {!!result?.references.length && (
            <div className={s.tableWrap}>
              <table>
                <caption>블록체인에서 확인한 진단 거래</caption>
                <thead>
                  <tr>
                    <th>회차</th>
                    <th>진단 결과</th>
                    <th>블록</th>
                    <th>거래</th>
                  </tr>
                </thead>
                <tbody>
                  {result.references.map((r) => (
                    <tr key={r.round}>
                      <td>{r.round}</td>
                      <td>
                        {r.legacyPassed === undefined
                          ? profileName(r.profile)
                          : r.legacyPassed
                            ? "조건 충족"
                            : "조건 미충족"}
                      </td>
                      <td>{r.block}</td>
                      <td>
                        <code title={r.txHash}>{short(r.txHash)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
