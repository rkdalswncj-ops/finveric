import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeAbiParameters,
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
  createLedgerSnapshotReader,
  readLedger,
  readLedgerLogs,
} from "@finveric/core/ledger";
import {
  createLedgerVerificationReader,
  verifySale,
} from "@finveric/core/verify";

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
const blockHash = (block: bigint) => toHex(block, { size: 32 });

const diagnosis = (
  block: bigint,
  attempt: number,
  hash = blockHash(block),
) => ({
  ...makeLog(block, 0),
  blockHash: hash,
  topics: encodeEventTopics({
    abi: ledgerAbi,
    eventName: "DiagnosisRecorded",
    args: { customerRef: 3n, attempt },
  }),
  data: encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint8" },
      { type: "uint8" },
      { type: "bool" },
    ],
    [1n, 2n, 3, 4, false],
  ),
});

const subscription = (block: bigint) => ({
  ...makeLog(block, 0),
  topics: encodeEventTopics({
    abi: ledgerAbi,
    eventName: "SaleSubscribed",
    args: { saleId: 22n, customerRef: 3n },
  }),
  data: encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "bool" },
      { type: "bool" },
      { type: "uint256" },
      { type: "uint32" },
    ],
    [zero, 1, 1, true, false, 1n, 60],
  ),
});

