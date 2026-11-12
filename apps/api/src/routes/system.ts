// 경로: 상태 확인과 검증 설정. 접근 코드 없이 열린다.
import type { FastifyInstance } from "fastify";
import { DOCUMENT, PRODUCTS } from "../../../../packages/core/src/index.ts";
import type {
  ConfigResponse,
  HealthResponse,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";

export function systemRoutes(
  app: FastifyInstance,
  service: FundService,
  { requiresToken }: { requiresToken: boolean },
) {
  // 모두 정상이면 200, 하나라도 실패하면 503. Docker healthcheck와 배포 확인에 쓴다.
  app.get("/api/health", async (_req, reply): Promise<HealthResponse> => {
    const result = await service.health();
    if (!result.ok) reply.code(503);
    reply.header("Cache-Control", "no-store");
    return result;
  });
  app.get("/api/config", async (): Promise<ConfigResponse> => ({
    deployment: service.dep,
    product: DOCUMENT,
    products: PRODUCTS,
    requiresToken,
  }));
}
