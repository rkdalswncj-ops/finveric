// 독립 검증. 판매사 API 없이 지정한 RPC와 원장으로 판매 건을 대조한다.
// 호출자는 자기가 설치한 배포 설정을 넘긴다. 증빙 파일의 체인·주소·RPC는 쓰지 않는다.
import {
  decodeFunctionData,
  keccak256,
  recoverMessageAddress,
  type Hex,
  type PublicClient,
} from "viem";
import { ledgerAbi, verifierAbi } from "./abi.ts";
import { FIELD, fieldHex } from "./encoding.ts";
import {
  approvalDigest,
  diagnosisCommitment,
  recordingHash,
  SALE_STATUSES,
  verifierArgs,
  type Check,
  type Deployment,
  type EvidenceReceipt,
  type OriginalBundle,
} from "./index.ts";
import {
  isProtectedSale,
  isSuitable,
  productDocumentHash,
} from "./products.ts";
import { answersFit, evaluateRule } from "./rules.ts";
import {
  createLedgerSnapshotReader,
  ledgerClient,
  LedgerRangeError,
  ledgerReadCode,
  LedgerReadError,
  ledgerRpcRead,
  readLedger,
  type LedgerDiagnosis,
  type LedgerProduct,
  type LedgerSale,
  type LedgerSnapshot,
} from "./ledger.ts";

export { ledgerReadCode } from "./ledger.ts";

export type VerifyOutcome = "match" | "mismatch" | "missing";
/** 검증 결과 화면 문구. */
export const OUTCOME_LABELS: Readonly<Record<VerifyOutcome, string>> = {
  match: "일치",
  mismatch: "불일치",
  missing: "기록 없음",
};
export type VerificationReference = {
  kind:
    | "rule"
    | "product"
    | "diagnosis"
    | "subscribe"
    | "confirm"
    | "withdraw"
    | "settle";
  attempt?: number;
  txHash: Hex;
  block: string;
};
export type SaleVerification = {
  outcome: VerifyOutcome;
  saleId: string;
  chainId: number;
  checks: Check[];
  sale?: LedgerSale;
  product?: LedgerProduct;
  /** 이 고객 가명 ID의 모든 진단 회차(청약 뒤 회차 포함). */
  diagnoses: LedgerDiagnosis[];
  references: VerificationReference[];
  verifiedAt: string;
};

/** 검사 이름. 화면은 이 순서로 표시한다. */
export const CHECK_NAMES = {
  sale: "판매 기록",
  product: "상품 설명서 버전",
  rule: "진단 기준 원문",
  attempts: "진단 회차",
  original: "원본 답변 대조",
  conditions: "적합성·필수 확인",
  confirmation: "숙려·최종 확인",
  receipt: "증명서 대조",
} as const;

/**
 * 검사 설명(`Check.detail`)의 말투. 고객 화면(증권사 앱 예시)은 해요체, 감독기관 화면과 보고서는 합니다체다.
 */
export type Voice = "haeyo" | "hapnida";

export type VerifyClient = Pick<
  PublicClient,
  | "getChainId"
  | "getCode"
  | "getBlockNumber"
  | "getLogs"
  | "getBlock"
  | "readContract"
  | "getTransaction"
>;

export class LedgerDeploymentError extends Error {}

/** 검증 설정을 확인해야 할 조회 오류다. */
export const needsLedgerConfiguration = (error: unknown) =>
  error instanceof LedgerDeploymentError ||
  (error instanceof LedgerRangeError && error.reason === "scanLimit") ||
  ledgerReadCode(error) === "V07";

/** RPC의 체인과 원장·Verifier 코드가 배포 설정과 같은지 확인한다. */
export async function requireDeployment(
  client: Pick<PublicClient, "getChainId" | "getCode">,
  dep: Deployment,
) {
  const [chainId, ledgerCode, verifierCode] = await Promise.all([
    ledgerRpcRead("eth_chainId", () => client.getChainId()),
    ledgerRpcRead("eth_getCode", () => client.getCode({ address: dep.ledger })),
    ledgerRpcRead("eth_getCode", () =>
      client.getCode({ address: dep.verifier }),
    ),
  ]);
  if (chainId !== dep.chainId)
    throw new LedgerDeploymentError(
      "지정 RPC의 네트워크가 배포 설정과 다릅니다. 검증 설정의 RPC 주소를 확인하세요.",
    );
  if (
    !ledgerCode ||
    !verifierCode ||
    keccak256(ledgerCode) !== dep.ledgerCodeHash ||
    keccak256(verifierCode) !== dep.verifierCodeHash
  )
    throw new LedgerDeploymentError(
      "컨트랙트 코드가 고정한 배포 설정과 다릅니다. 검증 설정의 원장 주소와 RPC를 확인하세요.",
    );
}

