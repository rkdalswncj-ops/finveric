import { PRODUCTS, PROFILE_NAMES } from "../../core/src/index.ts";
import type { SaleDto } from "../../core/src/api.ts";

/** 판매사 API(/api/sales)가 돌려주는 판매 건. 형식은 core의 API 계약을 따른다. */
export type Sale = SaleDto;

export const short = (value?: string) =>
  value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "—";
export const getProduct = (id?: string) =>
  PRODUCTS.find((product) => product.id.toLowerCase() === id?.toLowerCase());
export const saleProduct = (sale?: Sale) =>
  getProduct(sale?.state.productId ?? sale?.productId);
export const saleProductName = (sale?: Sale) =>
  saleProduct(sale)?.document.name ?? "상품 확인 대기";
export const won = (amount: number | string) =>
  `${Number(amount).toLocaleString("ko-KR")}원`;
export const profileName = (profile?: number) =>
  (profile === undefined ? undefined : PROFILE_NAMES[profile]) ?? "확인 대기";
export const finalProfile = (sale?: Sale) => {
  const attempt = sale?.attempts.at(-1);
  return attempt?.confirmed && attempt.round === sale?.state.attempts
    ? attempt.profile
    : undefined;
};
export const enrollmentTrace = (sale?: Sale) =>
  sale?.state.finalized
    ? sale.traces
        .filter(
          (trace) =>
            trace.action === "completeEnrollment" &&
            trace.status === "confirmed" &&
            trace.txHash &&
            trace.blockNumber,
        )
        .at(-1)
    : undefined;
export const higherRiskStatus = (
  profile: number | undefined,
  minimum: number | undefined,
  confirmed: boolean,
) => {
  if (profile === undefined || minimum === undefined) return "확인 대기";
  if (profile >= minimum) return "해당 없음";
  return confirmed ? "완료" : "대기";
};
export const status = (sale?: Sale) =>
  !sale
    ? "판매 건 없음"
    : sale.state.finalized
      ? "가입 조건 검증 완료"
      : sale.submissionPending
        ? "원장 확인 중"
        : sale.state.attempts >= 3 && !sale.state.reviewed
          ? "추가 검토 필요"
          : "초안";
export const purchaseNames = [
  "미요청",
  "요청 접수",
  "결과 대기",
  "매입 결과 반영(모의)",
];
export const procedureLabels = {
  "higher-risk": "추가 위험 확인",
  signature: "서명 기록",
  completion: "가입 조건 검증 완료",
};
