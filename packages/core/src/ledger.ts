// 원장 이벤트 읽기. 감독기관 화면, 가입 기록 확인, 위험 신호가 판매사 API 없이 RPC로 읽는다.
import {
  createPublicClient,
  http,
  keccak256,
  stringToHex,
  type Hex,
  type PublicClient,
} from "viem";
import { anvil, sepolia } from "viem/chains";
import { ledgerAbi } from "./abi.ts";
import { canonical, fieldHex } from "./encoding.ts";
import {
  productDocumentHash,
  productId,
  productText,
  validateProduct,
  type ProductDocument,
} from "./products.ts";
import { ruleHash, validateRule, type RuleDocument } from "./rules.ts";
import type { Deployment } from "./index.ts";

/** 이벤트를 나눠 읽는 블록 수. 공개 RPC의 조회 범위 제한에 맞춘다. */
export const LOG_WINDOW = 2000n;
/** 공개 Sepolia RPC에서 확인한 조회 범위. */
const PUBLICNODE_LOG_WINDOW = 10_000n;
/** 제공자가 범위를 제한하더라도 한 번의 읽기가 지나치게 늘어나지 않게 한다. */
const EXTRA_LOG_REQUESTS = 64;
/** 한 번에 훑는 최대 블록 수. Sepolia 약 70일이다. */
export const MAX_SCAN_BLOCKS = 500_000n;

/** 이벤트를 남긴 거래, 블록, 블록 시각(초). */
export type EventRef = { txHash: Hex; block: bigint; at: number };

export type LedgerRule = EventRef & {
  hash: Hex;
  version: number;
  /** 원장에 등록한 원문(정렬한 JSON). */
  document: string;
  parsed?: RuleDocument;
  /** 원문을 읽고 검사해 다시 계산한 기준 해시가 원장 값과 같은지. */
  hashMatches: boolean;
};
export type LedgerProduct = EventRef & {
  id: Hex;
  version: number;
  documentHash: Hex;
  riskGrade: number;
  complex: boolean;
  derivative: boolean;
  document: string;
  parsed?: ProductDocument;
  /** 원문의 지문, 상품 코드, 버전, 위험등급, 고난도·파생 여부가 원장 값과 같은지. */
  matches: boolean;
};
export type LedgerDiagnosis = EventRef & {
  customerRef: Hex;
  attempt: number;
  ruleHash: Hex;
  commitment: bigint;
  profile: number;
  limit: number;
  elderly: boolean;
};
export type LedgerSaleStatus = "subscribed" | "confirmed" | "withdrawn";
export type LedgerSale = {
  saleId: string;
  customerRef: Hex;
  productId: Hex;
  productVersion: number;
  attempt: number;
  suitable: boolean;
  protectedSale: boolean;
  amount: bigint;
  explanationSeconds: number;
  higherRiskConfirmed: boolean;
  approved: boolean;
  recordingHash?: Hex;
  status: LedgerSaleStatus;
  /** 단계별 이벤트. 모의 결제(settlement)는 확정 뒤에만 있다. */
  subscribed: EventRef;
  confirmed?: EventRef;
  withdrawn?: EventRef;
  settlement?: EventRef;
};
export type LedgerSnapshot = {
  rules: LedgerRule[];
  products: LedgerProduct[];
  diagnoses: LedgerDiagnosis[];
  sales: LedgerSale[];
  latestBlock: bigint;
};

const isPublicnode = (dep: Pick<Deployment, "chainId" | "rpcUrl">) =>
  dep.chainId === sepolia.id &&
  new URL(dep.rpcUrl).hostname === "ethereum-sepolia-rpc.publicnode.com";

/** 배포 설정의 RPC로 읽는 클라이언트. 증빙 파일의 RPC·주소는 쓰지 않는다. */
export function ledgerClient(dep: Pick<Deployment, "chainId" | "rpcUrl">) {
  return createPublicClient({
    chain: dep.chainId === 11155111 ? sepolia : anvil,
    transport: http(dep.rpcUrl, {
      batch: isPublicnode(dep) ? { batchSize: 8 } : false,
      timeout: 15_000,
      retryCount: 1,
    }),
  }) as PublicClient;
}

