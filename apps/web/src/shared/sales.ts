// 판매사 콘솔(client)과 증권사 앱 예시(channel)가 함께 쓰는 판매 건·상품·기준 표시 계산.
// 판정(적합·녹취 대상·투자성향)과 위험 신호는 core를 쓴다. 여기서 다시 계산하지 않는다.
import {
  PROFILE_NAMES,
  productDisplayName,
  RISK_GRADE_NAMES,
  type ProductDocument,
} from "@finveric/core";
import type {
  ProductEntryDto,
  RuleEntryDto,
  SaleDto,
  TraceDto,
} from "@finveric/core/api";
import type { Tone } from "./components.tsx";

export type Sale = SaleDto;
export type ProductEntry = ProductEntryDto;
export type RuleEntry = RuleEntryDto;

/** 원장에 등록한 최신 진단 기준. 진단은 이 기준으로만 한다. */
export const activeRule = (rules: RuleEntry[]) =>
  rules
    .filter((rule) => rule.registered)
    .reduce<RuleEntry | undefined>(
      (latest, rule) =>
        !latest || rule.version > latest.version ? rule : latest,
      undefined,
    );

/** 상품마다 청약에 쓰는 최신 등록 버전. */
export const latestProducts = (entries: ProductEntry[]) =>
  entries.filter((entry) => entry.registered && entry.latest);

/** 상품 ID와 버전으로 등록 원문을 찾는다. 버전이 없으면 최신 등록 버전이다. */
export function findProduct(
  entries: ProductEntry[],
  id?: string,
  version?: number,
) {
  const same = entries.filter(
    (entry) => entry.product.id.toLowerCase() === id?.toLowerCase(),
  );
  return (
    version === undefined
      ? same.find((entry) => entry.latest)
      : same.find((entry) => entry.product.version === version)
  )?.product;
}
export const saleProduct = (entries: ProductEntry[], sale?: Sale) =>
  sale && findProduct(entries, sale.productId, sale.productVersion);

/** 상품 표시 이름. 고난도 상품은 이름 앞에 "고난도 금융투자상품"을 붙인다. */
export const productName = (document?: ProductDocument) =>
  document ? productDisplayName(document) : "상품 확인 대기";
/** 발행사·운용사 표시 이름. 펀드는 운용사, ELS·ELB는 발행사다. */
export const issuerLabel = (document: ProductDocument) =>
  document.type === "펀드" ? "운용사" : "발행사";

export const profileName = (profile?: number) =>
  (profile === undefined ? undefined : PROFILE_NAMES[profile]) ?? "—";
export const gradeName = (grade?: number) =>
  grade ? `${grade}등급 · ${RISK_GRADE_NAMES[grade]}` : "—";
/** 권유 가능 위험등급 범위. limit은 권유할 수 있는 가장 위험한 등급이다. */
export const limitRange = (limit?: number) =>
  !limit ? "—" : limit === 6 ? "6등급만" : `${limit}~6등급`;

/** 지금 시각(초). 원장 블록 시각과 비교한다. */
export const nowSeconds = () => Math.floor(Date.now() / 1000);

/** 관리자 승인을 기다리는 신청: 최신 회차가 3 이상이고 그 회차의 승인 서명이 없다. */
export const awaitingApproval = (sale: Sale) =>
  sale.status === "draft" &&
  sale.approvalRequired &&
  sale.approvedAttempt !== sale.latestAttempt;
/** 숙려 중: 녹취·숙려 대상 청약이고 최종 확인 가능 시각 전이다. */
export const inCooling = (sale: Sale, now: number) =>
  sale.status === "subscribed" &&
  sale.coolingEndsAt !== undefined &&
  sale.coolingEndsAt > now;

export type StatusKey =
  | "draft"
  | "approval"
  | "abandoned"
  | "subscribed"
  | "cooling"
  | "confirmed"
  | "withdrawn";
/** 필터 순서는 시간 순서다. 숙려 대상은 숙려 중을 지나 확인 대기가 된다. */
export const STATUS_KEYS: StatusKey[] = [
  "draft",
  "approval",
  "cooling",
  "subscribed",
  "confirmed",
  "withdrawn",
  "abandoned",
];
export const STATUS_LABELS: Readonly<Record<StatusKey, string>> = {
  draft: "신청",
  approval: "승인 대기",
  abandoned: "중단",
  // 청약을 원장에 기록했고 고객의 최종 확인을 기다린다. 청약은 행동 이름이라 상태 이름으로 쓰지 않는다.
  subscribed: "확인 대기",
  cooling: "숙려 중",
  confirmed: "확정",
  withdrawn: "철회",
};
/**
 * 판매 상태마다 다른 색이다. 진행 순서로 신청(파랑) → 승인 대기(주황, 직원이 처리할 일) → 숙려 중(청록) → 확인 대기(보라)
 * → 확정(초록), 끝난 반대 결과는 철회(빨강), 청약 전에 멈춘 건은 중단(회색)이다. 이웃한 상태는 색상이 겹치지 않는다.
 */
export const STATUS_TONES: Readonly<Record<StatusKey, Tone>> = {
  draft: "info",
  approval: "warning",
  abandoned: "neutral",
  subscribed: "subscribed",
  cooling: "cooling",
  confirmed: "success",
  withdrawn: "danger",
};
/** 화면에 쓰는 판매 건 상태. 원장 상태에 승인 대기와 숙려 중을 더한다. */
export function statusKey(sale: Sale, now: number): StatusKey {
  if (awaitingApproval(sale)) return "approval";
  if (inCooling(sale, now)) return "cooling";
  return sale.status;
}

/** 이 판매 건에서 성공한 원장 거래. */
export const confirmedTrace = (sale: Sale | undefined, action: string) =>
  sale?.traces.find(
    (trace) =>
      trace.action === action && trace.status === "confirmed" && trace.txHash,
  ) as (TraceDto & { txHash: string }) | undefined;
