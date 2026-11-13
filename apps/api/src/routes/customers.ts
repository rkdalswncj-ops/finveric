// 경로: 고객 진단 회차 조회·기록과 사후 변경 시연.
import type { FastifyPluginAsync } from "fastify";
import {
  customerParamsSchema,
  diagnoseBodySchema,
  tamperBodySchema,
  type CustomerParams,
  type DiagnoseRequest,
  type TamperRequest,
} from "@finveric/core/api";
import type { FundService } from "../service.ts";

export const customerRoutes: FastifyPluginAsync<{
  service: FundService;
}> = async (app, { service }) => {
  app.get<{ Params: CustomerParams }>(
    "/customers/:customerNo",
    { schema: { params: customerParamsSchema } },
    async (req) => service.view(() => service.customer(req.params.customerNo)),
  );
  app.post<{ Params: CustomerParams; Body: DiagnoseRequest }>(
    "/customers/:customerNo/diagnose",
    { schema: { params: customerParamsSchema, body: diagnoseBodySchema } },
    async (req) =>
      service.exclusive(() =>
        service.diagnose(req.params.customerNo, req.body),
      ),
  );
  app.post<{ Body: TamperRequest }>(
    "/demo/tamper",
    { schema: { body: tamperBodySchema } },
    async (req) => service.exclusive(() => service.tamper(req.body)),
  );
};
