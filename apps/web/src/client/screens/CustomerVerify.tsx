import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, SearchX } from "lucide-react";
import type {
  Deployment,
  EvidenceReceipt,
  OriginalBundle,
} from "../../../../../packages/core/src/index.ts";
import type { SaleVerification } from "../../../../../packages/core/src/verify.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import {
  dateTime,
  networkName,
  short,
} from "../../../../../packages/ui/src/format.ts";
import s from "./customer.module.css";

/** 결과 세 가지의 제목과 안내. 화면 문구는 이 셋만 쓴다. */
const OUTCOMES = {
  match: {
    badge: "일치",
    tone: "success",
    title: "가입 기록과 일치해요",
  },
  mismatch: {
    badge: "불일치",
    tone: "warning",
    title: "가입 기록과 일치하지 않아요",
  },
  missing: {
    badge: "기록 없음",
    tone: "neutral",
    title: "이 번호의 가입 기록을 찾지 못했어요",
  },
} as const;
const REFERENCE_NAMES: Record<string, string> = {
  rule: "진단 기준 등록",
  product: "상품 설명서 등록",
  diagnosis: "진단",
  subscribe: "청약",
  confirm: "최종 확인",
  withdraw: "철회",
  settle: "모의 결제",
};

/**
 * 판매 채널 시연의 고객 검증 테스트 화면. 고객이 증명서 번호나 파일로 가입 기록을 확인하는 모습을 보여 준다.
 * 판매사 API를 부르지 않고 브라우저가 지정 RPC로 원장과 대조한다(verifySale). 결과는 일치, 불일치, 기록 없음이다.
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
  const [result, setResult] = useState<SaleVerification>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (file: File | undefined, kind: "receipt" | "original") => {
    setResult(undefined);
    setError("");
    if (kind === "receipt") setReceipt(undefined);
    else setOriginal(undefined);
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("2MB 이하 파일을 골라 주세요.");
      const parsed = JSON.parse(await file.text());
      if (
        parsed?.format !== `finveric-${kind}-v5` ||
        typeof parsed.saleId !== "string"
      )
        throw new Error(
          kind === "receipt"
            ? "가입 증명서 파일을 골라 주세요."
            : "가입 원본 파일을 골라 주세요.",
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
    setResult(undefined);
    setError("");
    try {
      const { verifySale } =
        await import("../../../../../packages/core/src/verify.ts");
      setResult(await verifySale(deployment, saleId, receipt, original));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(
        message.includes("판매 ID 형식")
          ? "증명서 번호를 다시 확인해 주세요. 숫자로만 되어 있어요."
          : message.includes("네트워크") || message.includes("컨트랙트")
            ? "확인 화면의 기록 위치 설정이 달라요. 잠시 후 다시 시도해 주세요."
            : "기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  // 내 가입 기록이나 증명서에서 번호를 넘겨 열면 설정을 받은 뒤 한 번 바로 확인한다.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (!initialId || !deployment || autoChecked.current) return;
    autoChecked.current = true;
    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment]);

  const outcome = result && OUTCOMES[result.outcome];
  const failed = result?.checks.filter((check) => !check.ok) ?? [];
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
                setResult(undefined);
              }}
              placeholder="증명서에 적힌 번호를 넣어 주세요"
            />
          </label>
          <label className={s.field}>
            가입 증명서 파일 (선택)
            <small>가입 후 내려받은 증명서예요.</small>
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
        {result && outcome && (
          <section
            className={`${s.card} ${result.outcome === "match" ? s.match : result.outcome === "mismatch" ? s.mismatch : ""}`}
            aria-live="polite"
          >
            <div className={s.result}>
              <span className={s.icon}>
                {result.outcome === "match" ? (
                  <Check size={22} />
                ) : result.outcome === "mismatch" ? (
                  <AlertTriangle size={22} />
                ) : (
                  <SearchX size={22} />
                )}
              </span>
              <div>
                <Badge tone={outcome.tone}>{outcome.badge}</Badge>
                <h2>{outcome.title}</h2>
                <p>
                  {result.outcome === "match"
                    ? original
                      ? "진단 답변과 설명서까지 가입 당시 기록 그대로 보관돼 있어요."
                      : "가입 기록이 안전하게 보관돼 있어요. 원본 파일을 함께 고르면 진단 답변과 설명서도 확인할 수 있어요."
                    : result.outcome === "mismatch"
                      ? "아래 항목이 가입 당시 기록과 달라요. 받은 서류를 보관하고 판매사나 감독기관에 문의해 주세요."
                      : "증명서 번호를 다시 확인해 주세요. 번호가 맞다면 판매사나 감독기관에 문의해 주세요."}
                </p>
                {result.outcome === "mismatch" && (
                  <ul className={s.items}>
                    {failed.map((check) => (
                      <li key={check.name}>{check.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {result.outcome !== "missing" && (
              <details className={s.tech}>
                <summary>기술 정보 보기</summary>
                <Facts
                  rows={[
                    ["증명서 번호", <code>{result.saleId}</code>],
                    ["네트워크", networkName(deployment)],
                    ["원장 버전", `v${deployment?.ledgerVersion ?? "—"}`],
                    ["컨트랙트", <code>{deployment?.ledger}</code>],
                    ["확인 시각", dateTime(result.verifiedAt)],
                  ]}
                />
                <ul className={s.checks}>
                  {result.checks.map((check) => (
                    <li key={check.name}>
                      <span>
                        {check.name}
                        <small>{check.detail}</small>
                      </span>
                      <span>{check.ok ? "일치" : "불일치"}</span>
                    </li>
                  ))}
                  {result.references.map((reference) => (
                    <li key={`${reference.kind}:${reference.txHash}`}>
                      <span>
                        {REFERENCE_NAMES[reference.kind]}
                        {reference.attempt ? ` ${reference.attempt}회차` : ""} ·
                        블록 {reference.block}
                      </span>
                      <code title={reference.txHash}>
                        {short(reference.txHash)}
                      </code>
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
