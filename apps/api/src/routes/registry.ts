// 경로: 진단 기준과 상품 설명서 버전 등록·조회, 시연 기준·상품 일괄 등록.
import type { FastifyInstance } from "fastify";
import {
  registerProductBodySchema,
  registerRuleBodySchema,
  type RegisterProductRequest,
  type RegisterRuleRequest,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";

export function registryRoutes(app: FastifyInstance, service: FundService) {
  app.get("/api/rules", async () => service.view(() => service.rules()));
  app.post<{ Body: RegisterRuleRequest }>(
    "/api/rules",
    { schema: { body: registerRuleBodySchema } },
    async (req) =>
      service.exclusive(() => service.registerRule(req.body.document)),
  );
  app.get("/api/products", async () => service.view(() => service.products()));
  app.post<{ Body: RegisterProductRequest }>(
    "/api/products",
    { schema: { body: registerProductBodySchema } },
    async (req) =>
      service.exclusive(() => service.registerProduct(req.body.document)),
  );
  app.post("/api/register", async () =>
    service.exclusive(() => service.register()),
  );
}
