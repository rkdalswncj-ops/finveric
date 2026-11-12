// 경로: 판매 건 조회, 가입 신청·진단·확정, 검토·매입·중단.
// 요청 형식은 packages/core/src/api.ts의 DTO와 스키마를 따른다.
import type { FastifyInstance } from "fastify";
import {
  confirmBodySchema,
  diagnoseBodySchema,
  saleActionParamsSchema,
  saleIdParamsSchema,
  type ConfirmRequest,
  type DiagnoseRequest,
  type OpenSaleRequest,
  type SaleActionParams,
  type SaleIdParams,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";

export function saleRoutes(app: FastifyInstance, service: FundService) {
  app.get("/api/sales", async () =>
    service.view(() =>
      Promise.all(service.sales.map((s) => service.publicSale(s))),
    ),
  );
  app.get<{ Params: SaleIdParams }>(
    "/api/sales/:id",
    { schema: { params: saleIdParamsSchema } },
    async (req) =>
      service.view(() => service.publicSale(service.find(req.params.id))),
  );
  // 본문 없이 보내도 된다. 그래서 스키마 대신 직접 검사한다.
  app.post<{ Body: OpenSaleRequest | undefined }>("/api/sales", async (req) => {
    const body = req.body;
    if (
      body !== undefined &&
      (!body || typeof body !== "object" || Array.isArray(body))
    )
      throw new Error("가입할 펀드를 확인해 주세요.");
    const productId = body?.productId;
    if (
      productId !== undefined &&
      (typeof productId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(productId))
    )
      throw new Error("가입할 펀드를 확인해 주세요.");
    return service.exclusive(() => service.open(productId));
  });
  app.post<{ Params: SaleIdParams; Body: DiagnoseRequest }>(
    "/api/sales/:id/diagnose",
    { schema: { params: saleIdParamsSchema, body: diagnoseBodySchema } },
    async (req) =>
      service.exclusive(() => service.diagnose(req.params.id, req.body)),
  );
  app.post<{ Params: SaleIdParams; Body: ConfirmRequest }>(
    "/api/sales/:id/confirm",
    { schema: { params: saleIdParamsSchema, body: confirmBodySchema } },
    async (req) =>
      service.exclusive(() => service.confirm(req.params.id, req.body)),
  );
  app.post<{ Params: SaleActionParams }>(
    "/api/sales/:id/action/:action",
    { schema: { params: saleActionParamsSchema } },
    async (req) =>
      service.exclusive(() => service.action(req.params.id, req.params.action)),
  );
}
