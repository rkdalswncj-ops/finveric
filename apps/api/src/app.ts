import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { json } from "../../../packages/core/src/index.ts";
import { FundService } from "./service.ts";
import { productRoutes } from "./routes/products.ts";
import { recordRoutes } from "./routes/records.ts";
import { saleRoutes } from "./routes/sales.ts";
import { systemRoutes } from "./routes/system.ts";

/** 로컬 Vite 개발 서버. client·auditor 앱이 각자 다른 포트를 쓴다. */
const DEV_ORIGINS = [5173, 5174].flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);
const configuredOrigins = (env: NodeJS.ProcessEnv) =>
  (env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
/** POST를 받을 출처. WEB_ORIGIN은 쉼표로 여러 개를 지정할 수 있다. */
export function allowedOrigins(env: NodeJS.ProcessEnv = process.env) {
  return [...configuredOrigins(env), ...DEV_ORIGINS];
}
/** 다른 도메인의 웹을 허용하는 CORS 목록. WEB_ORIGIN을 지정하면 그 출처만 허용한다. */
export function corsOrigins(env: NodeJS.ProcessEnv = process.env) {
  const configured = configuredOrigins(env);
  return configured.length ? configured : DEV_ORIGINS;
}
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
/** 웹과 API를 같은 도메인에 배포하면 요청 출처가 API 주소와 같다. Vercel 프리뷰 주소도 여기에 해당한다. */
export function sameSiteOrigin(headers: Record<string, unknown>) {
  const host =
    first(headers["x-forwarded-host"] as string | undefined) ??
    first(headers.host as string | undefined);
  const proto = first(headers["x-forwarded-proto"] as string | undefined);
  return host ? `${proto ?? "http"}://${host}` : undefined;
}
export async function createApp(service = new FundService()) {
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  const token = process.env.DEMO_TOKEN;
  if (
    (service.env.network === "sepolia" ||
      process.env.NODE_ENV === "production") &&
    (!token || token.length < 32)
  )
    throw new Error("외부 시연에는 32자 이상의 DEMO_TOKEN이 필요합니다.");
  const origins = allowedOrigins();
  await app.register(cors, { origin: corsOrigins(), methods: ["GET", "POST"] });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("preHandler", async (req, reply) => {
    if (
      req.url === "/api/health" ||
      req.url === "/api/config" ||
      req.method === "OPTIONS"
    )
      return;
    if (token) {
      const supplied = Buffer.from(
        (req.headers.authorization ?? "").replace(/^Bearer /, ""),
      );
      const expected = Buffer.from(token);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        return reply.code(401).send({ error: "시연 접근 코드를 확인하세요." });
    }
    if (
      req.method === "POST" &&
      req.headers.origin &&
      req.headers.origin !== sameSiteOrigin(req.headers) &&
      !origins.includes(req.headers.origin)
    )
      return reply.code(403).send({ error: "허용하지 않은 출처입니다." });
  });
  app.setSerializerCompiler(() => (value) => json(value));
  app.addHook("preSerialization", async (_req, _reply, payload) =>
    JSON.parse(json(payload)),
  );
  app.setErrorHandler((error, _req, reply) => {
    if (error && typeof error === "object" && "validation" in error)
      return reply
        .code(400)
        .send({ error: "입력 형식과 허용 범위를 확인하세요." });
    const message =
      error instanceof Error ? error.message : "처리를 완료하지 못했습니다.";
    // Errors from RPC providers may contain credential-bearing URLs. Only return our authored messages.
    const safe =
      /^[가-힣]/.test(message) && !message.includes("http")
        ? message
        : "서버 연결과 온체인 처리 기록을 확인하세요.";
    reply.code(409).send({ error: safe });
  });
  // 경로는 업무별 파일에 있다. 위의 접근 코드·출처 검사가 모든 경로에 적용된다.
  systemRoutes(app, service, { requiresToken: !!token });
  productRoutes(app, service);
  saleRoutes(app, service);
  recordRoutes(app, service);
  return app;
}
