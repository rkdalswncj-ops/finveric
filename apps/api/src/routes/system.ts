// 경로: 상태 확인, 검증 설정, API 문서. 접근 코드 없이 열린다(app.ts의 PUBLIC_PATHS).
import type { FastifyPluginAsync } from "fastify";
import type { ConfigResponse, HealthResponse } from "@finveric/core/api";
import { DOCS_PAGE } from "../docs/page.ts";
import type { FundService } from "../service.ts";

export const systemRoutes: FastifyPluginAsync<{
  service: FundService;
  requiresToken: boolean;
  publicChannel: boolean;
}> = async (app, { service, requiresToken, publicChannel }) => {
  // 모두 정상이면 200, 하나라도 실패하면 503. Docker healthcheck와 배포 확인에 쓴다.
  app.get("/health", async (_req, reply): Promise<HealthResponse> => {
    const result = await service.health();
    if (!result.ok) reply.code(503);
    reply.header("Cache-Control", "no-store");
    return result;
  });
  app.get("/config", async (req, reply): Promise<ConfigResponse> => {
    reply.header("Cache-Control", "no-store");
    return {
      deployment: service.dep,
      requiresToken,
      ...(publicChannel ? { publicChannel } : {}),
      demoCustomer: service.demoCustomer(req.demoCustomerNo),
    };
  });
  // OpenAPI 3.1 문서. 등록한 경로와 docs/operations.ts로 만든다.
  app.get("/openapi.json", async () => app.swagger());
  // 사람이 읽는 API 문서. 한 HTML 응답이 /api/openapi.json을 읽어 그린다.
  app.get("/docs", async (_req, reply) =>
    reply.type("text/html; charset=utf-8").send(DOCS_PAGE),
  );
};
