// Sepolia 시연 키를 .env.sepolia에 만든다. 파일이 있으면 빠진 역할 키만 더한다(예: v5의 APPROVER).
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { generatePrivateKey } from "viem/accounts";
import { createPublicClient, http, formatEther } from "viem";
import { randomBytes } from "node:crypto";
import { environment, roles } from "./environment.ts";

const file = ".env.sepolia";
const keyLine = (role: string) =>
  `${role.toUpperCase()}_PRIVATE_KEY=${generatePrivateKey()}`;
if (!existsSync(file)) {
  writeFileSync(
    file,
    [
      "# Sepolia 시연 전용. 실제 자산을 넣지 마세요. Git에 커밋하지 마세요.",
      "NETWORK=sepolia",
      "RPC_URL=https://ethereum-sepolia-rpc.publicnode.com",
      "PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com",
      `DEMO_TOKEN=${randomBytes(32).toString("hex")}`,
      ...roles.map(keyLine),
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
} else {
  const text = readFileSync(file, "utf8");
  const missing = roles.filter(
    (role) =>
      !new RegExp(`^${role.toUpperCase()}_PRIVATE_KEY=`, "m").test(text),
  );
  if (missing.length) {
    appendFileSync(
      file,
      (text.endsWith("\n") ? "" : "\n") +
        missing.map(keyLine).join("\n") +
        "\n",
    );
    console.log(`빠진 역할 키를 더했습니다: ${missing.join(", ")}`);
  }
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
