// 경로: 운용사·판매사의 상품·설명서와 진단 규칙 등록.
import type { FastifyInstance } from "fastify";
import type { FundService } from "../service.ts";

export function productRoutes(app: FastifyInstance, service: FundService) {
  app.post("/api/register", async () =>
    service.exclusive(() => service.register()),
  );
}
