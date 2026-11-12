// 경로: 고객 진단 회차 조회·기록과 사후 변경 시연.
import type { FastifyInstance } from "fastify";
import {
  customerParamsSchema,
  diagnoseBodySchema,
  tamperBodySchema,
  type CustomerParams,
  type DiagnoseRequest,
  type TamperRequest,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";

export function customerRoutes(app: FastifyInstance, service: FundService) {
  app.get<{ Params: CustomerParams }>(
    "/api/customers/:customerNo",
    { schema: { params: customerParamsSchema } },
    async (req) => service.view(() => service.customer(req.params.customerNo)),
  );
  app.post<{ Params: CustomerParams; Body: DiagnoseRequest }>(
    "/api/customers/:customerNo/diagnose",
    { schema: { params: customerParamsSchema, body: diagnoseBodySchema } },
    async (req) =>
      service.exclusive(() =>
        service.diagnose(req.params.customerNo, req.body),
      ),
  );
  app.post<{ Body: TamperRequest }>(
    "/api/demo/tamper",
    { schema: { body: tamperBodySchema } },
    async (req) => service.exclusive(() => service.tamper(req.body)),
  );
}
