import { createReadStream, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 웹은 Vite 앱 하나에 페이지 네 개다. 배포와 같은 경로를 한 개발 서버가 제공한다.
// - /         진입 화면(index.html)
// - /client/  판매사 콘솔(client/index.html)
// - /auditor/ 감독기관 화면(auditor/index.html)
// - /channel/ 증권사 앱 예시. FINVERIC API로 만든 고객 화면(channel/index.html)
// 페이지마다 번들을 따로 만든다. 판매사 콘솔 코드는 다른 페이지에 실리지 않는다.
const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const pages = {
  entry: page("./index.html"),
  client: page("./client/index.html"),
  auditor: page("./auditor/index.html"),
  channel: page("./channel/index.html"),
};
/**
 * 공개 검증 설정(deployment*.json). scripts/deploy.ts와 scripts/dev.ts가 이곳에 쓴다.
 * 격리한 검사 환경은 FINVERIC_DEPLOYMENT_DIR로 다른 디렉터리를 지정한다.
 */
const sharedPublic =
  process.env.FINVERIC_DEPLOYMENT_DIR ?? page("../../packages/ui/public");

/**
 * 개발 서버를 배포와 같은 경로로 맞춘다.
 * - /client/*, /auditor/*, /channel/*의 화면 요청은 그 페이지의 index.html로 보낸다(SPA 경로).
 * - 검증 설정은 배포처럼 사이트 루트(/deployment.json)에서 제공한다.
 */
function devServerPaths(): Plugin {
  return {
    name: "finveric-dev-server-paths",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        const app = path.match(/^\/(client|auditor|channel)(?:\/[^.]*)?$/)?.[1];
        if (app && req.headers.accept?.includes("text/html")) {
          req.url = `/${app}/index.html`;
          return next();
        }
        const name = path.match(/^\/(deployment(?:-v[1-3])?\.json)$/)?.[1];
        const file = name && `${sharedPublic}/${name}`;
        if (!file || !existsSync(file)) return next();
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  appType: "mpa",
  publicDir: false,
  plugins: [react(), tailwindcss(), devServerPaths()],
  server: {
    // Docker에서는 FINVERIC_HOST=0.0.0.0으로 컨테이너 밖에서 접속하게 한다.
    host: process.env.FINVERIC_HOST ?? "127.0.0.1",
    port: 5173,
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
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: { input: pages },
  },
});
