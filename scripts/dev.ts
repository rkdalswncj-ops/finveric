import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { environment } from "./environment.ts";
import { proofKeyHash } from "./artifacts.ts";
// @ts-expect-error The portable binary resolver is a JavaScript entry point.
import { foundryBinary } from "./foundry.mjs";
const env = environment();
// 서버가 받을 주소. Docker에서는 0.0.0.0으로 컨테이너 밖에서 접속하게 한다.
const host = process.env.FINVERIC_HOST ?? "127.0.0.1";
const children: ChildProcess[] = [];
const run = (cmd: string, args: string[], options: object = {}) => {
  const child = spawn(cmd, args, { stdio: "inherit", ...options });
  children.push(child);
  return child;
};
const complete = async (cmd: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = run(cmd, args);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} 실패 (${code})`)),
    );
    child.on("error", reject);
  });
const stop = () => {
  for (const child of children) child.kill("SIGTERM");
};
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
try {
  await complete("npm", ["run", "zk:setup"]);
  if (env.network === "local") {
    mkdirSync(".local", { recursive: true, mode: 0o700 });
    const rpc = createPublicClient({
      transport: http(env.rpcUrl, { timeout: 1000, retryCount: 0 }),
    });
    let running = false;
    try {
      running = (await rpc.getChainId()) === 31337;
    } catch {}
    if (!running) {
      const log = openSync(".local/anvil.log", "a", 0o600);
      run(
        foundryBinary("anvil"),
        [
          "--host",
          host,
          "--port",
          "8545",
          "--chain-id",
          "31337",
          "--state",
          ".local/anvil-state.json",
          "--state-interval",
          "10",
          "--allow-origin",
          "*",
        ],
        { stdio: ["ignore", log, log] },
      );
      for (let i = 0; i < 50; i++) {
        try {
          if ((await rpc.getChainId()) === 31337) {
            running = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!running)
        throw new Error("Anvil 시작 실패. .local/anvil.log를 확인하세요.");
    }
    const file = ".local/deployment-local.json";
    let needsDeploy = !existsSync(file);
    if (!needsDeploy) {
      const { deployment } = await import("./environment.ts");
      const dep = deployment("local");
      needsDeploy =
        dep.ledgerVersion !== 4 ||
        dep.ruleVersion !== 3 ||
        !(await rpc.getCode({ address: dep.ledger })) ||
        dep.proofKeyHash !== proofKeyHash();
    }
    if (needsDeploy) {
      await complete("npm", ["run", "contracts:build"]);
      await complete("npm", ["run", "deploy:local"]);
    } else {
      const { copyFileSync } = await import("node:fs");
      mkdirSync("packages/ui/public", { recursive: true });
      copyFileSync(file, "packages/ui/public/deployment.json");
    }
  }
  run("tsx", ["apps/api/src/index.ts"], {
    env: { ...process.env, HOST: host },
  });
  // client는 기관 업무와 판매 채널 시연, auditor는 독립 검증이다.
  run("npm", ["run", "dev", "-w", "@finveric/client"], {
    env: {
      ...process.env,
      VITE_AUDITOR_URL: "http://127.0.0.1:5174/auditor/",
    },
  });
  run("npm", ["run", "dev", "-w", "@finveric/auditor"]);
  console.log(
    "FINVERIC 기관 업무: http://127.0.0.1:5173/client/ · 독립 검증: http://127.0.0.1:5174/auditor/ · Ctrl+C로 종료",
  );
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : "시작 실패");
  process.exitCode = 1;
}
