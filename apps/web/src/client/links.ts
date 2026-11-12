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
export const fundPath = (productId: string) =>
  `${channel.fund}?product=${productId}`;

/** 감독기관 화면은 같은 주소의 /auditor/ 페이지다. */
export const auditorUrl = (query = "") => `/auditor/${query}`;
