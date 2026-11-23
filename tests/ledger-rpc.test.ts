import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeEventTopics,
  encodeFunctionResult,
  keccak256,
  toHex,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { ledgerAbi, type Deployment } from "@finveric/core";
import {
  ledgerReadCode,
  readLedger,
  readLedgerLogs,
} from "@finveric/core/ledger";
import { verifySale } from "@finveric/core/verify";

const zero = toHex(0, { size: 32 });
const code = "0x1234";
const addr = (n: number) => toHex(n, { size: 20 });
const dep: Deployment = {
  ledgerVersion: 5,
  proofKeyHash: "",
  chainId: sepolia.id,
  ledger: addr(1),
  verifier: addr(2),
  blockNumber: "100",
  rpcUrl: "https://rpc.example.invalid",
  coolingPeriod: 60,
  roles: {
    deployer: addr(3),
    seller: addr(4),
    approver: addr(5),
    customer: addr(6),
    infrastructure: addr(7),
  },
  ledgerCodeHash: keccak256(code),
  verifierCodeHash: keccak256(code),
};
const makeLog = (block: bigint, index: number) => ({
  address: dep.ledger,
  blockHash: toHex(block, { size: 32 }),
  blockNumber: toHex(block),
  data: "0x",
  logIndex: toHex(index),
  removed: false,
  topics: encodeEventTopics({
    abi: ledgerAbi,
    eventName: "EnrollmentConfirmed",
    args: { saleId: 22n, customerRef: 3n },
  }),
  transactionHash: toHex(block + BigInt(index), { size: 32 }),
  transactionIndex: "0x0",
});
type Range = [bigint, bigint];

function rpc(
  tip: bigint,
  getLogs: (range: Range) => unknown[],
  fail?: (method: string) => void,
) {
  const calls: Range[] = [];
  const methods: string[] = [];
  const client = createPublicClient({
    chain: sepolia,
    transport: custom(
      {
        async request({ method, params }) {
          methods.push(method);
          fail?.(method);
          if (method === "eth_chainId") return toHex(sepolia.id);
          if (method === "eth_getCode") return code;
          if (method === "eth_blockNumber") return toHex(tip);
          if (method === "eth_getLogs") {
            const [filter] = params as [{ fromBlock: Hex; toBlock: Hex }];
            const range: Range = [
              BigInt(filter.fromBlock),
              BigInt(filter.toBlock),
            ];
            calls.push(range);
            return getLogs(range);
          }
          if (method === "eth_call") {
            const [call] = params as [{ data: Hex }];
            const { functionName } = decodeFunctionData({
              abi: ledgerAbi,
              data: call.data,
            });
            if (functionName === "getSale")
              return encodeFunctionResult({
                abi: ledgerAbi,
                functionName,
                result: {
                  customerRef: 0n,
                  productId: zero,
                  recordingHash: zero,
                  amount: 0n,
                  productVersion: 0,
                  attempt: 0,
                  explanationSeconds: 0,
                  suitable: false,
                  protectedSale: false,
                  higherRiskConfirmed: false,
                  approved: false,
                  status: 0,
                  subscribedAt: 0n,
                  confirmedAt: 0n,
                  withdrawnAt: 0n,
                  settledAt: 0n,
                },
              });
            if (functionName === "coolingPeriod")
              return encodeFunctionResult({
                abi: ledgerAbi,
                functionName,
                result: 60n,
              });
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        },
      },
      { retryCount: 0 },
    ),
  });
  return { calls, client, methods };
}

const limit = (message: string, code = -32005) =>
  Object.assign(new Error(message), { code });

test("범위 제한 뒤에도 경계의 이벤트를 빠뜨리거나 두 번 읽지 않는다", async () => {
  const entries = [
    makeLog(100n, 0),
    makeLog(1099n, 1),
    makeLog(1100n, 0),
    makeLog(1100n, 1),
    makeLog(2101n, 0),
  ];
  const { calls, client } = rpc(2101n, ([from, to]) => {
    if (to - from + 1n > 1000n) throw limit("maximum block range is 1,000");
    return entries
      .filter(
        (item) =>
          BigInt(item.blockNumber) >= from && BigInt(item.blockNumber) <= to,
      )
      .reverse();
  });
  const { logs, latest } = await readLedgerLogs(dep, client);
  assert.equal(latest, 2101n);
  assert.deepEqual(calls, [
    [100n, 2099n],
    [100n, 1099n],
    [1100n, 2099n],
    [2100n, 2101n],
  ]);
  assert.deepEqual(
    logs.map(({ blockNumber, logIndex }) => [blockNumber, logIndex]),
    entries.map(({ blockNumber, logIndex }) => [
      BigInt(blockNumber),
      Number(logIndex),
    ]),
  );
});

test("고객 기록 확인은 결과 크기 제한을 이긴 뒤에만 기록 없음을 반환한다", async () => {
  const { calls, client, methods } = rpc(109n, ([from, to]) => {
    if (to - from + 1n > 5n)
      throw limit("query returned more than 10,000 results");
    return [];
  });
  const verified = await verifySale(dep, "1", undefined, undefined, { client });
  assert.equal(verified.outcome, "missing");
  assert.deepEqual(calls, [
    [100n, 109n],
    [100n, 104n],
    [105n, 109n],
  ]);
  assert.equal(methods.filter((x) => x === "eth_getCode").length, 2);
  assert.equal(methods.filter((x) => x === "eth_call").length, 2);
});

test("중간 요청 실패는 불완전한 기록 없음으로 돌아오지 않는다", async () => {
  const { calls, client, methods } = rpc(2100n, ([from]) => {
    if (from !== 100n)
      throw limit(
        "rate limit exceeded at https://rpc.example.invalid/key/secret",
      );
    return [];
  });
  await assert.rejects(
    verifySale(dep, "1", undefined, undefined, { client }),
    (error: Error) => {
      assert.equal(ledgerReadCode(error), "V04");
      assert.doesNotMatch(error.message, /secret|rpc\.example/);
      return true;
    },
  );
  assert.deepEqual(calls, [
    [100n, 2099n],
    [2100n, 2100n],
  ]);
  assert.ok(!methods.includes("eth_call"));
});

test("축소 요청에도 상한이 있고 단일 블록 실패는 재시도하지 않는다", async () => {
  const { calls, client } = rpc(199n, ([from, to]) => {
    if (to !== from) throw limit("block range is too wide");
    return [];
  });
  await assert.rejects(
    readLedger(dep, client),
    (error) => ledgerReadCode(error) === "V07",
  );
  assert.equal(calls.length, 65);

  const single = rpc(100n, () => {
    throw limit("log response size exceeded");
  });
  await assert.rejects(
    readLedger(dep, single.client),
    (error) => ledgerReadCode(error) === "V04",
  );
  assert.deepEqual(single.calls, [[100n, 100n]]);
});

test("시작 블록 이전의 RPC 응답을 빈 원장으로 해석하지 않는다", async () => {
  const { calls, client } = rpc(99n, () => []);
  await assert.rejects(
    readLedger(dep, client),
    /최신 블록이 원장 배포 블록보다 이전/,
  );
  assert.deepEqual(calls, []);
});

test("원장 로그 이후의 블록 조회 실패도 경계를 구분한다", async () => {
  const { client } = rpc(
    100n,
    () => [makeLog(100n, 0)],
    (method) => {
      if (method === "eth_getBlockByNumber")
        throw new Error("Provider unavailable");
    },
  );
  await assert.rejects(
    readLedger(dep, client),
    (error) => ledgerReadCode(error) === "V05",
  );
});