const READ_CODES = {
  eth_chainId: "V01",
  eth_getCode: "V02",
  eth_blockNumber: "V03",
  eth_getLogs: "V04",
  eth_getBlockByNumber: "V05",
  eth_call: "V06",
  logRequestBudget: "V07",
  eth_getTransactionByHash: "V10",
} as const;

export class LedgerReadError extends Error {
  readonly code: (typeof READ_CODES)[keyof typeof READ_CODES];

  constructor(readonly operation: keyof typeof READ_CODES) {
    super("Ledger read failed");
    this.name = "LedgerReadError";
    this.code = READ_CODES[operation];
  }
}

/** 화면에 쓸 진단 코드만 돌려준다. 외부 RPC 문구나 URL은 보여 주지 않는다. */
export const ledgerReadCode = (error: unknown) =>
  error instanceof LedgerReadError ? error.code : undefined;

export async function ledgerRpcRead<T>(
  method: Exclude<keyof typeof READ_CODES, "logRequestBudget">,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch {
    throw new LedgerReadError(method);
  }
}

/** 요청량 제한이나 연결 실패는 범위를 줄여도 해결되지 않는다. */
function isLogRangeLimit(error: unknown): boolean {
  for (
    let depth = 0;
    depth < 6 && error && typeof error === "object";
    depth++
  ) {
    const { message, details, shortMessage, cause } = error as {
      message?: unknown;
      details?: unknown;
      shortMessage?: unknown;
      cause?: unknown;
    };
    for (const value of [details, shortMessage, message]) {
      if (typeof value !== "string") continue;
      if (
        /(?:block range (?:is )?too (?:large|wide)|(?:maximum|max|limit(?:ed)?) block range|block range (?:limit|exceed)|limited to (?:a )?[\d,]+ blocks?|query returned more than [\d,]+ results?|too many (?:log(?: entries|s)?|results?)|(?:log )?response size (?:limit|exceed))/i.test(
          value,
        )
      )
        return true;
    }
    error = cause;
  }
  return false;
}

export type LedgerReader = Pick<
  PublicClient,
  "getBlockNumber" | "getLogs" | "getBlock"
>;

export class LedgerRangeError extends Error {
  constructor(readonly reason: "beforeDeployment" | "scanLimit") {
    super(
      reason === "beforeDeployment"
        ? "지정 RPC의 최신 블록이 원장 배포 블록보다 이전입니다. 잠시 후 다시 시도하세요."
        : "조회 범위를 초과했습니다. 배포 설정의 시작 블록을 확인하세요.",
    );
  }
}

function ledgerStart(dep: Deployment, latest: bigint) {
  const start = BigInt(dep.blockNumber);
  if (latest < start) throw new LedgerRangeError("beforeDeployment");
  if (latest - start > MAX_SCAN_BLOCKS) throw new LedgerRangeError("scanLimit");
  return start;
}

async function scanLedgerLogs(
  dep: Deployment,
  client: LedgerReader,
  start: bigint,
  latest: bigint,
) {
  const events = ledgerAbi.filter((item) => item.type === "event");
  const logs = [];
  let window = isPublicnode(dep) ? PUBLICNODE_LOG_WINDOW : LOG_WINDOW;
  let remaining =
    Number((latest - start) / LOG_WINDOW + 1n) + EXTRA_LOG_REQUESTS;
  for (let from = start; from <= latest;) {
    const to = from + window - 1n < latest ? from + window - 1n : latest;
    if (remaining-- === 0) throw new LedgerReadError("logRequestBudget");
    try {
      logs.push(
        ...(await client.getLogs({
          address: dep.ledger,
          events,
          fromBlock: from,
          toBlock: to,
          strict: true,
        })),
      );
    } catch (error) {
      if (from === to || !isLogRangeLimit(error))
        throw new LedgerReadError("eth_getLogs");
      window = (to - from + 1n) / 2n;
      continue;
    }
    from = to + 1n;
  }
  logs.sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : a.blockNumber < b.blockNumber
        ? -1
        : 1,
  );
  return logs;
}

type LedgerLogs = Awaited<ReturnType<typeof scanLedgerLogs>>;
type LedgerBlock = { number: bigint; hash: Hex; timestamp: bigint };

