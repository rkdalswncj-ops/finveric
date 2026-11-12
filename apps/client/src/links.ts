import type { Product } from "../../../packages/core/src/index.ts";

/** 판매 채널 시연(증권사 앱에서 고객이 보는 화면)의 경로. */
export const channel = {
  catalog: "/channel",
  fund: "/channel/fund",
  enroll: "/channel/enroll",
  records: "/channel/records",
};
export const fundPath = (product: Product) =>
  `${channel.fund}?product=${product.id}`;

/**
 * 독립 검증은 auditor 앱에서 한다. 배포에서는 같은 도메인의 /auditor/이다.
 * 개발 중에는 scripts/dev.ts가 VITE_AUDITOR_URL로 auditor 개발 서버 주소를 지정한다.
 */
export const auditorUrl = (query = "") =>
  `${import.meta.env.VITE_AUDITOR_URL ?? "/auditor/"}${query}`;

/** 가입 진단 증명을 확인한 결과를 이 브라우저 세션에 보관하는 키. */
export const draftProofKey = (id: string) => `finveric-draft-proof:${id}`;
