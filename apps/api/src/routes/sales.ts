// 경로: 판매 건 조회, 신청(초안), 승인·중단·청약·최종 확인·철회·모의 결제.
// 요청 형식은 packages/core/src/api.ts의 DTO와 스키마를 따른다.
import type { FastifyInstance } from "fastify";
import {
  openSaleBodySchema,
  saleActionParamsSchema,
  saleIdParamsSchema,
  subscribeBodySchema,
  type OpenSaleRequest,
  type SaleActionParams,
  type SaleIdParams,
  type SubscribeRequest,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";

export function saleRoutes(app: FastifyInstance, service: FundService) {
  app.get("/api/sales", async () => service.view(() => service.publicSales()));
  app.get<{ Params: SaleIdParams }>(
    "/api/sales/:id",
    { schema: { params: saleIdParamsSchema } },
    async (req) =>
      service.view(() => service.publicSale(service.find(req.params.id))),
  );
  app.post<{ Body: OpenSaleRequest }>(
    "/api/sales",
    { schema: { body: openSaleBodySchema } },
    async (req) => service.exclusive(() => service.open(req.body)),
  );
  // 고정 경로가 아래의 :action 경로보다 먼저 맞는다.
  app.post<{ Params: SaleIdParams; Body: SubscribeRequest }>(
    "/api/sales/:id/action/subscribe",
    { schema: { params: saleIdParamsSchema, body: subscribeBodySchema } },
    async (req) =>
      service.exclusive(() => service.subscribe(req.params.id, req.body)),
  );
  app.post<{ Params: SaleActionParams }>(
    "/api/sales/:id/action/:action",
    { schema: { params: saleActionParamsSchema } },
    async (req) =>
      service.exclusive(() => service.action(req.params.id, req.params.action)),
  );
}
