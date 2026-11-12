import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { anvil, sepolia } from "viem/chains";
import type { Deployment, Role } from "../packages/core/src/index.ts";
import { fromRoot } from "./root.ts";

export const roles: Role[] = [
  "deployer",
  "manager",
  "seller",
  "compliance",
  "customer",
  "infrastructure",
];
export function environment(network = process.env.NETWORK ?? "local") {
  if (!["local", "sepolia"].includes(network))
    throw new Error("NETWORK는 local 또는 sepolia여야 합니다.");
  config({
    path: network === "sepolia" ? ".env.sepolia" : ".env",
    quiet: true,
  });
  const chain = network === "sepolia" ? sepolia : anvil;
  const accounts = Object.fromEntries(
    roles.map((role, i) => {
      if (network === "local")
        return [
          role,
          mnemonicToAccount(
            "test test test test test test test test test test test junk",
            { addressIndex: i },
          ),
        ];
      const key = process.env[`${role.toUpperCase()}_PRIVATE_KEY`];
      if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key))
        throw new Error(
          `.env.sepolia의 ${role.toUpperCase()}_PRIVATE_KEY를 설정하세요.`,
        );
      return [role, privateKeyToAccount(key as `0x${string}`)];
    }),
  ) as Record<Role, ReturnType<typeof privateKeyToAccount>>;
  if (
    new Set(Object.values(accounts).map((a) => a.address.toLowerCase()))
      .size !== roles.length
  )
    throw new Error("역할별 지갑이 달라야 합니다.");
  return {
    network,
    chain,
    accounts,
    rpcUrl:
      process.env.RPC_URL ??
      (network === "local"
        ? "http://127.0.0.1:8545"
        : "https://ethereum-sepolia-rpc.publicnode.com"),
  };
}
export function deployment(
  network = process.env.NETWORK ?? "local",
): Deployment {
  return JSON.parse(
    readFileSync(fromRoot(`.local/deployment-${network}.json`), "utf8"),
  );
}