const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
/** 자료 검사 오류는 불일치로 본다. RPC 조회 실패는 호출부로 전달한다. */
const safely = async (test: () => boolean | Promise<boolean>) => {
  try {
    return await test();
  } catch (error) {
    if (error instanceof LedgerReadError) throw error;
    return false;
  }
};
const ZERO = `0x${"0".repeat(64)}` as Hex;

type ReadOnce = <T>(key: string, read: () => Promise<T>) => Promise<T>;

export type LedgerVerification = {
  snapshot: LedgerSnapshot;
  verifySale: (
    saleId: string,
    receipt?: EvidenceReceipt,
    original?: OriginalBundle,
    voice?: Voice,
  ) => Promise<SaleVerification>;
};

export const isValidSaleId = (saleId: string) =>
  /^[1-9][0-9]{0,76}$/.test(saleId) && BigInt(saleId) < FIELD;

function requireSaleId(saleId: string) {
  if (!isValidSaleId(saleId))
    throw new Error(
      "판매 ID 형식이 맞지 않습니다. 숫자로만 된 판매 ID를 입력하세요.",
    );
}

/** 한 번 읽은 블록에서 판매 건과 증빙을 대조한다. 같은 호출 결과는 이 대조에서 공유한다. */
export function createLedgerVerificationReader(
  dep: Deployment,
  client: VerifyClient = ledgerClient(dep),
) {
  const readSnapshot = createLedgerSnapshotReader(dep, client);
  return async (): Promise<LedgerVerification> => {
    await requireDeployment(client, dep);
    const snapshot = await readSnapshot();
    const reads = new Map<string, Promise<unknown>>();
    const readOnce: ReadOnce = (key, read) => {
      const known = reads.get(key);
      if (known) return known as ReturnType<typeof read>;
      const result = read().catch((error) => {
        reads.delete(key);
        throw error;
      });
      reads.set(key, result);
      return result;
    };
    return {
      snapshot,
      async verifySale(saleId, receipt, original, voice) {
        requireSaleId(saleId);
        return verifySnapshot(
          dep,
          client,
          snapshot,
          saleId,
          receipt,
          original,
          {
            voice,
            blockNumber: snapshot.latestBlock,
            readOnce,
          },
        );
      },
    };
  };
}

export async function verifySale(
  dep: Deployment,
  saleId: string,
  receipt?: EvidenceReceipt,
  original?: OriginalBundle,
  options: {
    client?: VerifyClient;
    snapshot?: LedgerSnapshot;
    voice?: Voice;
  } = {},
): Promise<SaleVerification> {
  requireSaleId(saleId);
  const client = options.client ?? ledgerClient(dep);
  await requireDeployment(client, dep);
  const snapshot = options.snapshot ?? (await readLedger(dep, client));
  return verifySnapshot(dep, client, snapshot, saleId, receipt, original, {
    voice: options.voice,
  });
}

