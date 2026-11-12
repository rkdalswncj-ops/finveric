import type { Product } from "../../../../packages/core/src/index.ts";

/** 판매 채널 시연(증권사 앱에서 고객이 보는 화면)의 경로. */
export const channel = {
  catalog: "/channel",
  fund: "/channel/fund",
  enroll: "/channel/enroll",
  records: "/channel/records",
  verify: "/channel/verify",
};
/** 판매 채널 시연에서 고객이 가입 기록을 확인하는 테스트 화면. */
export const verifyPath = (saleId: string) =>
  `${channel.verify}?sale=${encodeURIComponent(saleId)}`;
export const fundPath = (product: Product) =>
  `${channel.fund}?product=${product.id}`;

/** 감독기관 화면은 같은 주소의 /auditor/ 페이지다. */
export const auditorUrl = (query = "") => `/auditor/${query}`;

/** 가입 진단 증명을 확인한 결과를 이 브라우저 세션에 보관하는 키. */
export const draftProofKey = (id: string) => `finveric-draft-proof:${id}`;
