// 경로: 처리 기록과 고객 증빙 내려받기.
import type { FastifyInstance } from "fastify";
import {
  exportParamsSchema,
  type ExportParams,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";

export function recordRoutes(app: FastifyInstance, service: FundService) {
  app.get("/api/traces", async () =>
    service.view(() => service.publicTraces()),
  );
  app.get<{ Params: ExportParams }>(
    "/api/sales/:id/export/:kind",
    { schema: { params: exportParamsSchema } },
    async (req, reply) => {
      reply.header(
        "Content-Disposition",
        `attachment; filename="finveric-${req.params.kind}-${req.params.id.slice(0, 10)}.json"`,
      );
      reply.header("Cache-Control", "no-store");
      return service.view<unknown>(() =>
        req.params.kind === "original"
          ? service.original(req.params.id)
          : service.receipt(req.params.id),
      );
    },
  );
}
