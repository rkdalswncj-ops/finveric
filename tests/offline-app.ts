// 원장 없이 띄우는 API. 문서, 경로, 인증처럼 원장을 읽지 않는 동작을 검사한다.
// RPC 주소는 닫힌 포트다. 판매 기록은 임시 디렉터리의 파일에 둔다.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { environment } from "../scripts/environment.ts";
import { FundService } from "../apps/api/src/service.ts";
import { createApp } from "../apps/api/src/app.ts";
import type { Deployment } from "../packages/core/src/index.ts";

type Context = { after: (fn: () => unknown) => void };

/** 접근 코드(`DEMO_TOKEN`)는 이 함수를 부르기 전에 환경 변수로 정한다. `file`은 판매 기록 파일이다. */
export async function offlineStack(t: Context) {
  const directory = mkdtempSync(join(tmpdir(), "finveric-openapi-"));
  const env = { ...environment("local"), rpcUrl: "http://127.0.0.1:1" };
  const address = (digit: string) => `0x${digit.repeat(40)}` as const;
  const dep: Deployment = {
    ledgerVersion: 5,
    proofKeyHash: "0".repeat(64),
    chainId: 31337,
    ledger: address("1"),
    verifier: address("2"),
    blockNumber: "0",
    rpcUrl: env.rpcUrl,
    coolingPeriod: 60,
    roles: {
      deployer: address("3"),
      seller: address("4"),
      approver: address("5"),
      customer: address("6"),
      infrastructure: address("7"),
    },
    verifierCodeHash: `0x${"0".repeat(64)}`,
    ledgerCodeHash: `0x${"0".repeat(64)}`,
  };
  const file = join(directory, "s.json");
  const service = new FundService({
    env,
    dep,
    file,
  });
  const app = await createApp(service);
  t.after(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { app, file };
}

export async function offlineApp(t: Context) {
  return (await offlineStack(t)).app;
}