function rpc(
  tip: bigint | (() => bigint),
  getLogs: (range: Range) => unknown[],
  fail?: (method: string, functionName?: string) => void,
  hash = blockHash,
) {
  const calls: Range[] = [];
  const methods: string[] = [];
  const blocks: bigint[] = [];
  const contractBlocks: unknown[] = [];
  const latest = () => (typeof tip === "bigint" ? tip : tip());
  const client = createPublicClient({
    chain: sepolia,
    transport: custom(
      {
        async request({ method, params }) {
          methods.push(method);
          if (method !== "eth_call") fail?.(method);
          if (method === "eth_chainId") return toHex(sepolia.id);
          if (method === "eth_getCode") return code;
          if (method === "eth_blockNumber") return toHex(latest());
          if (method === "eth_getBlockByNumber") {
            const [at] = params as [Hex | "latest"];
            const block = at === "latest" ? latest() : BigInt(at);
            blocks.push(block);
            return {
              number: toHex(block),
              hash: hash(block),
              parentHash: hash(block - 1n),
              timestamp: toHex(block * 12n),
              transactions: [],
            };
          }
          if (method === "eth_getLogs") {
            const [filter] = params as [{ fromBlock: Hex; toBlock: Hex }];
            const range: Range = [
              BigInt(filter.fromBlock),
              BigInt(filter.toBlock),
            ];
            calls.push(range);
            return getLogs(range);
          }
          if (method === "eth_getTransactionByHash")
            return { to: dep.ledger, input: "0x" };
          if (method === "eth_call") {
            const [call, at] = params as [{ data: Hex }, unknown];
            contractBlocks.push(at);
            const { functionName } = decodeFunctionData({
              abi: ledgerAbi,
              data: call.data,
            });
            fail?.(method, functionName);
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
            if (functionName === "getDiagnosis")
              return encodeFunctionResult({
                abi: ledgerAbi,
                functionName,
                result: {
                  ruleHash: 1n,
                  commitment: 2n,
                  profile: 3,
                  limit: 4,
                  elderly: false,
                  recordedAt: 1212n,
                },
              });
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        },
      },
      { retryCount: 0 },
    ),
  });
  return { calls, client, methods, blocks, contractBlocks };
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

test("PublicNode 첫 조회는 1만 블록씩 읽고 범위 제한에 맞춰 줄인다", async () => {
  const publicnode = {
    ...dep,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  };
  const allowed = rpc(10100n, () => []);
  await readLedgerLogs(publicnode, allowed.client);
  assert.deepEqual(allowed.calls, [
    [100n, 10099n],
    [10100n, 10100n],
  ]);

  const limited = rpc(10100n, ([from, to]) => {
    if (to - from + 1n > 5000n) throw limit("maximum block range is 5,000");
    return [];
  });
  await readLedgerLogs(publicnode, limited.client);
  assert.deepEqual(limited.calls, [
    [100n, 10099n],
    [100n, 5099n],
    [5100n, 10099n],
    [10100n, 10100n],
  ]);
});

test("반복 조회는 같은 블록의 결과를 쓰고 새 블록에서만 이벤트와 시각을 읽는다", async () => {
  let tip = 105n;
  const events = [diagnosis(101n, 1), diagnosis(107n, 2)];
  const { client, calls, blocks } = rpc(
    () => tip,
    ([from, to]) =>
      events.filter(
        (log) =>
          BigInt(log.blockNumber) >= from && BigInt(log.blockNumber) <= to,
      ),
  );
  const read = createLedgerSnapshotReader(dep, client);
  const first = await read();
  assert.deepEqual(
    first.diagnoses.map(({ attempt }) => attempt),
    [1],
  );
  assert.equal(await read(), first);
  tip = 107n;
  const second = await read();
  assert.deepEqual(calls, [
    [100n, 105n],
    [106n, 107n],
  ]);
  assert.deepEqual(blocks, [105n, 101n, 105n, 105n, 107n, 105n, 107n]);
  assert.deepEqual(
    second.diagnoses.map(({ at }) => at),
    [1212, 1284],
  );
  assert.deepEqual(
    first.diagnoses.map(({ attempt }) => attempt),
    [1],
  );
});

test("이전에 읽은 블록의 해시가 바뀌면 새 체인에서 전체 이벤트를 읽는다", async () => {
  let replaced = false;
  const hash = (n: bigint) => blockHash(replaced && n >= 104n ? n + 1000n : n);
  const { client, calls } = rpc(
    () => (replaced ? 106n : 105n),
    () => (replaced ? [diagnosis(104n, 2, hash(104n))] : [diagnosis(105n, 1)]),
    undefined,
    hash,
  );
  const read = createLedgerSnapshotReader(dep, client);
  assert.deepEqual(
    (await read()).diagnoses.map(({ attempt }) => attempt),
    [1],
  );
  replaced = true;
  assert.deepEqual(
    (await read()).diagnoses.map(({ attempt }) => attempt),
    [2],
  );
  assert.deepEqual(calls, [
    [100n, 105n],
    [100n, 106n],
  ]);
});

test("읽는 중 블록이 교체되면 완성된 조회로 보관하지 않는다", async () => {
  let fork = 0n;
  const { client, calls } = rpc(
    105n,
    () => {
      if (fork === 0n) fork = 1000n;
      return [];
    },
    undefined,
    (n) => blockHash(n + fork),
  );
  const read = createLedgerSnapshotReader(dep, client);
  await assert.rejects(read(), (error) => ledgerReadCode(error) === "V05");
  assert.equal((await read()).latestBlock, 105n);
  assert.deepEqual(calls, [
    [100n, 105n],
    [100n, 105n],
  ]);
});

test("한 조회의 증빙 대조는 배포 검사와 같은 블록의 조회 결과를 공유한다", async () => {
  const { client, methods, contractBlocks } = rpc(100n, () => []);
  const read = createLedgerVerificationReader(dep, client);
  const verification = await read();
  const outcomes = await Promise.all([
    verification.verifySale("1"),
    verification.verifySale(
      "1",
      {} as NonNullable<Parameters<typeof verifySale>[2]>,
    ),
    verification.verifySale("2"),
  ]);
  assert.ok(outcomes.every(({ outcome }) => outcome === "missing"));
  assert.equal(outcomes[1].checks.length, outcomes[0].checks.length + 1);
  assert.equal(methods.filter((method) => method === "eth_chainId").length, 1);
  assert.equal(methods.filter((method) => method === "eth_getCode").length, 2);
  assert.equal(methods.filter((method) => method === "eth_getLogs").length, 1);
  assert.deepEqual(contractBlocks, ["0x64", "0x64", "0x64"]);
});

test("진단 기록을 읽지 못하면 RPC 확인 코드를 전달한다", async (t) => {
  const cases = [
    { operation: "getDiagnosis", code: "V06" },
    { operation: "eth_getTransactionByHash", code: "V10" },
  ];
  for (const { operation, code } of cases)
    await t.test(operation, async () => {
      let unavailable = true;
      const { client } = rpc(
        102n,
        () => [diagnosis(101n, 1), subscription(102n)],
        (method, functionName) => {
          if (unavailable && (functionName ?? method) === operation)
            throw new Error(
              "read failed at https://rpc.example.invalid/key/test",
            );
        },
      );
      const read = createLedgerVerificationReader(dep, client);
      const verification = await read();
      await assert.rejects(verification.verifySale("22"), (error: Error) => {
        assert.equal(ledgerReadCode(error), code);
        assert.doesNotMatch(error.message, /rpc\.example/);
        return true;
      });
      unavailable = false;
      assert.equal((await verification.verifySale("22")).outcome, "mismatch");
    });
});
