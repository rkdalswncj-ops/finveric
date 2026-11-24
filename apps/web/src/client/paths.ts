import { generatePath } from "react-router";

export const SALE_DETAIL_ROUTE = "/review/:saleId";

export const saleReviewPath = (saleId: string) =>
  generatePath(SALE_DETAIL_ROUTE, { saleId });
