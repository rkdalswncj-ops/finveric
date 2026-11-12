// 감독기관 화면의 표시 문구와 원장 스냅샷 조회 도우미. 판정과 해시 계산은 packages/core를 쓴다.
import {
  PROFILE_NAMES,
  RISK_GRADE_NAMES,
  productDisplayName,
  type ProductDocument,
  type Signal,
} from "../../../../packages/core/src/index.ts";
import type {
  LedgerProduct,
  LedgerSale,
  LedgerSaleStatus,
  LedgerSnapshot,
} from "../../../../packages/core/src/ledger.ts";
import type { VerificationReference } from "../../../../packages/core/src/verify.ts";
import type { Tone } from "../../../../packages/ui/src/components.tsx";

/** 긴 해시·주소·판매 ID를 앞뒤만 보여 준다. 전체 값은 title로 둔다. */
export const short = (value: string, head = 6, tail = 4) =>
  value.length <= head + tail + 1
    ? value
    : `${value.slice(0, head)}…${value.slice(-tail)}`;

export const profileLabel = (profile: number) =>
  PROFILE_NAMES[profile] ?? `${profile}단계`;
export const gradeLabel = (grade: number) =>
  `${grade}등급 · ${RISK_GRADE_NAMES[grade] ?? "알 수 없음"}`;
export const won = (amount: bigint) => `${amount.toLocaleString("ko-KR")}원`;
export const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 1000) / 10}%` : "—";

/** 원장 판매 건 상태. 청약 뒤 최종 확인 전은 숙려 대상 여부와 관계없이 한 상태로 센다. */
export const STATUS_LABELS: Readonly<Record<LedgerSaleStatus, string>> = {
  subscribed: "청약·숙려 중",
  confirmed: "가입 확정",
  withdrawn: "철회",
};
/** 처리를 기다리는 청약·숙려 중은 info, 끝난 확정은 success, 멈춘 철회는 neutral이다. */
export const STATUS_TONES: Readonly<Record<LedgerSaleStatus, Tone>> = {
  subscribed: "info",
  confirmed: "success",
  withdrawn: "neutral",
};

export const REFERENCE_LABELS: Readonly<
  Record<VerificationReference["kind"], string>
> = {
  rule: "진단 기준 등록",
  product: "상품 설명서 등록",
  diagnosis: "진단",
  subscribe: "청약",
  confirm: "최종 확인",
  withdraw: "철회",
  settle: "결제 기록",
};

/** 등록 원문을 읽을 수 있으면 돌려준다. 원장 값과 맞지 않는 원문도 표시용으로 읽는다. */
export function productDocument(
  entry: LedgerProduct,
): ProductDocument | undefined {
  if (entry.parsed) return entry.parsed;
  try {
    const value = JSON.parse(entry.document) as ProductDocument;
    return value && typeof value === "object" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** 상품 버전의 표시 이름. 고난도 상품은 이름 앞에 표시를 붙인다. */
export function productName(
  snapshot: LedgerSnapshot | undefined,
  id: string,
  version?: number,
) {
  const versions = (snapshot?.products ?? []).filter(
    (entry) => entry.id === id,
  );
  const entry =
    versions.find((item) => item.version === version) ?? versions.at(-1);
  const document = entry && productDocument(entry);
  return document && typeof document.name === "string"
    ? productDisplayName(document)
    : `상품 ${short(id)}`;
}
export const saleProduct = (snapshot: LedgerSnapshot, sale: LedgerSale) =>
  snapshot.products.find(
    (entry) =>
      entry.id === sale.productId && entry.version === sale.productVersion,
  );

/** 기준 해시의 등록 버전. 등록 기록이 없으면 해시 앞부분을 보여 준다. */
export function ruleLabel(snapshot: LedgerSnapshot | undefined, hash: string) {
  const rule = snapshot?.rules.find(
    (entry) => entry.hash.toLowerCase() === hash.toLowerCase(),
  );
  return rule ? `v${rule.version}` : `미등록 ${short(hash)}`;
}

/** 원장에 기록된 고객 가명 ID. 진단과 판매 건을 함께 센다. */
export const customerRefs = (snapshot: LedgerSnapshot) => [
  ...new Set(
    [...snapshot.diagnoses, ...snapshot.sales].map((entry) =>
      entry.customerRef.toLowerCase(),
    ),
  ),
];

/** 판매 건의 위험 신호. 판매 ID가 같은 신호와, 판매 ID 없이 같은 고객에게 난 신호(진단 반복·간격)다. */
export const saleSignals = (
  signals: readonly Signal[],
  sale: { saleId: string; customerRef: string },
) =>
  signals.filter((signal) =>
    signal.saleId
      ? signal.saleId === sale.saleId
      : signal.customerRef.toLowerCase() === sale.customerRef.toLowerCase(),
  );

/** 우리가 쓴 한국어 오류 문장만 그대로 보여 준다. 나머지는 기본 문장으로 바꾼다. */
export const koreanError = (error: unknown, fallback: string) =>
  error instanceof Error && /^[가-힣]/.test(error.message)
    ? error.message
    : fallback;

/** 화면 경로. 분쟁 조회는 판매 ID나 고객 가명 ID를 쿼리로 받는다. */
export const salePath = (saleId: string) =>
  `/disputes?sale=${encodeURIComponent(saleId)}`;
export const customerPath = (customerRef: string) =>
  `/disputes?customer=${encodeURIComponent(customerRef)}`;
