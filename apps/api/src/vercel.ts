import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import type { ErrorResponse } from "../../../packages/core/src/api.ts";
import { FundService } from "./service.ts";
import { createApp } from "./app.ts";

/**
 * Vercel 라우팅은 `/api/sales`를 `/api?__path=sales`로 바꿔 함수에 전달할 수 있다.
 * 어느 형태로 와도 Fastify가 원래 API 경로를 받도록 되돌린다.
 */
export function normalizeApiUrl(url = "/") {
  const parsed = new URL(url, "http://finveric.local");
  const rest = parsed.searchParams.get("__path");
  parsed.searchParams.delete("__path");
  if (
    rest !== null &&
    (parsed.pathname === "/api" || parsed.pathname === "/api/")
  )
    parsed.pathname = `/api/${rest.replace(/^\/+/, "")}`;
  return parsed.pathname + parsed.search;
}

const safeMessage = (error: unknown) =>
  error instanceof Error &&
  /^[가-힣]/.test(error.message) &&
  !error.message.includes("http")
    ? error.message
    : "API를 시작하지 못했습니다. 배포 설정과 RPC를 확인하세요.";

let ready: Promise<FastifyInstance> | undefined;
async function start() {
  const service = new FundService();
  await service.initialize();
  const app = await createApp(service);
  await app.ready();
  return app;
}

/** 인스턴스마다 한 번 시작 검사를 한다. 실패하면 다음 요청에서 다시 시도한다. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  ready ??= start().catch((error) => {
    ready = undefined;
    throw error;
  });
  let app: FastifyInstance;
  try {
    app = await ready;
  } catch (error) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json; charset=utf-8");
    const body: ErrorResponse = {
      error: safeMessage(error),
      code: "unavailable",
    };
    res.end(JSON.stringify(body));
    return;
  }
  req.url = normalizeApiUrl(req.url);
  await new Promise<void>((resolve) => {
    res.once("finish", resolve);
    res.once("close", resolve);
    app.server.emit("request", req, res);
  });
}
