// 경로: API 키 발급·폐기·목록. 판매사 콘솔이 쓴다. API 키로는 부를 수 없다(app.ts의 범위 검사).
import type { FastifyPluginAsync } from "fastify";
import {
  apiKeyParamsSchema,
  issueApiKeyBodySchema,
  type ApiKeyParams,
  type IssueApiKeyRequest,
} from "@finveric/core/api";
import type { FundService } from "../service.ts";

export const keyRoutes: FastifyPluginAsync<{ service: FundService }> = async (
  app,
  { service },
) => {
  app.get("/keys", async () => service.view(async () => service.apiKeys()));
  app.post<{ Body: IssueApiKeyRequest }>(
    "/keys",
    { schema: { body: issueApiKeyBodySchema } },
    async (req) =>
      service.exclusive(async () => service.issueApiKey(req.body.name)),
  );
  app.post<{ Params: ApiKeyParams }>(
    "/keys/:id/revoke",
    { schema: { params: apiKeyParamsSchema } },
    async (req) =>
      service.exclusive(async () => service.revokeApiKey(req.params.id)),
  );
};
