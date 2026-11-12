// 진단 기준 원문(데이터)과 기준 해시, 판정. 회로 suitability.circom과 같은 순서로 계산한다.
import { keccak256, stringToHex, type Hex } from "viem";
import { poseidon11 } from "poseidon-lite/poseidon11";
import { poseidon16 } from "poseidon-lite/poseidon16";
import { canonical, FIELD, fieldHex } from "./encoding.ts";

/** 투자자 정보 6개 범주. 진단 기준은 모두 포함해야 한다. */
export const CATEGORIES = [
  "연령",
  "거래 목적",
  "재산 상황",
  "투자 경험",
  "상품 이해도",
  "위험 태도",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** 회로의 고정 크기. 늘리려면 회로와 증명 키를 다시 만든다. */
export const MAX_QUESTIONS = 10;
export const MAX_CHOICES = 5;
export const MAX_SCORE = 15;

/**
 * 선택지. score 0..15. cap은 이 답을 고르면 권유할 수 있는 가장 위험한 등급(1..6, 기본 1 = 제한 없음).
 * elderly는 고령 표시(기본 false).
 */
export type RuleChoice = {
  text: string;
  score: number;
  cap?: number;
  elderly?: boolean;
};
export type RuleQuestion = {
  category: Category;
  title: string;
  choices: RuleChoice[];
};
export type RuleDocument = {
  format: "finveric-rule-v5";
  version: number;
  name: string;
  /** 1..10개, 문항마다 선택지 1..5개. */
  questions: RuleQuestion[];
  /** 투자성향 2,3,4,5단계의 최소 합계 점수. 감소하지 않는 0..255. */
  thresholds: [number, number, number, number];
  /** 투자성향 1..5단계별 권유 가능 최고 위험등급(1..6). 증가하지 않는다. */
  matrix: [number, number, number, number, number];
};

/** 투자성향 1..5. */
export const PROFILE_NAMES: Readonly<Record<number, string>> = {
  1: "안정형",
  2: "안정추구형",
  3: "위험중립형",
  4: "적극투자형",
  5: "공격투자형",
};
/** 상품 위험등급 1..6. 숫자가 작을수록 위험하다. */
export const RISK_GRADE_NAMES: Readonly<Record<number, string>> = {
  1: "매우 높은 위험",
  2: "높은 위험",
  3: "다소 높은 위험",
  4: "보통 위험",
  5: "낮은 위험",
  6: "매우 낮은 위험",
};

const isInt = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;

/** 글자 항목의 문제. 비었으면 "empty", 너무 길면 "long", 괜찮으면 undefined다. */
const textProblem = (value: unknown, max = 500) =>
  typeof value !== "string" || value.trim().length === 0
    ? "empty"
    : value.length > max
      ? "long"
      : undefined;

/**
 * 진단 기준 원문을 검사한다. 오류 문장 목록을 돌려준다. 문제가 없으면 빈 배열이다.
 * 문장은 판매사 콘솔의 편집기와 API 오류에 쓴다(합니다체). 무엇이 문제인지 항목마다 적는다.
 */
export function validateRule(doc: RuleDocument): string[] {
  const errors: string[] = [];
  if (!doc || typeof doc !== "object") return ["진단 기준 원문이 없습니다."];
  if (doc.format !== "finveric-rule-v5")
    errors.push("형식은 finveric-rule-v5여야 합니다.");
  if (!isInt(doc.version, 1, 2 ** 32 - 1))
    errors.push("버전은 1 이상의 정수여야 합니다.");
  const name = textProblem(doc.name, 100);
  if (name === "empty") errors.push("기준 이름을 쓰세요.");
  if (name === "long") errors.push("기준 이름을 100자 안으로 줄이세요.");
  if (
    !Array.isArray(doc.questions) ||
    doc.questions.length < 1 ||
    doc.questions.length > MAX_QUESTIONS
  ) {
    errors.push(`문항은 1~${MAX_QUESTIONS}개여야 합니다.`);
  } else {
    doc.questions.forEach((question, q) => {
      const label = `${q + 1}번 문항`;
      if (!question || typeof question !== "object") {
        errors.push(`${label}이 비어 있습니다.`);
        return;
      }
      if (!CATEGORIES.includes(question.category))
        errors.push(`${label}의 범주를 6개 범주 중에서 고르세요.`);
      const title = textProblem(question.title);
      if (title === "empty") errors.push(`${label}의 질문을 쓰세요.`);
      if (title === "long")
        errors.push(`${label}의 질문을 500자 안으로 줄이세요.`);
      if (
        !Array.isArray(question.choices) ||
        question.choices.length < 1 ||
        question.choices.length > MAX_CHOICES
      ) {
        errors.push(`${label}의 선택지는 1~${MAX_CHOICES}개여야 합니다.`);
        return;
      }
      question.choices.forEach((choice, o) => {
        const where = `${label} ${o + 1}번 선택지`;
        if (!choice || typeof choice !== "object") {
          errors.push(`${where}가 비어 있습니다.`);
          return;
        }
        const text = textProblem(choice.text);
        if (text === "empty") errors.push(`${where}의 문구를 쓰세요.`);
        if (text === "long")
          errors.push(`${where}의 문구를 500자 안으로 줄이세요.`);
        if (!isInt(choice.score, 0, MAX_SCORE))
          errors.push(`${where}의 점수는 0~${MAX_SCORE} 정수여야 합니다.`);
        if (choice.cap !== undefined && !isInt(choice.cap, 1, 6))
          errors.push(`${where}의 추출 조건은 1~6등급이어야 합니다.`);
        if (choice.elderly !== undefined && typeof choice.elderly !== "boolean")
          errors.push(`${where}의 고령 표시는 참·거짓이어야 합니다.`);
      });
    });
    for (const category of CATEGORIES)
      if (!doc.questions.some((question) => question?.category === category))
        errors.push(`"${category}" 범주의 문항을 넣으세요.`);
  }
  if (
    !Array.isArray(doc.thresholds) ||
    doc.thresholds.length !== 4 ||
    !doc.thresholds.every((value) => isInt(value, 0, 255))
  )
    errors.push("등급 구간은 0~255 정수 4개여야 합니다.");
  else if (
    doc.thresholds.some((value, k) => k > 0 && value < doc.thresholds[k - 1])
  )
    errors.push("등급 구간 점수는 단계가 오를수록 같거나 커야 합니다.");
  if (
    !Array.isArray(doc.matrix) ||
    doc.matrix.length !== 5 ||
    !doc.matrix.every((value) => isInt(value, 1, 6))
  )
    errors.push("적합성 기준은 투자성향 5단계마다 1~6등급이어야 합니다.");
  else if (doc.matrix.some((value, k) => k > 0 && value > doc.matrix[k - 1]))
    errors.push(
      "적합성 기준은 투자성향이 오를수록 같거나 더 위험한 등급이어야 합니다.",
    );
  return errors;
}

/** 원문 전체(문항 문구 포함)의 지문. 기준 해시의 마지막 묶음에 들어간다. */
export const ruleTextHash = (doc: RuleDocument) =>
  BigInt(keccak256(stringToHex(canonical(doc)))) % FIELD;

/**
 * 회로 입력 순서의 기준 값 176개. 16개씩 11묶음이다.
 * 문항 묶음 q(0..9): [선택지 수, 선택지 o(0..4)마다 점수·추출 조건·고령 표시].
 * 쓰지 않는 문항: 선택지 수 1, 0번 선택지 (0,1,0). 쓰지 않는 선택지: (0,0,0).
 * 마지막 묶음: [등급 구간 4개, 적합성 기준 5개, 원문 지문, 0 6개].
 */
export function ruleFields(doc: RuleDocument): bigint[] {
  const fields: bigint[] = [];
  for (let q = 0; q < MAX_QUESTIONS; q++) {
    const question = doc.questions[q];
    if (!question) {
      fields.push(1n, 0n, 1n, 0n, ...Array<bigint>(12).fill(0n));
      continue;
    }
    fields.push(BigInt(question.choices.length));
    for (let o = 0; o < MAX_CHOICES; o++) {
      const choice = question.choices[o];
      fields.push(
        ...(choice
          ? [
              BigInt(choice.score),
              BigInt(choice.cap ?? 1),
              choice.elderly ? 1n : 0n,
            ]
          : [0n, 0n, 0n]),
      );
    }
  }
  fields.push(
    ...doc.thresholds.map(BigInt),
    ...doc.matrix.map(BigInt),
    ruleTextHash(doc),
    ...Array<bigint>(6).fill(0n),
  );
  return fields;
}

/** 기준 해시 = Poseidon11(Poseidon16(묶음 0) … Poseidon16(묶음 10)). 0x 32바이트 hex. */
export function ruleHash(doc: RuleDocument): Hex {
  const fields = ruleFields(doc);
  const chunks = Array.from({ length: 11 }, (_, k) =>
    poseidon16(fields.slice(k * 16, k * 16 + 16)),
  );
  return fieldHex(poseidon11(chunks));
}

export type Evaluation = {
  score: number;
  profile: number;
  limit: number;
  elderly: boolean;
};

/** 답변이 기준의 선택지 범위 안인지. 답변 수는 문항 수와 같아야 한다. */
export const answersFit = (doc: RuleDocument, answers: readonly number[]) =>
  Array.isArray(answers) &&
  answers.length === doc.questions.length &&
  answers.every((answer, q) =>
    isInt(answer, 0, doc.questions[q].choices.length - 1),
  );

/** 회로와 같은 판정. 투자성향 = 1 + 넘은 구간 수. 권유 가능 최고 위험등급 = 가장 보수적인 값. */
export function evaluateRule(
  doc: RuleDocument,
  answers: readonly number[],
): Evaluation {
  if (!answersFit(doc, answers))
    throw new Error("답변이 진단 기준의 선택지 범위를 벗어났어요.");
  const chosen = answers.map((answer, q) => doc.questions[q].choices[answer]);
  const score = chosen.reduce((sum, choice) => sum + choice.score, 0);
  const profile = 1 + doc.thresholds.filter((min) => score >= min).length;
  const limit = Math.max(
    doc.matrix[profile - 1],
    ...chosen.map((choice) => choice.cap ?? 1),
  );
  const elderly = chosen.some((choice) => choice.elderly === true);
  return { score, profile, limit, elderly };
}

/** 시연 진단 기준 v1(PRD). 값은 모두 시연용 가정이다. */
export const DEMO_RULE: RuleDocument = {
  format: "finveric-rule-v5",
  version: 1,
  name: "시연 진단 기준 v1",
  questions: [
    {
      category: "연령",
      title: "나이를 알려 주세요.",
      choices: [
        { text: "65세 이상", score: 0, elderly: true },
        { text: "50~64세", score: 1 },
        { text: "49세 이하", score: 2 },
      ],
    },
    {
      category: "거래 목적",
      title: "이번 투자의 목적은 무엇인가요?",
      choices: [
        { text: "원금 보존", score: 0, cap: 5 },
        { text: "예금 이자 이상의 수익", score: 1 },
        { text: "높은 수익", score: 2 },
      ],
    },
    {
      category: "재산 상황",
      title: "금융자산 중 이번 투자 비중은 얼마인가요?",
      choices: [
        { text: "30% 초과", score: 0 },
        { text: "10~30%", score: 1 },
        { text: "10% 이하", score: 2 },
      ],
    },
    {
      category: "투자 경험",
      title: "투자해 본 상품을 골라 주세요.",
      choices: [
        { text: "예금·채권", score: 0 },
        { text: "펀드", score: 1 },
        { text: "ELS·파생상품", score: 2 },
      ],
    },
    {
      category: "상품 이해도",
      title: "ELS 구조를 얼마나 알고 있나요?",
      choices: [
        { text: "모름", score: 0 },
        { text: "들어 본 적 있음", score: 1 },
        { text: "녹인과 조기상환을 설명할 수 있음", score: 2 },
      ],
    },
    {
      category: "위험 태도",
      title: "감내할 수 있는 손실은 어디까지인가요?",
      choices: [
        { text: "원금 손실 불가", score: 0, cap: 5 },
        { text: "원금 20%까지", score: 1, cap: 2 },
        { text: "원금 전액", score: 2 },
      ],
    },
  ],
  thresholds: [3, 5, 7, 10],
  matrix: [6, 5, 3, 2, 1],
};
