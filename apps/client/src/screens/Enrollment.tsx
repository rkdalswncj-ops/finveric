import { useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Hex } from "viem";
import {
  classifyProfile,
  diagnosisCommitment,
  type Answers,
  type Deployment,
  type PreparedProof,
} from "../../../../packages/core/src/index.ts";
import type {
  ConfirmRequest,
  DiagnoseDto,
  DiagnoseRequest,
  Wire,
} from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import { api } from "../../../../packages/ui/src/api.ts";
import {
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../packages/ui/src/components.tsx";
import {
  finalProfile,
  profileName,
  saleProduct,
  won,
  type Sale,
} from "../../../../packages/ui/src/sale.ts";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import { Empty, FundDisclosure, History } from "../components.tsx";
import { channel, draftProofKey } from "../links.ts";

const s = { ...ui, ...local };
const questions = [
  {
    label: "감당할 수 있는 손실",
    title: "투자 손실을 얼마나 감당할 수 있나요?",
    choices: [
      "손실을 감당하기 어려워요",
      "일부 손실은 감당할 수 있어요",
      "큰 손실도 감당할 수 있어요",
    ],
  },
  {
    label: "투자 경험",
    title: "어떤 투자 경험이 있나요?",
    choices: [
      "투자 경험이 없어요",
      "펀드에 투자해 봤어요",
      "여러 위험자산에 투자해 봤어요",
    ],
  },
];
const resultStep = questions.length + 1;
type Run = (name: string, op?: () => Promise<unknown>) => Promise<void>;
type VerifiedDraft = {
  round: number;
  commitment: string;
  profile: number;
  ledger: string;
  productId: Hex;
};
type WirePreparedProof = Wire<PreparedProof>;
type UnverifiedDraft = VerifiedDraft & { proof: WirePreparedProof };

function loadVerifiedDraft(id: string): VerifiedDraft | undefined {
  try {
    const value = sessionStorage.getItem(draftProofKey(id));
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}

function toPreparedProof({
  a,
  b,
  c,
  signals,
}: WirePreparedProof): PreparedProof {
  return {
    a: [BigInt(a[0]), BigInt(a[1])],
    b: [
      [BigInt(b[0][0]), BigInt(b[0][1])],
      [BigInt(b[1][0]), BigInt(b[1][1])],
    ],
    c: [BigInt(c[0]), BigInt(c[1])],
    signals: [
      BigInt(signals[0]),
      BigInt(signals[1]),
      BigInt(signals[2]),
      BigInt(signals[3]),
      BigInt(signals[4]),
      BigInt(signals[5]),
      BigInt(signals[6]),
      BigInt(signals[7]),
    ],
  };
}

export function Enrollment({
  sale,
  deployment,
  busy,
  run,
  abandon,
  markEnrolled,
}: {
  sale?: Sale;
  deployment?: Deployment;
  busy: boolean;
  run: Run;
  abandon: () => unknown;
  markEnrolled: (id: string) => void;
}) {
  const [verified, setVerified] = useState(() =>
    sale ? loadVerifiedDraft(sale.id) : undefined,
  );
  const [unverified, setUnverified] = useState<UnverifiedDraft>();
  const draftRequest = useRef<{ salt: string; round: number }>(undefined);
  const [step, setStep] = useState(
    verified || sale?.state.finalized || sale?.submissionPending
      ? resultStep
      : 0,
  );
  const [answers, setAnswers] = useState<(number | null)[]>([null, null]);
  const [explanationAcceptedRound, setExplanationAcceptedRound] =
    useState<number>();
  const [higherRiskAcceptedRound, setHigherRiskAcceptedRound] =
    useState<number>();
  const product = saleProduct(sale);
  if (!sale || !product)
    return (
      <>
        <Heading
          title={
            sale
              ? "가입 상품을 확인하지 못했어요"
              : "가입할 상품을 먼저 확인해 주세요"
          }
          description="상품 상세에서 위험과 비용을 확인할 수 있어요."
        />
        <Empty>
          <Button asChild>
            <Link to={channel.catalog}>펀드 목록 보기</Link>
          </Button>
        </Empty>
      </>
    );
  const { document, minimumProfile } = product;
  const latest = sale.attempts.at(-1);
  const currentProof =
    verified &&
    deployment?.ledger === verified.ledger &&
    product.id === verified.productId &&
    latest?.round === verified.round &&
    latest.commitment === verified.commitment &&
    latest.profile === verified.profile
      ? verified
      : undefined;
  const profile = sale.state.finalized
    ? finalProfile(sale)
    : currentProof?.profile;
  const round = currentProof?.round;
  const needsHigherRisk = profile !== undefined && profile < minimumProfile;
  const needsReview = sale.attempts.length >= 3 && !sale.state.reviewed;
  const submitting = !!sale.submissionPending;
  const explanationAccepted =
    round !== undefined && explanationAcceptedRound === round;
  const higherRiskAccepted =
    round !== undefined && higherRiskAcceptedRound === round;
  const visibleStep = sale.state.finalized || submitting ? resultStep : step;
  const question = questions[visibleStep];
  const submit = () =>
    run("투자성향 증명을 확인하고 있어요", async () => {
      if (!deployment)
        throw new Error("원장 설정을 불러온 뒤 다시 시도해 주세요.");
      let pending = unverified;
      if (!pending) {
        const [loss, experience] = answers;
        if (loss === null || experience === null) return;
        const response: Answers = { loss, experience };
        if (!draftRequest.current) {
          const random = crypto.getRandomValues(new Uint8Array(31));
          const hex = Array.from(random, (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          draftRequest.current = {
            salt: (BigInt(`0x${hex}`) + 1n).toString(),
            round: sale.attempts.length + 1,
          };
        }
        const { salt, round: expectedRound } = draftRequest.current;
        const draft = await api<DiagnoseDto>(`/sales/${sale.id}/diagnose`, {
          ...response,
          salt,
        } satisfies DiagnoseRequest);
        const attempt = draft.attempts.at(-1);
        if (
          !attempt ||
          draft.id !== sale.id ||
          saleProduct(draft)?.id !== product.id ||
          attempt.round !== expectedRound
        )
          throw new Error("가입 초안의 진단을 확인하지 못했어요.");
        const commitment = diagnosisCommitment(response, salt, {
          chainId: deployment.chainId,
          ledger: deployment.ledger,
          id: sale.id,
          round: attempt.round,
          documentHash: product.documentHash,
        }).toString();
        const profile = classifyProfile(response);
        if (attempt.commitment !== commitment || attempt.profile !== profile)
          throw new Error(
            "내가 제출한 답변과 받은 진단 결과가 일치하지 않아요.",
          );
        pending = {
          round: attempt.round,
          commitment,
          profile,
          ledger: deployment.ledger,
          productId: product.id,
          proof: draft.preparedProof,
        };
        setUnverified(pending);
      }
      const { verifyPreparedDiagnosis } =
        await import("../../../../packages/core/src/verify.ts");
      const checked = await verifyPreparedDiagnosis(
        deployment,
        sale.id,
        pending.round,
        pending.commitment,
        toPreparedProof(pending.proof),
        product,
      );
      if (checked !== pending.profile)
        throw new Error("받은 증명이 내가 제출한 답변과 일치하지 않아요.");
      const verifiedDraft = {
        round: pending.round,
        commitment: pending.commitment,
        profile: pending.profile,
        ledger: pending.ledger,
        productId: pending.productId,
      };
      sessionStorage.setItem(
        draftProofKey(sale.id),
        JSON.stringify(verifiedDraft),
      );
      setVerified(verifiedDraft);
      setUnverified(undefined);
      draftRequest.current = undefined;
      setStep(resultStep);
    });
  const confirm = () => {
    if (!currentProof) return;
    void run("가입 기록을 원장에서 확인하고 있어요", async () => {
      await api(`/sales/${sale.id}/confirm`, {
        round: currentProof.round,
        commitment: currentProof.commitment,
        profile: currentProof.profile,
        explanationAccepted: true,
        higherRiskAccepted: needsHigherRisk && higherRiskAccepted,
      } satisfies ConfirmRequest);
      markEnrolled(sale.id);
      setVerified(undefined);
    });
  };
  return (
    <>
      <Heading
        title="펀드 가입 절차를 체험해요"
        description={`${document.name} · ${won(sale.amount)} · ${document.class}`}
      />
      <div className={s.enrollGrid}>
        <section className={`${s.panel} ${s.formPanel}`}>
          <div
            className={s.progress}
            aria-label={`가입 절차 ${visibleStep + 1}/${resultStep + 1}`}
          >
            {Array.from({ length: resultStep + 1 }, (_, i) => (
              <span
                key={i}
                className={i <= visibleStep ? s.progressActive : ""}
              />
            ))}
          </div>
          {question ? (
            <>
              <p className={s.small}>
                {`${sale.attempts.length ? "재진단" : "진단"} ${sale.attempts.length + 1}회차 · ${visibleStep + 1}/${questions.length} 문항`}
              </p>
              <h2>{question.title}</h2>
              <p className={s.intro}>가상 상황에 맞는 답변을 골라 주세요.</p>
              <fieldset className={s.choices}>
                <legend className={s.srOnly}>{question.label}</legend>
                {question.choices.map((label, i) => (
                  <label className={s.choice} key={label}>
                    <input
                      type="radio"
                      name={`question${step}`}
                      checked={answers[step] === i}
                      onChange={() => {
                        draftRequest.current = undefined;
                        setUnverified(undefined);
                        setAnswers((a) =>
                          a.map((v, j) => (j === step ? i : v)),
                        );
                      }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className={s.formActions}>
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    <ArrowLeft size={16} />
                    이전
                  </Button>
                )}
                <Button
                  size="large"
                  disabled={answers[step] === null || busy}
                  onClick={() => setStep(step + 1)}
                >
                  {step + 1 === questions.length ? "답변 확인하기" : "다음"}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </>
          ) : visibleStep === questions.length ? (
            <>
              <h2>진단 전에 답변을 확인해 주세요</h2>
              <Facts
                rows={questions.map(({ label, choices }, i) => [
                  label,
                  choices[answers[i]!],
                ])}
              />
              <Notice>
                시연 서비스가 답변을 받아 진단 증명을 만들어요. 가입을 완료할 때
                투자성향과 확인 내역을 한 거래에 남겨요. 답변과 총점은 원장에
                올리지 않아요.
              </Notice>
              <div className={s.formActions}>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  이전
                </Button>
                <Button
                  size="large"
                  disabled={busy || !deployment}
                  onClick={submit}
                >
                  {unverified
                    ? "진단 증명 다시 확인하기"
                    : "이 답변으로 진단하기"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Badge
                tone={
                  sale.state.finalized || currentProof ? "success" : "neutral"
                }
              >
                {sale.state.finalized
                  ? "원장 기록 확인"
                  : currentProof
                    ? "진단 증명 확인"
                    : "진단 확인 대기"}
              </Badge>
              <h2>
                {sale.state.finalized
                  ? "가입 조건 검증을 완료했어요"
                  : profile === undefined
                    ? "아직 이 진단을 확인하지 못했어요"
                    : `내 투자성향은 ${profileName(profile)}이에요`}
              </h2>
              {sale.state.finalized && (
                <p className={s.intro}>
                  내 가입 기록에서 확인 내역과 증빙 파일을 볼 수 있어요.
                </p>
              )}
              {needsReview && (
                <Notice tone="warning">
                  세 번째 진단부터 준법 담당자의 검토를 받아야 가입할 수 있어요.
                </Notice>
              )}
              {submitting && (
                <Notice>
                  가입 거래를 제출했어요. 원장 기록을 확인하고 있어요.
                </Notice>
              )}
              <Facts
                rows={[
                  ["진단 회차", `${sale.attempts.length}회차`],
                  ["위험등급", document.risk],
                  ["시연 기준 성향", profileName(minimumProfile)],
                  [
                    "설명서",
                    `${document.version} · 원금 손실 가능 · 연 보수 ${document.annualFee}`,
                  ],
                  [
                    "원장 기록",
                    sale.state.finalized
                      ? "완료"
                      : submitting
                        ? "확인 중"
                        : "가입 후 기록",
                  ],
                ]}
              />
              {currentProof && !sale.state.finalized && (
                <>
                  <FundDisclosure document={document} />
                  <label className={s.choice}>
                    <input
                      type="checkbox"
                      disabled={busy || submitting}
                      checked={explanationAccepted}
                      onChange={(e) =>
                        setExplanationAcceptedRound(
                          e.target.checked ? round : undefined,
                        )
                      }
                    />
                    상품 설명서 {document.version}에서 원금 손실 가능성과 비용을
                    확인했어요. 내가 고른 답변도 확인했어요.
                  </label>
                  {needsHigherRisk && (
                    <>
                      <Notice tone="warning">
                        이 펀드는 {document.risk} 상품이에요. 시연 기준에서 내
                        투자성향보다 위험이 높아요.
                      </Notice>
                      <label className={s.choice}>
                        <input
                          type="checkbox"
                          disabled={busy || submitting}
                          checked={higherRiskAccepted}
                          onChange={(e) =>
                            setHigherRiskAcceptedRound(
                              e.target.checked ? round : undefined,
                            )
                          }
                        />
                        내 투자성향보다 위험이 높다는 점을 확인했어요. 가입 권유
                        없이 내 판단으로 진행해요.
                      </label>
                    </>
                  )}
                  <p className={s.small}>
                    시연 서비스가 고객 역할의 테스트 키로 서명해요. 진단 증명과
                    확인 내역을 한 거래에 기록해요.
                  </p>
                  <Button
                    size="large"
                    disabled={
                      busy ||
                      submitting ||
                      needsReview ||
                      !explanationAccepted ||
                      (needsHigherRisk && !higherRiskAccepted)
                    }
                    onClick={confirm}
                  >
                    확인하고 가입하기
                  </Button>
                </>
              )}
              {(needsReview || submitting) && !sale.state.finalized && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run("가입 상태를 확인하고 있어요")}
                >
                  상태 다시 확인하기
                </Button>
              )}
              {!sale.state.finalized && (
                <Button
                  variant="ghost"
                  disabled={busy || submitting}
                  onClick={() => {
                    setAnswers([null, null]);
                    draftRequest.current = undefined;
                    setVerified(undefined);
                    setUnverified(undefined);
                    sessionStorage.removeItem(draftProofKey(sale.id));
                    setExplanationAcceptedRound(undefined);
                    setHigherRiskAcceptedRound(undefined);
                    setStep(0);
                  }}
                >
                  답변 정정하기
                </Button>
              )}
              {sale.state.finalized && (
                <Button variant="outline" asChild>
                  <Link to={channel.records}>내 가입 기록 보기</Link>
                </Button>
              )}
            </>
          )}
          {!sale.state.finalized && (
            <Button
              variant="ghost"
              disabled={busy || submitting}
              onClick={abandon}
            >
              가입 중단하기
            </Button>
          )}
        </section>
        <aside className={`${s.panel} ${s.pad}`}>
          <h3>지금까지의 진단</h3>
          {sale.attempts.length ? (
            <History sale={sale} />
          ) : (
            <p className={s.small}>아직 진단 기록이 없어요.</p>
          )}
          <Notice>
            가입 절차를 체험하는 화면이에요. 실제 투자는 진행하지 않아요.
          </Notice>
          <code className={s.breakWord}>가입 신청 번호 {sale.id}</code>
        </aside>
      </div>
    </>
  );
}
