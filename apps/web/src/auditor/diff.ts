// 버전 사이의 차이. 진단 기준은 문항·선택지 번호(회로 입력 순서)로 맞춰 비교한다.
import type {
  ProductDocument,
  RuleChoice,
  RuleDocument,
} from "../../../../packages/core/src/index.ts";
import { gradeLabel, profileLabel } from "./format.ts";

export type Change = {
  kind: "added" | "removed" | "changed";
  /** 바뀐 위치. 예: "2번 문항 1번 선택지 점수". */
  label: string;
  before?: string;
  after?: string;
};
export const CHANGE_LABELS: Readonly<Record<Change["kind"], string>> = {
  added: "추가",
  removed: "삭제",
  changed: "변경",
};

const capText = (choice: RuleChoice) =>
  choice.cap && choice.cap > 1 ? `${choice.cap}등급까지` : "제한 없음";
const elderlyText = (choice: RuleChoice) => (choice.elderly ? "표시" : "없음");
const choiceText = (choice: RuleChoice) =>
  [
    `${choice.text} (${choice.score}점`,
    choice.cap && choice.cap > 1 ? `, 추출 ${choice.cap}등급까지` : "",
    choice.elderly ? ", 고령 표시" : "",
    ")",
  ].join("");

/** 진단 기준 두 버전의 차이. 등록 순서가 이전인 쪽을 before로 넘긴다. */
export function diffRules(before: RuleDocument, after: RuleDocument) {
  const changes: Change[] = [];
  const changed = (label: string, a: string, b: string) => {
    if (a !== b) changes.push({ kind: "changed", label, before: a, after: b });
  };
  changed("기준 이름", before.name, after.name);
  const count = Math.max(before.questions.length, after.questions.length);
  for (let q = 0; q < count; q++) {
    const a = before.questions[q];
    const b = after.questions[q];
    const label = `${q + 1}번 문항`;
    if (!a) {
      changes.push({
        kind: "added",
        label,
        after: `[${b.category}] ${b.title} · ${b.choices.map(choiceText).join(" / ")}`,
      });
      continue;
    }
    if (!b) {
      changes.push({
        kind: "removed",
        label,
        before: `[${a.category}] ${a.title} · ${a.choices.map(choiceText).join(" / ")}`,
      });
      continue;
    }
    changed(`${label} 범주`, a.category, b.category);
    changed(`${label} 질문`, a.title, b.title);
    const choices = Math.max(a.choices.length, b.choices.length);
    for (let o = 0; o < choices; o++) {
      const x = a.choices[o];
      const y = b.choices[o];
      const where = `${label} ${o + 1}번 선택지`;
      if (!x)
        changes.push({ kind: "added", label: where, after: choiceText(y) });
      else if (!y)
        changes.push({ kind: "removed", label: where, before: choiceText(x) });
      else {
        changed(`${where} 문구`, x.text, y.text);
        changed(`${where} 점수`, `${x.score}점`, `${y.score}점`);
        changed(`${where} 추출 조건`, capText(x), capText(y));
        changed(`${where} 고령 표시`, elderlyText(x), elderlyText(y));
      }
    }
  }
  before.thresholds.forEach((value, k) =>
    changed(
      `${profileLabel(k + 2)} 최소 합계 점수`,
      `${value}점`,
      `${after.thresholds[k]}점`,
    ),
  );
  before.matrix.forEach((value, k) =>
    changed(
      `${profileLabel(k + 1)} 권유 가능 최고 위험등급`,
      gradeLabel(value),
      gradeLabel(after.matrix[k]),
    ),
  );
  return changes;
}

const yesNo = (value: boolean) => (value ? "예" : "아니요");
const PRODUCT_FIELDS: [keyof ProductDocument, string][] = [
  ["name", "상품명"],
  ["type", "상품 유형"],
  ["issuer", "발행사·운용사"],
  ["seller", "판매사"],
  ["targetMarket", "판매대상 고객군"],
  ["maxLoss", "최대 손실"],
  ["fee", "수수료"],
  ["summary", "상품 요약"],
];

/** 상품 설명서 두 버전의 차이. */
export function diffProducts(before: ProductDocument, after: ProductDocument) {
  const changes: Change[] = [];
  const changed = (label: string, a: string, b: string) => {
    if (a !== b) changes.push({ kind: "changed", label, before: a, after: b });
  };
  for (const [key, label] of PRODUCT_FIELDS)
    changed(label, String(before[key]), String(after[key]));
  changed(
    "위험등급",
    gradeLabel(before.riskGrade),
    gradeLabel(after.riskGrade),
  );
  changed("고난도 금융투자상품", yesNo(before.complex), yesNo(after.complex));
  changed("파생결합증권", yesNo(before.derivative), yesNo(after.derivative));
  const cards = Math.max(before.cards.length, after.cards.length);
  for (let k = 0; k < cards; k++) {
    const a = before.cards[k];
    const b = after.cards[k];
    const label = `핵심 설명 카드 ${k + 1}`;
    if (!a)
      changes.push({ kind: "added", label, after: `${b.title}: ${b.text}` });
    else if (!b)
      changes.push({ kind: "removed", label, before: `${a.title}: ${a.text}` });
    else {
      changed(`${label} 제목`, a.title, b.title);
      changed(`${label} 내용`, a.text, b.text);
    }
  }
  return changes;
}