async function verifySnapshot(
  dep: Deployment,
  client: VerifyClient,
  snapshot: LedgerSnapshot,
  saleId: string,
  receipt: EvidenceReceipt | undefined,
  original: OriginalBundle | undefined,
  {
    voice,
    blockNumber,
    readOnce = (_key, read) => read(),
  }: { voice?: Voice; blockNumber?: bigint; readOnce?: ReadOnce },
): Promise<SaleVerification> {
  /** 말투에 맞는 문장을 고른다. 기본은 해요체다. */
  const say = (haeyo: string, hapnida: string) =>
    voice === "hapnida" ? hapnida : haeyo;
  const contract = {
    address: dep.ledger,
    abi: ledgerAbi,
    blockNumber,
  } as const;
  const readContract: ReadOnce = (key, read) =>
    readOnce(key, () => ledgerRpcRead("eth_call", read));
  const transaction = (hash: Hex) =>
    readOnce(`tx:${hash}`, () =>
      ledgerRpcRead("eth_getTransactionByHash", () =>
        client.getTransaction({ hash }),
      ),
    );
  const [state, coolingPeriod] = await Promise.all([
    readContract(`sale:${saleId}`, () =>
      client.readContract({
        ...contract,
        functionName: "getSale",
        args: [BigInt(saleId)],
      }),
    ),
    readContract("coolingPeriod", () =>
      client.readContract({ ...contract, functionName: "coolingPeriod" }),
    ),
  ]);
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });
  const references: VerificationReference[] = [];
  const reference = (
    kind: VerificationReference["kind"],
    txHash: Hex,
    block: bigint,
    attempt?: number,
  ) => references.push({ kind, txHash, block: block.toString(), attempt });
  const sale = snapshot.sales.find((entry) => entry.saleId === saleId);
  const result = (outcome?: VerifyOutcome): SaleVerification => ({
    outcome:
      outcome ?? (checks.every((entry) => entry.ok) ? "match" : "mismatch"),
    saleId,
    chainId: dep.chainId,
    checks,
    sale,
    product,
    diagnoses,
    references,
    verifiedAt: new Date().toISOString(),
  });
  let product: LedgerProduct | undefined;
  let diagnoses: LedgerDiagnosis[] = [];

  // 1. 판매 기록
  if (!sale && state.status === 0) {
    check(
      CHECK_NAMES.sale,
      false,
      say(
        "지정한 원장에 이 판매 ID의 청약 기록이 없어요.",
        "지정한 원장에 이 판매 ID의 청약 기록이 없습니다.",
      ),
    );
    if (receipt)
      check(
        CHECK_NAMES.receipt,
        false,
        say(
          "증명서의 판매 기록을 찾지 못했어요.",
          "증명서의 판매 기록을 찾지 못했습니다.",
        ),
      );
    return result("missing");
  }
  const saleOk =
    !!sale &&
    SALE_STATUSES[state.status] === sale.status &&
    fieldHex(state.customerRef) === sale.customerRef &&
    state.productId === sale.productId &&
    state.productVersion === sale.productVersion &&
    state.attempt === sale.attempt &&
    state.suitable === sale.suitable &&
    state.protectedSale === sale.protectedSale &&
    state.amount === sale.amount &&
    state.explanationSeconds === sale.explanationSeconds &&
    state.higherRiskConfirmed === sale.higherRiskConfirmed &&
    state.approved === sale.approved &&
    state.recordingHash === (sale.recordingHash ?? ZERO) &&
    Number(state.settledAt) === (sale.settlement?.at ?? 0) &&
    Number(state.subscribedAt) === sale.subscribed.at;
  check(
    CHECK_NAMES.sale,
    saleOk,
    saleOk
      ? `${say("청약 이벤트와 원장 상태가 같아요.", "청약 이벤트와 원장 상태가 같습니다.")} 상태: ${{ subscribed: "청약", confirmed: "확정", withdrawn: "철회" }[sale!.status]}`
      : say(
          "청약 이벤트와 원장 상태가 달라요.",
          "청약 이벤트와 원장 상태가 다릅니다.",
        ),
  );
  if (!sale) return result();
  reference("subscribe", sale.subscribed.txHash, sale.subscribed.block);
  diagnoses = snapshot.diagnoses
    .filter((entry) => same(entry.customerRef, sale.customerRef))
    .sort((a, b) => a.attempt - b.attempt);
  const used = diagnoses.filter((entry) => entry.attempt <= sale.attempt);
  const final = used.find((entry) => entry.attempt === sale.attempt);

  // 2. 상품 설명서 버전
  product = snapshot.products.find(
    (entry) =>
      entry.id === sale.productId && entry.version === sale.productVersion,
  );
  const stored = product
    ? await readContract(`product:${product.id}:${product.version}`, () =>
        client.readContract({
          ...contract,
          functionName: "getProduct",
          args: [product.id, product.version],
        }),
      )
    : undefined;
  const newerBefore = snapshot.products.some(
    (entry) =>
      entry.id === sale.productId &&
      entry.version > sale.productVersion &&
      entry.block < sale.subscribed.block,
  );
  const originalDocumentOk = original
    ? await safely(
        () =>
          productDocumentHash(original.productDocument) ===
          product?.documentHash,
      )
    : true;
  const productOk =
    !!product &&
    !!stored &&
    product.matches &&
    stored.documentHash === product.documentHash &&
    stored.riskGrade === product.riskGrade &&
    stored.complex === product.complex &&
    stored.derivative === product.derivative &&
    product.block <= sale.subscribed.block &&
    !newerBefore &&
    originalDocumentOk;
  if (product) reference("product", product.txHash, product.block);
  check(
    CHECK_NAMES.product,
    productOk,
    !product
      ? say(
          "청약한 상품 버전의 등록 기록이 없어요.",
          "청약한 상품 버전의 등록 기록이 없습니다.",
        )
      : !originalDocumentOk
        ? say(
            "제출한 설명서가 원장에 등록한 설명서 지문과 달라요.",
            "제출한 설명서가 원장에 등록한 설명서 지문과 다릅니다.",
          )
        : productOk
          ? `${product.parsed?.name ?? "상품"} v${product.version} · 청약 당시 최신 버전 · 설명서 지문 일치`
          : say(
              "설명서 원문, 지문, 등록 속성 또는 청약 당시 최신 여부가 맞지 않아요.",
              "설명서 원문, 지문, 등록 속성 또는 청약 당시 최신 여부가 맞지 않습니다.",
            ),
  );

  // 3. 진단 기준 원문
  const ruleHashes = [...new Set(used.map((entry) => entry.ruleHash))];
  const rules = ruleHashes.map((hash) =>
    snapshot.rules.find((entry) => entry.hash === hash),
  );
  const ruleOk =
    used.length > 0 &&
    rules.every(
      (rule) =>
        !!rule &&
        rule.hashMatches &&
        used
          .filter((entry) => entry.ruleHash === rule.hash)
          .every((entry) => rule.block <= entry.block),
    );
  for (const rule of rules)
    if (rule) reference("rule", rule.txHash, rule.block);
  check(
    CHECK_NAMES.rule,
    ruleOk,
    ruleOk
      ? `${say("등록 원문으로 다시 계산한 기준 해시가 같아요.", "등록 원문으로 다시 계산한 기준 해시가 같습니다.")} ${rules.map((rule) => `v${rule!.version}`).join(", ")}`
      : say(
          "진단 기준 원문이 없거나 원문으로 계산한 해시가 달라요.",
          "진단 기준 원문이 없거나 원문으로 계산한 해시가 다릅니다.",
        ),
  );

  // 4. 진단 회차: 1회차부터 빠짐없이 있고, 청약 회차가 당시 최신이며, 증명이 다시 검증된다.
  const complete =
    used.length === sale.attempt &&
    used.every((entry, index) => entry.attempt === index + 1);
  const latestAtSubscription = diagnoses
    .filter((entry) => entry.attempt > sale.attempt)
    .every((entry) => entry.block >= sale.subscribed.block);
  let proofsOk = complete;
  for (const entry of used) {
    reference("diagnosis", entry.txHash, entry.block, entry.attempt);
    proofsOk &&= await safely(async () => {
      const [view, tx] = await Promise.all([
        readContract(`diagnosis:${entry.customerRef}:${entry.attempt}`, () =>
          client.readContract({
            ...contract,
            functionName: "getDiagnosis",
            args: [BigInt(entry.customerRef), entry.attempt],
          }),
        ),
        transaction(entry.txHash),
      ]);
      const decoded = decodeFunctionData({ abi: ledgerAbi, data: tx.input });
      if (
        decoded.functionName !== "recordDiagnosis" ||
        !same(tx.to!, dep.ledger)
      )
        return false;
      const [
        customerRef,
        attempt,
        ruleHash,
        commitment,
        profile,
        limit,
        elderly,
        proof,
      ] = decoded.args;
      const sameRecord =
        customerRef === BigInt(entry.customerRef) &&
        attempt === entry.attempt &&
        ruleHash === BigInt(entry.ruleHash) &&
        commitment === entry.commitment &&
        profile === entry.profile &&
        limit === entry.limit &&
        elderly === entry.elderly &&
        view.ruleHash === ruleHash &&
        view.commitment === commitment &&
        view.profile === profile &&
        view.limit === limit &&
        view.elderly === elderly;
      return (
        sameRecord &&
        (await readContract(
          `proof:${entry.customerRef}:${entry.attempt}:${entry.txHash}`,
          () =>
            client.readContract({
              address: dep.verifier,
              abi: verifierAbi,
              blockNumber,
              functionName: "verifyProof",
              args: [
                ...verifierArgs(proof),
                [
                  BigInt(profile),
                  BigInt(limit),
                  elderly ? 1n : 0n,
                  commitment,
                  BigInt(dep.chainId),
                  BigInt(dep.ledger),
                  customerRef,
                  BigInt(attempt),
                  ruleHash,
                ],
              ],
            }),
        ))
      );
    });
  }
  const attemptsOk = complete && latestAtSubscription && proofsOk;
  check(
    CHECK_NAMES.attempts,
    attemptsOk,
    !complete
      ? say(
          `청약 회차(${sale.attempt})까지의 진단 기록이 빠져 있어요.`,
          `청약 회차(${sale.attempt})까지의 진단 기록이 빠져 있습니다.`,
        )
      : !latestAtSubscription
        ? say(
            "청약 당시 더 최근 회차가 있었어요.",
            "청약 당시 더 최근 회차가 있었습니다.",
          )
        : proofsOk
          ? `${sale.attempt}개 회차 · 청약 회차가 당시 최신 · Verifier로 증명 재검증`
          : say(
              "진단 기록과 증명이 맞지 않아요.",
              "진단 기록과 증명이 맞지 않습니다.",
            ),
  );

  // 5. 원본 답변 대조
  if (original) {
    const originalOk = await safely(
      () =>
        original.format === "finveric-original-v5" &&
        original.saleId === saleId &&
        same(original.customerRef, sale.customerRef) &&
        original.explanationSeconds === sale.explanationSeconds &&
        complete &&
        used.every((entry) => {
          const raw = original.attempts.find(
            (item) => item.attempt === entry.attempt,
          );
          const rule = snapshot.rules.find(
            (item) => item.hash === entry.ruleHash,
          )?.parsed;
          if (
            !raw ||
            !rule ||
            !same(raw.ruleHash, entry.ruleHash) ||
            !/^[0-9]{1,77}$/.test(raw.salt) ||
            BigInt(raw.salt) >= FIELD ||
            !answersFit(rule, raw.answers)
          )
            return false;
          const evaluation = evaluateRule(rule, raw.answers);
          return (
            diagnosisCommitment(raw.answers, raw.salt, {
              chainId: dep.chainId,
              ledger: dep.ledger,
              customerRef: entry.customerRef,
              attempt: entry.attempt,
              ruleHash: entry.ruleHash,
            }) === entry.commitment &&
            evaluation.profile === entry.profile &&
            evaluation.limit === entry.limit &&
            evaluation.elderly === entry.elderly
          );
        }),
    );
    check(
      CHECK_NAMES.original,
      originalOk,
      originalOk
        ? say(
            "모든 회차의 답변·임의값으로 커밋먼트와 판정을 다시 계산했어요.",
            "모든 회차의 답변·임의값으로 커밋먼트와 판정을 다시 계산했습니다.",
          )
        : say(
            "원본의 답변, 임의값 또는 설명 확인 시간이 원장 기록과 달라요.",
            "원본의 답변, 임의값 또는 설명 확인 시간이 원장 기록과 다릅니다.",
          ),
    );
  }

  // 6. 적합성·필수 확인
  let approvalOk = sale.attempt < 3 ? !sale.approved : sale.approved;
  if (approvalOk && sale.attempt >= 3)
    approvalOk = await safely(async () => {
      const tx = await transaction(sale.subscribed.txHash);
      const decoded = decodeFunctionData({ abi: ledgerAbi, data: tx.input });
      if (decoded.functionName !== "subscribe") return false;
      const signer = await recoverMessageAddress({
        message: {
          raw: approvalDigest(dep, saleId, sale.customerRef, sale.attempt),
        },
        signature: decoded.args[9],
      });
      return same(signer, dep.roles.approver);
    });
  const suitable =
    !!product && !!final && isSuitable(product.riskGrade, final.limit);
  const protectedSale =
    !!product && !!final && isProtectedSale(product, final, suitable);
  const recordingOk = protectedSale
    ? !!sale.recordingHash &&
      sale.recordingHash !== ZERO &&
      (!original ||
        (await safely(
          () => recordingHash(original.recording!.text) === sale.recordingHash,
        )))
    : !sale.recordingHash;
  const conditionsOk =
    !!final &&
    !!product &&
    suitable === sale.suitable &&
    protectedSale === sale.protectedSale &&
    sale.explanationSeconds > 0 &&
    sale.higherRiskConfirmed === !suitable &&
    approvalOk &&
    recordingOk;
  check(
    CHECK_NAMES.conditions,
    conditionsOk,
    [
      suitable ? "적합" : "부적합 · 추가 위험 확인",
      `설명 확인 ${sale.explanationSeconds}초`,
      sale.attempt >= 3
        ? `관리자 승인 ${approvalOk ? "확인" : "불일치"}`
        : "관리자 승인 대상 아님",
      protectedSale
        ? `녹취 지문 ${recordingOk ? "일치" : "불일치"}`
        : "녹취 대상 아님",
    ].join(" · "),
  );

  // 7. 숙려·최종 확인
  const coolingEnds = sale.subscribed.at + Number(coolingPeriod);
  let confirmationOk = Number(coolingPeriod) === dep.coolingPeriod;
  let confirmationDetail: string;
  if (sale.status === "confirmed" && sale.confirmed) {
    const { at, txHash, block } = sale.confirmed;
    reference("confirm", txHash, block);
    if (sale.settlement)
      reference("settle", sale.settlement.txHash, sale.settlement.block);
    confirmationOk &&=
      Number(state.confirmedAt) === at &&
      (!sale.protectedSale || at >= coolingEnds);
    confirmationDetail = sale.protectedSale
      ? say(
          `숙려 ${Number(coolingPeriod)}초 뒤 최종 확인했어요.`,
          `숙려 ${Number(coolingPeriod)}초 뒤 최종 확인했습니다.`,
        )
      : say(
          "숙려 대상이 아니에요. 최종 확인했어요.",
          "숙려 대상이 아닙니다. 최종 확인했습니다.",
        );
  } else if (sale.status === "withdrawn" && sale.withdrawn) {
    reference("withdraw", sale.withdrawn.txHash, sale.withdrawn.block);
    confirmationOk &&= Number(state.withdrawnAt) === sale.withdrawn.at;
    confirmationDetail = say(
      "고객이 최종 확인 전에 철회했어요.",
      "고객이 최종 확인 전에 철회했습니다.",
    );
  } else {
    const ends = new Date(coolingEnds * 1000).toISOString();
    confirmationDetail = sale.protectedSale
      ? say(
          `숙려기간 중이에요. ${ends} 뒤 최종 확인할 수 있어요.`,
          `숙려기간 중입니다. ${ends} 뒤 최종 확인할 수 있습니다.`,
        )
      : say("최종 확인 전이에요.", "최종 확인 전입니다.");
  }
  check(CHECK_NAMES.confirmation, confirmationOk, confirmationDetail);

  // 8. 증명서 대조
  if (receipt) {
    const receiptOk = await safely(
      () =>
        receipt.format === "finveric-receipt-v5" &&
        receipt.saleId === saleId &&
        receipt.chainId === dep.chainId &&
        same(receipt.ledger, dep.ledger) &&
        same(receipt.customerRef, sale.customerRef) &&
        same(receipt.productId, sale.productId) &&
        receipt.productVersion === sale.productVersion &&
        same(receipt.documentHash, product?.documentHash) &&
        receipt.attempt === sale.attempt &&
        same(receipt.ruleHash, final?.ruleHash) &&
        receipt.amount === sale.amount.toString() &&
        same(receipt.subscribeTx, sale.subscribed.txHash) &&
        (receipt.confirmTx === undefined ||
          same(receipt.confirmTx, sale.confirmed?.txHash)),
    );
    check(
      CHECK_NAMES.receipt,
      receiptOk,
      receiptOk
        ? say(
            "증명서의 판매 ID, 상품 버전, 회차, 기준, 금액, 거래가 원장과 같아요.",
            "증명서의 판매 ID, 상품 버전, 회차, 기준, 금액, 거래가 원장과 같습니다.",
          )
        : say(
            "증명서 내용이 원장 기록과 달라요.",
            "증명서 내용이 원장 기록과 다릅니다.",
          ),
    );
  }
  return result();
}
