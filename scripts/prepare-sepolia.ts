import { existsSync, writeFileSync } from "node:fs";
import { generatePrivateKey } from "viem/accounts";
import { createPublicClient, http, formatEther } from "viem";
import { randomBytes } from "node:crypto";
import { environment, roles } from "./environment.ts";

if (!existsSync(".env.sepolia")) {
  const lines = roles.map(
    (role) => `${role.toUpperCase()}_PRIVATE_KEY=${generatePrivateKey()}`,
  );
  writeFileSync(
    ".env.sepolia",
    [
      "# Sepolia 시연 전용. 실제 자산을 넣지 마세요. Git에 커밋하지 마세요.",
      "NETWORK=sepolia",
      "RPC_URL=https://ethereum-sepolia-rpc.publicnode.com",
      "PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com",
      `DEMO_TOKEN=${randomBytes(32).toString("hex")}`,
      ...lines,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
}
const env = environment("sepolia");
console.log("Sepolia 테스트 ETH 충전 주소:", env.accounts.deployer.address);
console.log(
  "권장 충전량: 0.03 Sepolia ETH. 개인키는 .env.sepolia에 보관했습니다.",
);
try {
  const client = createPublicClient({
    chain: env.chain,
    transport: http(env.rpcUrl, { timeout: 12_000, retryCount: 0 }),
  });
  if ((await client.getChainId()) !== 11155111)
    throw new Error("Sepolia가 아닌 RPC입니다.");
  console.log(
    "현재 Sepolia 잔액:",
    formatEther(
      await client.getBalance({ address: env.accounts.deployer.address }),
    ),
    "ETH",
  );
} catch {
  console.log("RPC 조회 실패. .env.sepolia의 RPC_URL을 확인하세요.");
}