/** 원장 주소의 v5 이벤트를 배포 블록부터 모두 읽는다. */
export async function readLedgerLogs(dep: Deployment, client: LedgerReader) {
  const latest = await ledgerRpcRead("eth_blockNumber", () =>
    client.getBlockNumber({ cacheTime: 0 }),
  );
  const logs = await scanLedgerLogs(
    dep,
    client,
    ledgerStart(dep, latest),
    latest,
  );
  return { logs, latest };
}

async function blockTimes(
  client: LedgerReader,
  logs: LedgerLogs,
  head?: LedgerBlock,
) {
  const hashes = new Map<bigint, Hex>();
  for (const log of logs) {
    const known = hashes.get(log.blockNumber);
    if (known && known !== log.blockHash)
      throw new LedgerReadError("eth_getBlockByNumber");
    hashes.set(log.blockNumber, log.blockHash);
  }
  const unique = [...hashes];
  const times = new Map<bigint, number>();
  for (let i = 0; i < unique.length; i += 8)
    await Promise.all(
      unique.slice(i, i + 8).map(async ([blockNumber, hash]) => {
        const block =
          head?.number === blockNumber
            ? head
            : await ledgerRpcRead("eth_getBlockByNumber", () =>
                client.getBlock({ blockNumber }),
              );
        if (block.hash !== hash)
          throw new LedgerReadError("eth_getBlockByNumber");
        times.set(blockNumber, Number(block.timestamp));
      }),
    );
  return times;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** 등록 원문으로 기준 해시를 다시 계산한다. 원문이 정렬한 JSON이고 검사를 통과해야 한다. */
export function checkRuleDocument(hash: Hex, document: string) {
  const parsed = parseJson(document) as RuleDocument | undefined;
  if (!parsed || validateRule(parsed).length || canonical(parsed) !== document)
    return { parsed: undefined, hashMatches: false };
  return { parsed, hashMatches: ruleHash(parsed) === hash.toLowerCase() };
}

/** 등록 원문이 설명서 지문과 원장 속성에 맞는지 확인한다. */
export function checkProductDocument(entry: {
  id: Hex;
  version: number;
  documentHash: Hex;
  riskGrade: number;
  complex: boolean;
  derivative: boolean;
  document: string;
}) {
  const parsed = parseJson(entry.document) as ProductDocument | undefined;
  const matches =
    keccak256(stringToHex(entry.document)) === entry.documentHash &&
    !!parsed &&
    validateProduct(parsed).length === 0 &&
    productText(parsed) === entry.document &&
    productDocumentHash(parsed) === entry.documentHash &&
    productId(parsed.code) === entry.id &&
    parsed.version === entry.version &&
    parsed.riskGrade === entry.riskGrade &&
    parsed.complex === entry.complex &&
    parsed.derivative === entry.derivative;
  return { parsed: matches ? parsed : undefined, matches };
}

/**
 * 원장 이벤트로 기준, 상품 버전, 진단 회차, 판매 건을 모은다.
 * 판매 건 상태는 청약 → 최종 확인·철회 → 모의 결제 이벤트로 정한다.
 */
export async function readLedger(
  dep: Deployment,
  client: LedgerReader = ledgerClient(dep),
): Promise<LedgerSnapshot> {
  const { logs, latest } = await readLedgerLogs(dep, client);
  return ledgerSnapshot(logs, latest, await blockTimes(client, logs));
}

/** 같은 배포를 반복 조회할 때 이전 블록의 해시를 확인한 뒤 새 이벤트만 읽는다. */
export function createLedgerSnapshotReader(
  dep: Deployment,
  client: LedgerReader,
) {
  let previous:
    | {
        head: LedgerBlock;
        logs: LedgerLogs;
        times: Map<bigint, number>;
        snapshot: LedgerSnapshot;
      }
    | undefined;

  return async () => {
    const head = await ledgerRpcRead("eth_getBlockByNumber", () =>
      client.getBlock({ blockTag: "latest" }),
    );
    const start = ledgerStart(dep, head.number);
    const last = previous;
    if (last?.head.hash === head.hash) return last.snapshot;

    const blockAt = (blockNumber: bigint) =>
      ledgerRpcRead("eth_getBlockByNumber", () =>
        client.getBlock({ blockNumber }),
      );
    const reuse =
      last &&
      last.head.number < head.number &&
      (last.head.number + 1n === head.number
        ? head.parentHash === last.head.hash
        : (await blockAt(last.head.number)).hash === last.head.hash);
    const newLogs = await scanLedgerLogs(
      dep,
      client,
      reuse ? last.head.number + 1n : start,
      head.number,
    );
    const newTimes = await blockTimes(client, newLogs, head);
    if ((await blockAt(head.number)).hash !== head.hash)
      throw new LedgerReadError("eth_getBlockByNumber");

    const logs = reuse ? last.logs.concat(newLogs) : newLogs;
    const times = reuse ? new Map([...last.times, ...newTimes]) : newTimes;
    const snapshot = ledgerSnapshot(logs, head.number, times);
    previous = { head, logs, times, snapshot };
    return snapshot;
  };
}

function ledgerSnapshot(
  logs: LedgerLogs,
  latest: bigint,
  times: Map<bigint, number>,
) {
  const ref = (log: (typeof logs)[number]): EventRef => ({
    txHash: log.transactionHash,
    block: log.blockNumber,
    at: times.get(log.blockNumber) ?? 0,
  });
  const snapshot: LedgerSnapshot = {
    rules: [],
    products: [],
    diagnoses: [],
    sales: [],
    latestBlock: latest,
  };
  const sales = new Map<string, LedgerSale>();
  for (const log of logs) {
    switch (log.eventName) {
      case "RuleRegistered": {
        const hash = fieldHex(log.args.ruleHash);
        snapshot.rules.push({
          ...ref(log),
          hash,
          version: log.args.version,
          document: log.args.document,
          ...checkRuleDocument(hash, log.args.document),
        });
        break;
      }
      case "ProductRegistered": {
        const entry = {
          id: log.args.productId,
          version: log.args.version,
          documentHash: log.args.documentHash,
          riskGrade: log.args.riskGrade,
          complex: log.args.complex,
          derivative: log.args.derivative,
          document: log.args.document,
        };
        snapshot.products.push({
          ...ref(log),
          ...entry,
          ...checkProductDocument(entry),
        });
        break;
      }
      case "DiagnosisRecorded":
        snapshot.diagnoses.push({
          ...ref(log),
          customerRef: fieldHex(log.args.customerRef),
          attempt: log.args.attempt,
          ruleHash: fieldHex(log.args.ruleHash),
          commitment: log.args.commitment,
          profile: log.args.profile,
          limit: log.args.limit,
          elderly: log.args.elderly,
        });
        break;
      case "SaleSubscribed": {
        const sale: LedgerSale = {
          saleId: log.args.saleId.toString(),
          customerRef: fieldHex(log.args.customerRef),
          productId: log.args.productId,
          productVersion: log.args.productVersion,
          attempt: log.args.attempt,
          suitable: log.args.suitable,
          protectedSale: log.args.protectedSale,
          amount: log.args.amount,
          explanationSeconds: log.args.explanationSeconds,
          higherRiskConfirmed: false,
          approved: false,
          status: "subscribed",
          subscribed: ref(log),
        };
        sales.set(sale.saleId, sale);
        snapshot.sales.push(sale);
        break;
      }
      default: {
        const sale = sales.get(log.args.saleId.toString());
        if (!sale) break;
        if (log.eventName === "HigherRiskConfirmed")
          sale.higherRiskConfirmed = true;
        else if (log.eventName === "ManagerApproved") sale.approved = true;
        else if (log.eventName === "RecordingAttached")
          sale.recordingHash = log.args.recordingHash;
        else if (log.eventName === "EnrollmentConfirmed") {
          sale.status = "confirmed";
          sale.confirmed = ref(log);
        } else if (log.eventName === "SaleWithdrawn") {
          sale.status = "withdrawn";
          sale.withdrawn = ref(log);
        } else if (log.eventName === "SettlementRecorded")
          sale.settlement = ref(log);
      }
    }
  }
  return snapshot;
}
