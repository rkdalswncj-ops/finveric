import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { toHex, type Hex } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { anvil, sepolia } from "viem/chains";
import {
  ROLES,
  customerRefSecret,
  type Deployment,
  type Role,
} from "../packages/core/src/index.ts";
import { fromRoot } from "./root.ts";

export const roles: readonly Role[] = ROLES;
/** 녹취·숙려 대상의 최소 경과 시간(초). 로컬과 Sepolia 시연 모두 60초다. */
export const COOLING_PERIOD = 60;
const LOCAL_MNEMONIC =
  "test test test test test test test test test test test junk";
const isKey = (value: unknown): value is Hex =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

/**
 * 역할별 키와 RPC. 로컬은 Anvil 테스트 계정(0~4번)을, Sepolia는 .env.sepolia의 `<ROLE>_PRIVATE_KEY`를 쓴다.
 * 고객 가명 ID 비밀값은 CUSTOMER_REF_SECRET, 없으면 판매사 키에서 만든다.
 */
export function environment(network = process.env.NETWORK ?? "local") {
  if (!["local", "sepolia"].includes(network))
    throw new Error("NETWORK는 local 또는 sepolia여야 합니다.");
  config({
    path: network === "sepolia" ? ".env.sepolia" : ".env",
    quiet: true,
  });
  const chain = network === "sepolia" ? sepolia : anvil;
  const keys = Object.fromEntries(
    roles.map((role, i) => {
      if (network === "local") {
        const key = mnemonicToAccount(LOCAL_MNEMONIC, {
          addressIndex: i,
        }).getHdKey().privateKey!;
        return [role, toHex(key)];
      }
      const key = process.env[`${role.toUpperCase()}_PRIVATE_KEY`];
      if (!isKey(key))
        throw new Error(
          `.env.sepolia의 ${role.toUpperCase()}_PRIVATE_KEY를 설정하세요. npm run sepolia:prepare가 빠진 키를 더합니다.`,
        );
      return [role, key];
    }),
  ) as Record<Role, Hex>;
  const accounts = Object.fromEntries(
    roles.map((role) => [role, privateKeyToAccount(keys[role])]),
  ) as Record<Role, ReturnType<typeof privateKeyToAccount>>;
  if (
    new Set(Object.values(accounts).map((a) => a.address.toLowerCase()))
      .size !== roles.length
  )
    throw new Error("역할별 지갑이 달라야 합니다.");
  const secret = process.env.CUSTOMER_REF_SECRET;
  if (secret !== undefined && !/^0x[0-9a-fA-F]{2,}$/.test(secret))
    throw new Error("CUSTOMER_REF_SECRET은 0x로 시작하는 hex여야 합니다.");
  return {
    network,
    chain,
    accounts,
    customerRefSecret:
      (secret as Hex | undefined) ?? customerRefSecret(keys.seller),
    rpcUrl:
      process.env.RPC_URL ??
      (network === "local"
        ? "http://127.0.0.1:8545"
        : "https://ethereum-sepolia-rpc.publicnode.com"),
  };
}
export type Environment = ReturnType<typeof environment>;

export function deployment(
  network = process.env.NETWORK ?? "local",
): Deployment {
  return JSON.parse(
    readFileSync(fromRoot(`.local/deployment-${network}.json`), "utf8"),
  );
}
