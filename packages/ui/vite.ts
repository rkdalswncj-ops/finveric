import { createReadStream, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** 공개 검증 설정(deployment*.json). scripts/deploy.ts와 scripts/dev.ts가 이곳에 쓴다. */
export const sharedPublic = fileURLToPath(new URL("./public", import.meta.url));

/**
 * 개발 서버에서도 배포와 같이 루트 경로(/deployment.json)로 검증 설정을 제공한다.
 * auditor 개발 서버는 /auditor/ 아래에서 실행되므로 이 미들웨어가 필요하다.
 */
function deploymentFiles(): Plugin {
  return {
    name: "finveric-deployment-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url
          ?.split("?")[0]
          .match(/^\/(deployment(?:-v[1-3])?\.json)$/)?.[1];
        const file = name && `${sharedPublic}/${name}`;
        if (!file || !existsSync(file)) return next();
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        createReadStream(file).pipe(res);
      });
    },
  };
}

/** client·auditor 앱의 공통 Vite 설정. 개발 중 /api는 로컬 Fastify로 보낸다. */
export function finvericVite({
  port,
  base = "/",
  publicDir,
}: {
  port: number;
  base?: string;
  publicDir: string | false;
}) {
  return defineConfig({
    base,
    publicDir,
    plugins: [react(), tailwindcss(), deploymentFiles()],
    server: {
      // Docker에서는 FINVERIC_HOST=0.0.0.0으로 컨테이너 밖에서 접속하게 한다.
      host: process.env.FINVERIC_HOST ?? "127.0.0.1",
      port,
      strictPort: true,
      fs: { allow: ["../.."] },
      proxy: {
        "/api": {
          // 다른 포트의 API로 확인할 때 FINVERIC_API_URL로 바꾼다.
          target: process.env.FINVERIC_API_URL ?? "http://127.0.0.1:3001",
          timeout: 240_000,
          proxyTimeout: 240_000,
        },
      },
    },
    build: { chunkSizeWarningLimit: 700 },
  });
}
