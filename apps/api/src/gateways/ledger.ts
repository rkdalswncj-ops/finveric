// 외부 연동: 원장(EVM) 읽기·쓰기. 판매 기록은 바꾸지 않는다. 기록은 modules/transactions.ts가 남긴다.
import {
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  type Hex,
  type TransactionReceipt,
  type TransactionSerializedEIP1559,
} from "viem";
import {
  ledgerAbi,
  RULE_HASH,
  type Role,
} from "../../../../packages/core/src/index.ts";
import type { FundService } from "../service.ts";

/** 원장 연동에 필요한 실행 맥락: 역할 키, 배포 설정, RPC 클라이언트. */
export type Chain = Pick<FundService, "env" | "dep" | "client">;

export const readChainId = (chain: Chain) => chain.client.getChainId();

/** 주소에 배포된 코드의 해시. 코드가 없으면 undefined. */
export async function readCodeHash(chain: Chain, address: Hex) {
  const code = await chain.client.getCode({ address });
  return code ? keccak256(code) : undefined;
}

export const readSale = (chain: Chain, id: string) =>
  chain.client.readContract({
    address: chain.dep.ledger,
    abi: ledgerAbi,
    functionName: "getSale",
    args: [BigInt(id)],
  });

/** 원장에 등록된 상품의 설명서 지문과 기준 투자성향. 등록 전이면 기준 투자성향이 0이다. */
export async function readProduct(chain: Chain, productId: Hex) {
  const call = {
    address: chain.dep.ledger,
    abi: ledgerAbi,
    args: [productId],
  } as const;
  const [documentHash, minimumProfile] = await Promise.all([
    chain.client.readContract({ ...call, functionName: "documents" }),
    chain.client.readContract({ ...call, functionName: "minimumProfiles" }),
  ]);
  return { documentHash, minimumProfile };
}

/** 진단 규칙 v3이 원장에 등록되어 있는지. */
export const readRule = (chain: Chain) =>
  chain.client.readContract({
    address: chain.dep.ledger,
    abi: ledgerAbi,
    functionName: "rules",
    args: [RULE_HASH],
  });

export async function readBlockTime(chain: Chain) {
  return (await chain.client.getBlock()).timestamp;
}

/** 역할 키로 원장 함수를 호출하고 거래 해시를 돌려준다. */
export function submit(
  chain: Chain,
  role: Role,
  functionName: string,
  args: unknown[],
) {
  const wallet = createWalletClient({
    account: chain.env.accounts[role],
    chain: chain.env.chain,
    transport: http(chain.env.rpcUrl),
  });
  // Fixed gas also lets the missing-record demonstration reach the EVM and produce a reverted receipt.
  return wallet.writeContract({
    address: chain.dep.ledger,
    abi: ledgerAbi,
    functionName: functionName as any,
    args: args as any,
    gas: 1_500_000n,
  });
}

/**
 * 역할 키로 원장 호출 거래에 서명만 한다. 보내지는 않는다.
 * 서명한 원문을 보관하면 같은 해시·nonce로 다시 보낼 수 있다.
 */
export async function signTransaction(
  chain: Chain,
  role: Role,
  data: Hex,
  gas: bigint,
) {
  const account = chain.env.accounts[role];
  const wallet = createWalletClient({
    account,
    chain: chain.env.chain,
    transport: http(chain.env.rpcUrl),
  });
  const { nonce, maxFeePerGas, maxPriorityFeePerGas } =
    await wallet.prepareTransactionRequest({
      type: "eip1559",
      to: chain.dep.ledger,
      data,
      gas,
    });
  const rawTransaction = (await account.signTransaction({
    type: "eip1559",
    chainId: chain.dep.chainId,
    to: chain.dep.ledger,
    data,
    gas,
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
  })) as TransactionSerializedEIP1559;
  return { rawTransaction, txHash: keccak256(rawTransaction) };
}

export const broadcast = (
  chain: Chain,
  rawTransaction: TransactionSerializedEIP1559,
) => chain.client.sendRawTransaction({ serializedTransaction: rawTransaction });

export const getReceipt = (chain: Chain, hash: Hex) =>
  chain.client.getTransactionReceipt({ hash });

export const waitForReceipt = (
  chain: Chain,
  hash: Hex,
  options: { checkReplacement?: boolean } = {},
) =>
  chain.client.waitForTransactionReceipt({
    hash,
    timeout: 180_000,
    ...options,
  });

/** 영수증에서 이 원장이 남긴 이벤트만 고른다. */
export function ledgerEvents(chain: Chain, receipt: TransactionReceipt) {
  return parseEventLogs({ abi: ledgerAbi, logs: receipt.logs }).filter(
    (log) => log.address.toLowerCase() === chain.dep.ledger.toLowerCase(),
  );
}
