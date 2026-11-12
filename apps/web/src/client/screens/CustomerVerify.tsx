import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, SearchX } from "lucide-react";
import type {
  Deployment,
  EvidenceReceipt,
  OriginalBundle,
} from "../../../../../packages/core/src/index.ts";
import type { verifyEvidence } from "../../../../../packages/core/src/verify.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { short } from "../../../../../packages/ui/src/sale.ts";
import s from "./customer.module.css";

/** 원장의 확인 항목을 고객이 읽는 이름으로 바꾼다. */
const itemNames: Record<string, string> = {
  "상품·문서·규칙 버전": "상품 설명서와 진단 기준",
  "진단 증명·전체 회차": "투자성향 진단 기록",
  "고객 원본 무결성": "진단 답변과 설명서 원본",
  "추가 위험 확인": "추가 위험 확인 기록",
  "고객 거래 서명": "가입 확인 서명",
  "고객 모의 서명": "가입 확인 서명",
  "필수 확인 기록": "설명 확인 기록",
  "가입 조건 검증 완료": "가입 확정 기록",
  "검증 영수증 거래 참조": "증명서의 기록 위치",
};
/** 원본 파일이 있어야 확인할 수 있는 항목. */
const needsOriginal = new Set(["고객 원본 무결성", "고객 모의 서명"]);

type Verified = Awaited<ReturnType<typeof verifyEvidence>>;
type Outcome =
  | { kind: "match"; result: Verified; hasOriginal: boolean }
  | { kind: "mismatch"; items: string[]; result?: Verified }
  | { kind: "missing" };

/**
 * 판매 채널 시연의 고객 검증 테스트 화면. 고객이 증명서 번호나 파일로 가입 기록을 확인하는 모습을 보여 준다.
 * 판매사 API를 부르지 않고 브라우저가 지정 RPC로 원장과 대조한다. 결과는 일치, 불일치, 기록 없음 세 가지다.
 */
