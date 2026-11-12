import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Download,
  LoaderCircle,
} from "lucide-react";
import {
  isProtectedSale,
  isSuitable,
  type Deployment,
} from "../../../../../packages/core/src/index.ts";
import type {
  CustomerDto,
  DiagnoseRequest,
  DiagnosisDto,
  ExportKind,
  ProductEntryDto,
  RuleEntryDto,
  SaleAction,
  SaleDto,
  SubscribeRequest,
} from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import { api } from "../../../../../packages/ui/src/api.ts";
import {
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { dateTime, won } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import type { Run } from "../App.tsx";
import { Empty } from "../components.tsx";
import { channel, verifyPath } from "../links.ts";
import {
  activeRule,
  confirmedTrace,
  gradeName,
  limitRange,
  nowSeconds,
  productName,
  profileName,
  saleProduct,
  type Sale,
} from "../sales.ts";

const s = { ...ui, ...local };

type Phase =
  | "start"
  | "question"
  | "result"
  | "suitability"
  | "cards"
  | "recording"
  | "subscribe";
/** 청약 전 단계의 화면 상태. 다른 메뉴(판매·검토의 관리자 승인)를 다녀와도 이어지게 세션에 보관한다. */
type Flow = {
  phase: Phase;
  question: number;
  answers: (number | null)[];
  card: number;
  explanationMs: number;
  cardsRead: boolean;
  higherRisk: boolean;
  consent: boolean;
};
const STEPS = ["진단", "적합성", "설명", "청약", "최종 확인"];
const stepOf = (phase: Phase) =>
  ({
    start: 0,
    question: 0,
    result: 0,
    suitability: 1,
    cards: 2,
    recording: 2,
    subscribe: 3,
  })[phase];
const flowKey = (id: string) => `finveric-enroll:${id}`;

function loadFlow(id: string, initial: Flow): Flow {
  try {
    const value = sessionStorage.getItem(flowKey(id));
    return value ? { ...initial, ...JSON.parse(value) } : initial;
  } catch {
    return initial;
  }
}

/** 1초마다 지금 시각(초)을 갱신한다. 숙려 남은 시간 표시에 쓴다. */
function useNow(active: boolean) {
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(nowSeconds()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function Steps({ current }: { current: number }) {
  return (
    <ol className={s.steps} aria-label="가입 단계">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className={index <= current ? s.stepDone : ""}
          aria-current={index === current ? "step" : undefined}
        >
          <span />
          {step}
        </li>
      ))}
    </ol>
  );
}

/**
 * 판매 채널 시연의 가입 절차. 증권사 앱에서 고객이 보는 화면이다.
 * 진단(회차마다 원장 기록) → 결과 → 적합성 → 핵심 설명 카드 5장 → 녹취 동의 → 청약 → 숙려 → 최종 확인 → 증명서.
 */
