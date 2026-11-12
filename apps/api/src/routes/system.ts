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
  app.get("/api/health", async (): Promise<HealthResponse> => ({
    ok: true,
    chainId: service.dep.chainId,
  }));
  app.get("/api/config", async (): Promise<ConfigResponse> => ({
    deployment: service.dep,
    product: DOCUMENT,
    products: PRODUCTS,
    requiresToken,
  }));
}