export function CustomerVerify({
  deployment,
  initialId,
}: {
  deployment?: Deployment;
  initialId: string;
}) {
  const [id, setId] = useState(initialId);
  const [receipt, setReceipt] = useState<EvidenceReceipt>();
  const [original, setOriginal] = useState<OriginalBundle>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const version = `v${deployment?.ledgerVersion ?? deployment?.ruleVersion ?? 1}`;

  const load = async (file: File | undefined, kind: "receipt" | "original") => {
    setOutcome(undefined);
    setError("");
    if (kind === "receipt") setReceipt(undefined);
    else setOriginal(undefined);
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("2MB 이하 파일을 골라 주세요.");
      const parsed = JSON.parse(await file.text());
      if (
        parsed?.format !== `finveric-${kind}-${version}` ||
        typeof parsed.saleId !== "string"
      )
        throw new Error(
          kind === "receipt"
            ? "가입 증명서 파일을 골라 주세요. 이전 버전의 증명서는 감독기관 화면에서 확인해요."
            : "가입 원본 파일을 골라 주세요. 이전 버전의 원본은 감독기관 화면에서 확인해요.",
        );
      if (kind === "receipt") {
        setReceipt(parsed);
        setId(parsed.saleId);
      } else {
        setOriginal(parsed);
        setId((current) => current || parsed.saleId);
      }
    } catch (e) {
      setError(
        e instanceof Error && /^[가-힣0-9]/.test(e.message)
          ? e.message
          : "파일을 읽을 수 없어요. 내려받은 JSON 파일을 골라 주세요.",
      );
    }
  };

  const verify = async () => {
    const saleId = id.trim();
    if (!deployment || !saleId || loading) return;
    setLoading(true);
    setOutcome(undefined);
    setError("");
    try {
      const { verifyEvidence } =
        await import("../../../../../packages/core/src/verify.ts");
      const result = await verifyEvidence(
        deployment,
        saleId,
        receipt,
        original,
      );
      const checked = result.checks.filter(
        (c) => original || !needsOriginal.has(c.name),
      );
      const failed = checked.filter((c) => !c.ok);
      setOutcome(
        failed.length
          ? {
              kind: "mismatch",
              items: failed.map((c) => itemNames[c.name] ?? c.name),
              result,
            }
          : { kind: "match", result, hasOriginal: !!original },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.includes("없는 판매 ID")) setOutcome({ kind: "missing" });
      else if (message.includes("판매 ID 형식"))
        setError("증명서 번호를 다시 확인해 주세요. 숫자로만 되어 있어요.");
      else if (message.includes("영수증") || message.includes("고객 원본"))
        setOutcome({
          kind: "mismatch",
          items: ["증명서나 원본 파일이 이 증명서 번호의 기록과 달라요"],
        });
      else setError("기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 내 가입 기록에서 증명서 번호를 넘겨 열면 설정을 받은 뒤 한 번 바로 확인한다.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (!initialId || !deployment || autoChecked.current) return;
    autoChecked.current = true;
    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment]);

  return (
    <div className={s.page}>
      <div className={s.main}>
        <h1>가입 기록이 그대로인지 확인해요</h1>
        <p className={s.lead}>
          가입할 때 받은 증명서 번호를 넣거나 증명서 파일을 고르세요. 판매사
          서버를 거치지 않고, 여러 기관이 함께 보관하는 기록과 바로 대조해요.
        </p>
        <Notice>
          고객이 가입 기록을 확인하는 모습을 보여 주는 테스트 화면이에요.
        </Notice>
        <form
          className={s.card}
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label className={s.field}>
            증명서 번호
            <input
              type="text"
              inputMode="numeric"
              value={id}
              disabled={loading}
              onChange={(e) => {
                setId(e.target.value);
                setOutcome(undefined);
              }}
              placeholder="증명서에 적힌 번호를 넣어 주세요"
            />
          </label>
          <label className={s.field}>
            가입 증명서 파일 (선택)
            <small>가입 후 내려받은 검증 영수증이에요.</small>
            <input
              type="file"
              accept="application/json,.json"
              disabled={loading}
              onChange={(e) => void load(e.target.files?.[0], "receipt")}
            />
          </label>
          <label className={s.field}>
            가입 원본 파일 (선택)
            <small>함께 고르면 진단 답변과 설명서까지 확인해요.</small>
            <input
              type="file"
              accept="application/json,.json"
              disabled={loading}
              onChange={(e) => void load(e.target.files?.[0], "original")}
            />
          </label>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button
            className={s.submit}
            type="submit"
            disabled={!deployment || !id.trim() || loading}
          >
            {loading ? (
              <>
                <LoaderCircle size={17} />
                기록을 확인하고 있어요
              </>
            ) : (
              "확인하기"
            )}
          </Button>
        </form>
        {outcome && (
          <section
            className={`${s.card} ${outcome.kind === "match" ? s.match : outcome.kind === "mismatch" ? s.mismatch : ""}`}
            aria-live="polite"
          >
            <div className={s.result}>
              <span className={s.icon}>
                {outcome.kind === "match" ? (
                  <Check size={22} />
                ) : outcome.kind === "mismatch" ? (
                  <AlertTriangle size={22} />
                ) : (
                  <SearchX size={22} />
                )}
              </span>
              <div>
                <Badge
                  tone={
                    outcome.kind === "match"
                      ? "success"
                      : outcome.kind === "mismatch"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {outcome.kind === "match"
                    ? "일치"
                    : outcome.kind === "mismatch"
                      ? "불일치"
                      : "기록 없음"}
                </Badge>
                <h2>
                  {outcome.kind === "match"
                    ? "가입 기록과 일치해요"
                    : outcome.kind === "mismatch"
                      ? "가입 기록과 일치하지 않아요"
                      : "이 번호의 가입 기록을 찾지 못했어요"}
                </h2>
                <p>
                  {outcome.kind === "match"
                    ? outcome.hasOriginal
                      ? "진단 답변과 설명서까지 가입 당시 기록 그대로 보관돼 있어요."
                      : "가입 기록이 안전하게 보관돼 있어요. 원본 파일을 함께 고르면 진단 답변과 설명서도 확인할 수 있어요."
                    : outcome.kind === "mismatch"
                      ? "아래 항목이 가입 당시 기록과 달라요. 받은 서류를 보관하고 판매사나 감독기관에 문의해 주세요."
                      : "증명서 번호를 다시 확인해 주세요. 번호가 맞다면 판매사나 감독기관에 문의해 주세요."}
                </p>
                {outcome.kind === "mismatch" && (
                  <ul className={s.items}>
                    {outcome.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {outcome.kind !== "missing" && outcome.result && (
              <details className={s.tech}>
                <summary>기술 정보 보기</summary>
                <Facts
                  rows={[
                    ["증명서 번호", <code>{outcome.result.saleId}</code>],
                    [
                      "네트워크",
                      deployment?.chainId === 11155111
                        ? "Sepolia 테스트넷"
                        : "Anvil 테스트 원장",
                    ],
                    ["원장 버전", version],
                    ["컨트랙트", <code>{deployment?.ledger}</code>],
                  ]}
                />
                <ul className={s.checks}>
                  {outcome.result.checks.map((c) => (
                    <li key={c.name}>
                      <span>{itemNames[c.name] ?? c.name}</span>
                      <span>
                        {!original && needsOriginal.has(c.name)
                          ? "원본 필요"
                          : c.ok
                            ? "일치"
                            : "불일치"}
                      </span>
                    </li>
                  ))}
                  {outcome.result.procedureReferences.map((r) => (
                    <li key={`${r.kind}:${r.txHash}`}>
                      <span>기록 거래 · 블록 {r.block}</span>
                      <code title={r.txHash}>{short(r.txHash)}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
