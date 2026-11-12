import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  http,
  type Hex,
} from "viem";
import { environment, deployment } from "./environment.ts";
import { randomField } from "../apps/api/src/modules/proofs.ts";
import {
  ledgerAbi,
  verifierAbi,
  PRODUCTS,
  field,
  json,
  type EvidenceReceipt,
} from "../packages/core/src/index.ts";

const env = environment();
const dep = deployment(env.network);
const evidence: EvidenceReceipt = JSON.parse(
  readFileSync(".local/demo/v4/receipt.json", "utf8"),
);
if (
  dep.ledgerVersion !== 4 ||
  evidence.format !== "finveric-receipt-v4" ||
  evidence.ledger.toLowerCase() !== dep.ledger.toLowerCase() ||
  evidence.chainId !== dep.chainId
)
  throw new Error("먼저 현재 원장에서 npm run demo를 실행하세요.");
const client = createPublicClient({
  chain: env.chain,
  transport: http(env.rpcUrl),
});
const customer = createWalletClient({
  account: env.accounts.customer,
  chain: env.chain,
  transport: http(env.rpcUrl),
});
const results: { action: string; txHash: Hex; status: string }[] = [];
const [txHash] = evidence.transactions;
if (evidence.transactions.length !== 1)
  throw new Error("가입 확정 거래가 한 건이어야 합니다.");
const tx = await client.getTransaction({ hash: txHash });
const decoded = decodeFunctionData({ abi: ledgerAbi, data: tx.input });
if (decoded.functionName !== "completeEnrollment")
  throw new Error("가입 확정 거래가 아닙니다.");
const original = decoded.args;
const [, productId, documentHash, ruleHash, proofs] = original;
const first = proofs[0];
const attackId = BigInt(randomField());
async function reject(action: string, args: typeof original) {
  const hash = await customer.writeContract({
    address: dep.ledger,
    abi: ledgerAbi,
    functionName: "completeEnrollment",
    args,
    gas: 1_500_000n,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 180_000,
  });
  if (receipt.status !== "reverted" || receipt.logs.length)
    throw new Error(`${action} · 거래가 일부 기록을 남겼거나 성공했습니다.`);
  results.push({ action, txHash: hash, status: receipt.status });
  console.log(`${action} · ${receipt.status} · ${hash}`);
}
await reject("중복 가입 확정 거절", original);
await reject("다른 판매 ID의 증명 재사용 거절", [
  attackId,
  productId,
  documentHash,
  ruleHash,
  [first],
  true,
  true,
  "0x",
]);
const forgedSignals = [...first.signals] as [...typeof first.signals];
forgedSignals[4] = attackId;
await reject("공개 판매 ID를 바꾼 증명 거절", [
  attackId,
  productId,
  documentHash,
  ruleHash,
  [{ ...first, signals: forgedSignals }],
  true,
  true,
  "0x",
]);
const [, ...publicInputs] = first.signals;
const changedProfile = [
  first.signals[0] === 3n ? 1n : 3n,
  ...publicInputs,
] as const;
if (
  await client.readContract({
    address: dep.verifier,
    abi: verifierAbi,
    functionName: "verifyProof",
    args: [first.a, first.b, first.c, changedProfile],
  })
)
  throw new Error("성향을 바꾼 증명이 검증을 통과했습니다.");
console.log("공개 투자성향을 바꾼 증명 거절");
const differentProduct = PRODUCTS.find((product) => product.id !== productId);
if (!differentProduct) throw new Error("비교할 상품이 없습니다.");
const changedDocument = [...first.signals] as [...typeof first.signals];
changedDocument[7] = BigInt(field(differentProduct.documentHash));
if (
  await client.readContract({
    address: dep.verifier,
    abi: verifierAbi,
    functionName: "verifyProof",
    args: [first.a, first.b, first.c, changedDocument],
  })
)
  throw new Error("다른 상품 설명서로 바꾼 증명이 검증을 통과했습니다.");
console.log("공개 설명서 지문을 다른 상품 것으로 바꾼 증명 거절");
const untouched = await client.readContract({
  address: dep.ledger,
  abi: ledgerAbi,
  functionName: "getSale",
  args: [attackId],
});
if (untouched.attempts !== 0 || untouched.finalized)
  throw new Error("실패 거래가 원장 상태를 변경했습니다.");
writeFileSync(
  ".local/demo/v4/attacks.json",
  json({ saleId: attackId.toString(), results }),
  { mode: 0o600 },
);
console.log("공격 시연 완료. 원래 고객 판매 건과 원본은 유지했습니다.");