export function Enrollment({
  loaded,
  sale,
  rules,
  products,
  customer,
  deployment,
  busy,
  run,
  action,
  abandon,
  refresh,
  download,
  finish,
}: {
  loaded: boolean;
  sale?: Sale;
  rules: RuleEntryDto[];
  products: ProductEntryDto[];
  customer?: CustomerDto;
  deployment?: Deployment;
  busy: boolean;
  run: Run;
  action: (id: string, name: SaleAction, label: string) => unknown;
  abandon: () => unknown;
  refresh: () => unknown;
  download: (id: string, kind: ExportKind) => unknown;
  finish: () => void;
}) {
  const rule = activeRule(rules)?.document;
  const diagnoses = customer?.diagnoses ?? [];
  const [flow, setFlow] = useState<Flow>(() =>
    loadFlow(sale?.id ?? "", {
      phase: diagnoses.length ? "start" : "question",
      question: 0,
      answers: [],
      card: 0,
      explanationMs: 0,
      cardsRead: false,
      higherRisk: false,
      consent: false,
    }),
  );
  const update = (change: Partial<Flow>) =>
    setFlow((current) => ({ ...current, ...change }));
  useEffect(() => {
    if (sale?.status === "draft")
      sessionStorage.setItem(flowKey(sale.id), JSON.stringify(flow));
    else if (sale) sessionStorage.removeItem(flowKey(sale.id));
  }, [flow, sale]);
  // 핵심 설명 카드를 본 시간을 잰다. 카드 화면을 떠날 때 더한다.
  const cardStart = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (flow.phase === "cards") cardStart.current ??= Date.now();
  }, [flow.phase]);
  const leaveCards = (change: Partial<Flow>) => {
    const spent = cardStart.current ? Date.now() - cardStart.current : 0;
    cardStart.current = undefined;
    update({ ...change, explanationMs: flow.explanationMs + spent });
  };
  const product = saleProduct(products, sale);
  const latest = diagnoses.at(-1);
  const subscribed = sale?.status === "subscribed";
  const now = useNow(subscribed && sale?.coolingEndsAt !== undefined);
  const waitingApproval =
    sale?.status === "draft" &&
    flow.phase === "subscribe" &&
    sale.approvalRequired &&
    sale.approvedAttempt !== sale.latestAttempt;
  // 관리자 승인을 기다리는 동안 판매 건을 다시 읽는다.
  useEffect(() => {
    if (!waitingApproval) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [waitingApproval, refresh]);

  if (!sale || !product)
    return (
      <>
        <Heading
          title={
            loaded && sale
              ? "가입 상품을 확인하지 못했어요"
              : "가입할 상품을 먼저 골라 주세요"
          }
          description="상품 상세에서 위험과 비용을 확인한 뒤 가입을 시작할 수 있어요."
        />
        <Empty
          title="진행 중인 가입이 없어요"
          text="상품을 고르면 투자성향 진단부터 시작해요."
        >
          <Button asChild>
            <Link to={channel.catalog}>상품 보러 가기</Link>
          </Button>
        </Empty>
      </>
    );

  const { document } = product;
  const suitable = latest ? isSuitable(document.riskGrade, latest.limit) : true;
  const protectedSale = latest
    ? isProtectedSale(document, latest, suitable)
    : document.complex;
  const nextAttempt = diagnoses.length + 1;
  const explanationSeconds = Math.min(
    86400,
    Math.max(1, Math.round(flow.explanationMs / 1000)),
  );
  const subscribeTx = confirmedTrace(sale, "subscribe");
  const confirmTx = confirmedTrace(sale, "confirm");

  const diagnose = async (answers: (number | null)[]) => {
    if (!customer || answers.some((answer) => answer === null)) return;
    const result = await run("투자성향을 진단하고 있어요", () =>
      api<DiagnosisDto>(
        `/customers/${encodeURIComponent(customer.number)}/diagnose`,
        { answers: answers as number[] } satisfies DiagnoseRequest,
      ),
    );
    if (result)
      update({
        phase: "result",
        higherRisk: false,
        consent: false,
        cardsRead: false,
      });
  };
  const restart = () =>
    update({
      phase: "question",
      question: 0,
      answers: rule ? rule.questions.map(() => null) : [],
      higherRisk: false,
      consent: false,
      cardsRead: false,
    });
  const subscribe = () =>
    run("청약을 기록하고 있어요", () =>
      api<SaleDto>(`/sales/${sale.id}/action/subscribe`, {
        explanationSeconds,
        higherRiskConfirmed: !suitable && flow.higherRisk,
        recordingConsent: protectedSale && flow.consent,
      } satisfies SubscribeRequest),
    );
  const stopButton = (
    <Button variant="ghost" disabled={busy} onClick={abandon}>
      가입 중단하기
    </Button>
  );

  let body: ReactNode;
  let step = stepOf(flow.phase);
  if (sale.status === "confirmed") {
    step = STEPS.length;
    body = (
      <>
        <Badge tone="success">가입 확정</Badge>
        <h2>모의 가입 절차를 완료했어요</h2>
        <p className={s.intro}>
          가입 기록이 안전하게 보관됐어요. 증명서 번호로 언제든 기록을 확인할 수
          있어요.
        </p>
        <div className={s.certificate}>
          <div className={s.certificateHead}>
            <BadgeCheck size={20} />
            가입 증명서
          </div>
          <Facts
            rows={[
              ["증명서 번호", <code>{sale.id}</code>],
              ["상품", productName(document)],
              ["설명서 버전", `v${sale.productVersion}`],
              ["진단 회차", `${sale.chain?.attempt ?? sale.latestAttempt}회차`],
              ["가입 금액", won(sale.amount)],
              [
                "최종 확인",
                dateTime(Number(sale.chain?.confirmedAt ?? 0) || undefined),
              ],
            ]}
          />
        </div>
        <Button asChild size="large">
          <Link to={verifyPath(sale.id)}>
            가입 기록 확인하기 <ArrowRight size={17} />
          </Link>
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => download(sale.id, "receipt")}
        >
          <Download size={16} />
          증명서 내려받기
        </Button>
        <Button variant="outline" asChild>
          <Link to={channel.records}>내 가입 기록 보기</Link>
        </Button>
        <details>
          <summary>기술 정보 보기</summary>
          <Facts
            rows={[
              [
                "청약 기록",
                subscribeTx ? <code>{subscribeTx.txHash}</code> : "확인 대기",
              ],
              ["청약 블록", subscribeTx?.blockNumber ?? "—"],
              [
                "최종 확인 기록",
                confirmTx ? <code>{confirmTx.txHash}</code> : "확인 대기",
              ],
              ["최종 확인 블록", confirmTx?.blockNumber ?? "—"],
            ]}
          />
        </details>
        <Button variant="ghost" asChild onClick={finish}>
          <Link to={channel.catalog}>다른 상품 보기</Link>
        </Button>
      </>
    );
  } else if (sale.status === "withdrawn") {
    step = 4;
    body = (
      <>
        <Badge>철회</Badge>
        <h2>청약을 철회했어요</h2>
        <p className={s.intro}>
          최종 확인 전에 철회해서 가입하지 않았어요. 철회 기록도 함께 보관돼요.
        </p>
        <Button asChild size="large" onClick={finish}>
          <Link to={channel.catalog}>다른 상품 보기</Link>
        </Button>
      </>
    );
  } else if (sale.status === "abandoned") {
    body = (
      <>
        <Badge>중단</Badge>
        <h2>가입을 중단했어요</h2>
        <p className={s.intro}>
          진단 기록은 남아 있어요. 다시 가입하면 다음 회차로 이어져요.
        </p>
        <Button asChild size="large" onClick={finish}>
          <Link to={channel.catalog}>상품 보러 가기</Link>
        </Button>
      </>
    );
  } else if (subscribed) {
    step = 4;
    const ends = sale.coolingEndsAt;
    const left = ends ? Math.max(0, ends - now) : 0;
    body = (
      <>
        <Badge tone="blue">{left > 0 ? "숙려 중" : "최종 확인 대기"}</Badge>
        <h2>
          {left > 0
            ? "가입 요청을 받았어요"
            : "마지막으로 가입 의사를 확인해요"}
        </h2>
        {ends ? (
          <>
            <p className={s.intro}>
              이 가입은 숙려 대상이에요. 숙려기간이 지나야 최종 확인할 수 있고,
              그전에는 언제든 철회할 수 있어요.
            </p>
            <div className={s.countdown} role="timer" aria-live="off">
              <span>{left > 0 ? "최종 확인까지" : "숙려기간이 끝났어요"}</span>
              <strong>{clock(left)}</strong>
              <small>{dateTime(ends)}부터 확인할 수 있어요</small>
            </div>
          </>
        ) : (
          <p className={s.intro}>
            숙려 대상이 아니에요. 아래 내용을 확인하고 가입을 확정해 주세요.
          </p>
        )}
        <div className={s.firstCard}>
          <AlertTriangle size={18} />
          <div>
            <strong>위험을 다시 알려 드려요</strong>
            <p>
              {gradeName(document.riskGrade)} 상품이에요. 최대 손실:{" "}
              {document.maxLoss}
            </p>
            <p>{document.cards[0]?.text}</p>
          </div>
        </div>
        <Facts
          rows={[
            ["상품", productName(document)],
            ["가입 금액", won(sale.amount)],
            ["적합성", sale.suitable ? "적합" : "부적합 · 본인 판단으로 가입"],
          ]}
        />
        <Button
          size="large"
          disabled={busy || left > 0 || sale.submissionPending}
          onClick={() =>
            action(sale.id, "confirm", "최종 확인을 기록하고 있어요")
          }
        >
          확인하고 가입하기
        </Button>
        <Button
          variant="outline"
          disabled={busy || sale.submissionPending}
          onClick={() => action(sale.id, "withdraw", "청약을 철회하고 있어요")}
        >
          청약 철회하기
        </Button>
        {left > 0 && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              action(sale.id, "confirm", "숙려 중 최종 확인을 시도하고 있어요")
            }
          >
            시연: 숙려 중에 최종 확인 시도하기
          </Button>
        )}
      </>
    );
  } else if (!rule) {
    body = (
      <Notice tone="warning">
        아직 투자성향 진단 기준이 없어요. 판매사가 기준을 등록하면 가입할 수
        있어요.
      </Notice>
    );
  } else if (flow.phase === "start" && latest) {
    body = (
      <>
        <Badge tone="blue">최근 진단 {latest.attempt}회차</Badge>
        <h2>최근 투자성향 진단 결과가 있어요</h2>
        <Facts
          rows={[
            ["투자성향", profileName(latest.profile)],
            ["권유 가능 위험등급", limitRange(latest.limit)],
            ["진단 시각", dateTime(latest.at)],
          ]}
        />
        <p className={s.small}>
          다시 진단하면 {nextAttempt}회차로 기록돼요. 이전 회차 기록도 그대로
          남아요.
        </p>
        <Button size="large" onClick={() => update({ phase: "result" })}>
          이 결과로 계속하기
        </Button>
        <Button variant="outline" onClick={restart}>
          다시 진단하기
        </Button>
        {stopButton}
      </>
    );
  } else if (flow.phase === "question" || !latest) {
    const q = Math.min(flow.question, rule.questions.length - 1);
    const question = rule.questions[q];
    const answers = rule.questions.map(
      (_, index) => flow.answers[index] ?? null,
    );
    body = (
      <>
        <p className={s.small}>
          {nextAttempt > 1 ? "재진단" : "투자성향 진단"} {nextAttempt}회차 ·{" "}
          {q + 1}/{rule.questions.length} 문항
        </p>
        <h2>{question.title}</h2>
        <fieldset className={s.choices}>
          <legend className={s.srOnly}>{question.category}</legend>
          {question.choices.map((choice, o) => (
            <label className={s.choice} key={o}>
              <input
                type="radio"
                name={`question-${q}`}
                checked={answers[q] === o}
                onChange={() =>
                  update({
                    answers: answers.map((value, index) =>
                      index === q ? o : value,
                    ),
                  })
                }
              />
              {choice.text}
            </label>
          ))}
        </fieldset>
        <div className={s.formActions}>
          {q > 0 && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => update({ question: q - 1 })}
            >
              <ArrowLeft size={16} />
              이전
            </Button>
          )}
          {q + 1 < rule.questions.length ? (
            <Button
              size="large"
              disabled={answers[q] === null}
              onClick={() => update({ question: q + 1, answers })}
            >
              다음
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              size="large"
              disabled={busy || answers.some((answer) => answer === null)}
              onClick={() => void diagnose(answers)}
            >
              진단 결과 보기
            </Button>
          )}
        </div>
        <p className={s.small}>
          답변은 판매사가 보관해요. 진단 결과는 고칠 수 없게 기록돼요.
        </p>
        {stopButton}
      </>
    );
  } else if (flow.phase === "result") {
    body = (
      <>
        <div className={s.badges}>
          <Badge tone="blue">{latest.attempt}회차</Badge>
          {latest.attempt > 1 && <Badge>재진단</Badge>}
        </div>
        <h2>투자성향은 {profileName(latest.profile)}이에요</h2>
        <Facts
          rows={[
            ["권유 가능 위험등급", limitRange(latest.limit)],
            ["이 상품의 위험등급", gradeName(document.riskGrade)],
            ...(latest.elderly
              ? ([["고령 투자자", "보호 절차를 함께 적용해요"]] as [
                  string,
                  ReactNode,
                ][])
              : []),
            ["진단 시각", dateTime(latest.at)],
          ]}
        />
        {latest.attempt >= 3 && (
          <Notice tone="warning">
            {latest.attempt}번째 진단이에요. 청약하려면 판매사 관리자 승인이
            필요해요. 판매사가 진단 이력을 확인한 뒤 승인해요.
          </Notice>
        )}
        <Button size="large" onClick={() => update({ phase: "suitability" })}>
          다음
          <ArrowRight size={16} />
        </Button>
        <Button variant="outline" disabled={busy} onClick={restart}>
          다시 진단하기
        </Button>
        {stopButton}
      </>
    );
  } else if (flow.phase === "suitability") {
    body = suitable ? (
      <>
        <Badge tone="success">적합</Badge>
        <h2>이 상품은 투자성향에 맞아요</h2>
        <Facts
          rows={[
            ["투자성향", profileName(latest.profile)],
            ["권유 가능 위험등급", limitRange(latest.limit)],
            ["이 상품", gradeName(document.riskGrade)],
            ["판매대상 고객군", document.targetMarket],
          ]}
        />
        <Button
          size="large"
          onClick={() => update({ phase: "cards", card: 0 })}
        >
          핵심 설명 보기
          <ArrowRight size={16} />
        </Button>
        {stopButton}
      </>
    ) : (
      <>
        <Badge tone="warning">부적합</Badge>
        <h2>이 상품은 권유하지 않아요</h2>
        <Notice tone="warning">
          {profileName(latest.profile)} 고객님께는 {limitRange(latest.limit)}{" "}
          상품만 권유해요. 이 상품은 {gradeName(document.riskGrade)}이라
          투자성향에 맞지 않아요.
        </Notice>
        <Facts
          rows={[
            ["판매대상 고객군", document.targetMarket],
            ["최대 손실", document.maxLoss],
          ]}
        />
        <label className={s.choice}>
          <input
            type="checkbox"
            checked={flow.higherRisk}
            onChange={(e) => update({ higherRisk: e.target.checked })}
          />
          투자성향에 맞지 않는다는 안내를 받았어요. 권유 없이 제 판단으로 가입을
          이어 갈게요.
        </label>
        <Button
          size="large"
          disabled={!flow.higherRisk}
          onClick={() => update({ phase: "cards", card: 0 })}
        >
          추가 위험을 확인하고 계속하기
        </Button>
        {stopButton}
      </>
    );
  } else if (flow.phase === "cards") {
    const card = document.cards[flow.card];
    const last = flow.card + 1 === document.cards.length;
    body = (
      <>
        <p className={s.small}>
          핵심 설명 {flow.card + 1}/{document.cards.length}
        </p>
        <div className={flow.card === 0 ? s.firstCard : s.explainCard}>
          {flow.card === 0 && <AlertTriangle size={18} />}
          <div>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </div>
        </div>
        {last && (
          <label className={s.choice}>
            <input
              type="checkbox"
              checked={flow.cardsRead}
              onChange={(e) => update({ cardsRead: e.target.checked })}
            />
            핵심 설명 {document.cards.length}장을 모두 읽고 이해했어요.
          </label>
        )}
        <div className={s.formActions}>
          <Button
            variant="outline"
            onClick={() =>
              flow.card === 0
                ? leaveCards({ phase: "suitability" })
                : update({ card: flow.card - 1 })
            }
          >
            <ArrowLeft size={16} />
            이전
          </Button>
          <Button
            size="large"
            disabled={last && !flow.cardsRead}
            onClick={() =>
              last
                ? leaveCards({
                    phase: protectedSale ? "recording" : "subscribe",
                  })
                : update({ card: flow.card + 1 })
            }
          >
            {last ? "설명을 확인했어요" : "다음 설명"}
            <ArrowRight size={16} />
          </Button>
        </div>
        {stopButton}
      </>
    );
  } else if (flow.phase === "recording") {
    body = (
      <>
        <Badge tone="blue">녹취 대상</Badge>
        <h2>상담 내용을 녹취해요</h2>
        <p className={s.intro}>
          {document.complex
            ? "고난도 금융투자상품은 가입 과정을 녹취해요."
            : "고령 고객이나 투자성향에 맞지 않는 고객에게 파생결합증권을 팔 때는 가입 과정을 녹취해요."}{" "}
          녹취에 동의하지 않으면 가입할 수 없어요. 시연에서는 모의 녹취록을
          만들어요.
        </p>
        <label className={s.choice}>
          <input
            type="checkbox"
            checked={flow.consent}
            onChange={(e) => update({ consent: e.target.checked })}
          />
          녹취에 동의해요.
        </label>
        <div className={s.formActions}>
          <Button
            variant="outline"
            onClick={() =>
              update({ phase: "cards", card: document.cards.length - 1 })
            }
          >
            <ArrowLeft size={16} />
            이전
          </Button>
          <Button
            size="large"
            disabled={!flow.consent}
            onClick={() => update({ phase: "subscribe" })}
          >
            다음
            <ArrowRight size={16} />
          </Button>
        </div>
        {stopButton}
      </>
    );
  } else {
    const approved =
      !sale.approvalRequired || sale.approvedAttempt === sale.latestAttempt;
    body = (
      <>
        <h2>청약 내용을 확인해 주세요</h2>
        <Facts
          rows={[
            ["상품", productName(document)],
            ["설명서", `v${sale.productVersion}`],
            ["가입 금액", won(sale.amount)],
            [
              "투자성향",
              `${profileName(latest.profile)} · ${latest.attempt}회차`,
            ],
            ["적합성", suitable ? "적합" : "부적합 · 추가 위험 확인"],
            ["핵심 설명 확인", `${explanationSeconds}초`],
            ["녹취", protectedSale ? "동의 · 모의 녹취록" : "대상 아님"],
            [
              "숙려기간",
              protectedSale
                ? `청약 뒤 ${deployment?.coolingPeriod ?? "—"}초(시연)`
                : "대상 아님",
            ],
          ]}
        />
        {sale.approvalRequired &&
          (approved ? (
            <Notice>판매사 관리자 승인을 받았어요.</Notice>
          ) : (
            <Notice tone="warning">
              <span className={s.waiting}>
                <LoaderCircle size={16} className={s.spin} />
                판매사 관리자 승인을 기다리고 있어요.
              </span>
              {sale.latestAttempt}번째 진단이라 판매사가 진단 이력을 확인한 뒤
              승인해야 청약할 수 있어요. 승인되면 이 화면에서 바로 청약할 수
              있어요.
            </Notice>
          ))}
        <Button
          size="large"
          disabled={busy || !approved || sale.submissionPending}
          onClick={() => void subscribe()}
        >
          {approved ? "청약하기" : "관리자 승인 뒤 청약할 수 있어요"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            update({
              phase: protectedSale ? "recording" : "cards",
              card: document.cards.length - 1,
            })
          }
        >
          이전
        </Button>
        {stopButton}
      </>
    );
  }

  return (
    <div className={s.flow}>
      <Heading
        title={productName(document)}
        description={`${won(sale.amount)} · ${gradeName(document.riskGrade)}`}
      />
      <Steps current={step} />
      <section className={`${s.panel} ${s.flowPanel}`}>
        {sale.submissionPending && (
          <Notice>
            기록을 확인하고 있어요.{" "}
            <button className={s.linkButton} onClick={() => void refresh()}>
              다시 확인하기
            </button>
          </Notice>
        )}
        {body}
      </section>
      <details className={s.flowFoot}>
        <summary>내 진단 기록 {diagnoses.length}회</summary>
        <ol className={s.attempts}>
          {diagnoses.map((diagnosis) => (
            <li key={diagnosis.attempt}>
              <span>{diagnosis.attempt}회차</span>
              <span>{profileName(diagnosis.profile)}</span>
              <small>{dateTime(diagnosis.at)}</small>
            </li>
          ))}
        </ol>
        <p className={s.small}>
          가입 신청 번호 <code>{sale.id}</code>
        </p>
      </details>
    </div>
  );
}
