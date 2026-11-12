import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  parseEventLogs,
  type Hex,
  type TransactionReceipt,
  type TransactionSerializedEIP1559,
} from "viem";
import { environment, deployment } from "../../../scripts/environment.ts";
import { proofKeyHash } from "../../../scripts/artifacts.ts";
import {
  ledgerAbi,
  PRODUCT_ID,
  PRODUCTS,
  FIELD,
  RULE_HASH,
  classifyProfile,
  diagnosisCommitment,
  json,
  reviewDigest,
  type Role,
  type SaleRecord,
  type Product,
  type Diagnosis,
  type Trace,
  type ChainSale,
  type Answers,
  type OriginalBundle,
  type EvidenceReceipt,
} from "../../../packages/core/src/index.ts";
import { prove, randomField, solidityProof, validateAnswers } from "./zk.ts";
import { createStore, FileStore, type SaleStore } from "./store.ts";

export type Confirmation = {
  round: number;
  commitment: string;
  profile: number;
  explanationAccepted: true;
  higherRiskAccepted: boolean;
};

type StoredTrace = Trace & { rawTransaction?: TransactionSerializedEIP1559 };
type StoredSale = Omit<SaleRecord, "traces"> & {
  productId: Hex;
  traces: StoredTrace[];
  reviewSignature?: Hex;
};

function requireProduct(id: Hex): Product {
  const product = PRODUCTS.find((entry) => entry.id === id.toLowerCase());
  if (!product) throw new Error("가입할 수 있는 펀드를 선택해 주세요.");
  return product;
}

function publicTrace({
  rawTransaction: _rawTransaction,
  ...trace
}: StoredTrace): Trace {
  return trace;
}

export class FundService {
  readonly env: ReturnType<typeof environment>;
  readonly dep: ReturnType<typeof deployment>;
  readonly client;
  readonly store: SaleStore;
  readonly file?: string;
  sales: StoredSale[] = [];
  systemTraces: Trace[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  /** 이 인스턴스에서 대기 중이거나 실행 중인 변경 작업 수. */
  private active = 0;
  private locked = false;
  private persisting: Promise<void> = Promise.resolve();
  private persistError?: unknown;

  constructor(
    options: {
      env?: ReturnType<typeof environment>;
      dep?: ReturnType<typeof deployment>;
      file?: string;
      store?: SaleStore;
    } = {},
  ) {
    this.env = options.env ?? environment();
    this.dep = options.dep ?? deployment(this.env.network);
    this.client = createPublicClient({
      chain: this.env.chain,
      transport: http(this.env.rpcUrl),
    });
    this.store =
      options.store ??
      (options.file
        ? new FileStore(options.file)
        : createStore(
            this.dep,
            `.local/sales-${this.dep.chainId}-${this.dep.ledger.toLowerCase()}.json`,
          ));
    if (this.store instanceof FileStore) {
      this.file = this.store.file;
      this.load(this.store.readSync());
    }
  }
  private load(raw: string | undefined) {
    if (!raw) return;
    const saved = JSON.parse(raw);
    this.sales = saved.sales;
    this.systemTraces = saved.systemTraces;
  }
  save() {
    const data = json({ sales: this.sales, systemTraces: this.systemTraces });
    if (this.store instanceof FileStore) return this.store.writeSync(data);
    // 공유 저장소는 잠금 안에서만 쓴다. 조회 중 영수증 대조 결과는 메모리에만 반영한다.
    if (!this.locked) return;
    this.persisting = this.persisting
      .then(() => this.store.write(data))
      .catch((error) => {
        this.persistError ??= error;
      });
  }
  private async flush() {
    await this.persisting;
    const error = this.persistError;
    this.persistError = undefined;
    if (error) throw error;
  }
  /**
   * 기록을 바꾸는 작업을 하나씩 실행한다.
   * 공유 저장소에서는 인스턴스 사이의 잠금을 잡고, 최신 기록을 읽은 뒤 실행한다.
   */
  exclusive<T>(operation: () => Promise<T>): Promise<T> {
    this.active++;
    const run = () =>
      this.store.lock(async () => {
        this.locked = true;
        try {
          if (this.store.shared) this.load(await this.store.read());
          const result = await operation();
          await this.flush();
          return result;
        } catch (error) {
          // 실패 상태를 기록한 저장도 남긴다. 저장 실패보다 원래 오류를 먼저 알린다.
          await this.flush().catch(() => undefined);
          throw error;
        } finally {
          this.locked = false;
        }
      });
    const next = this.queue.then(run).finally(() => {
      this.active--;
    });
    this.queue = next.catch(() => {});
    return next;
  }
  /**
   * 조회 요청. 공유 저장소에서는 다른 인스턴스가 쓴 기록을 먼저 읽는다.
   * 이 인스턴스에서 변경 작업이 진행 중이면 메모리의 최신 상태를 그대로 쓴다.
   */
  async view<T>(operation: () => Promise<T>): Promise<T> {
    if (this.store.shared && this.active === 0) {
      const raw = await this.store.read();
      if (this.active === 0) this.load(raw);
    }
    return operation();
  }
  find(id: string) {
    const record = this.sales.find((s) => s.id === id);
    if (!record) throw new Error("판매 건을 찾을 수 없습니다.");
    return record;
  }
  async initialize() {
    if (this.dep.ledgerVersion !== 4 || this.dep.ruleVersion !== 3)
      throw new Error("가입 원장 v4를 배포한 뒤 서버를 다시 시작하세요.");
    if (this.dep.proofKeyHash !== proofKeyHash())
      throw new Error(
        "증명 키와 배포한 Verifier가 다릅니다. 같은 키로 원장을 다시 배포하세요.",
      );
    if ((await this.client.getChainId()) !== this.dep.chainId)
      throw new Error("RPC 네트워크가 배포 설정과 다릅니다.");
    const code = await this.client.getCode({ address: this.dep.ledger });
    if (!code || keccak256(code) !== this.dep.ledgerCodeHash)
      throw new Error(
        "원장이 없거나 배포 설정과 코드가 다릅니다. npm run deploy:local을 실행하세요.",
      );
    // 잠금 안에서 복구한다. 그래야 다른 인스턴스가 처리 중인 기록을 중단된 기록으로 보지 않는다.
    await this.exclusive(() => this.reconcile(true));
  }
  async reconcile(recoverInterrupted = false) {
    const tracedSales = this.sales.flatMap((sale) =>
      sale.traces.map((trace) => ({ trace, sale })),
    );
    for (const { trace, sale } of [
      ...this.systemTraces.map((trace) => ({ trace, sale: undefined })),
      ...tracedSales,
    ].filter(({ trace }) => trace.status === "pending")) {
      if (!trace.txHash) {
        if (recoverInterrupted) {
          trace.status = "failed";
          trace.detail = "거래 제출 전 서버가 중단되었습니다. 다시 요청하세요.";
        }
        continue;
      }
      try {
        const receipt = await this.client.getTransactionReceipt({
          hash: trace.txHash,
        });
        if (sale && trace.action === "completeEnrollment")
          this.recordEnrollmentReceipt(sale, trace, receipt);
        else {
          trace.status = receipt.status === "success" ? "confirmed" : "failed";
          trace.blockNumber = receipt.blockNumber.toString();
          trace.detail = receipt;
        }
      } catch {
        /* Keep an unmined transaction pending; do not resubmit it. */
      }
    }
    this.save();
  }
  async chainSale(id: string) {
    return this.client.readContract({
      address: this.dep.ledger,
      abi: ledgerAbi,
      functionName: "getSale",
      args: [BigInt(id)],
    });
  }
  private enrollmentTrace(record: StoredSale) {
    return record.traces.find(
      (trace) =>
        trace.action === "completeEnrollment" && trace.status !== "failed",
    );
  }
  async publicSale(record: StoredSale) {
    const product = requireProduct(record.productId);
    const onchain = this.enrollmentTrace(record)
      ? await this.chainSale(record.id)
      : undefined;
    const state: ChainSale = onchain?.finalized
      ? onchain
      : {
          productId: product.id,
          documentHash: product.documentHash,
          ruleHash: RULE_HASH,
          attempts: record.attempts.length,
          explained: false,
          signed: false,
          reviewed: !!record.reviewSignature,
          finalized: false,
          purchaseState: 0,
          amount: 0n,
          nav: 0n,
          units: 0n,
          pricedAt: 0n,
          signatureHash: `0x${"0".repeat(64)}`,
          higherRiskConfirmed: false,
        };
    return {
      id: record.id,
      productId: product.id,
      amount: record.amount,
      createdAt: record.createdAt,
      traces: record.traces.map(publicTrace),
      submissionPending:
        this.enrollmentTrace(record)?.status === "pending" && !state.finalized,
      attempts: record.attempts.map((a) => ({
        round: a.round,
        commitment: a.commitment,
        confirmed: a.confirmed,
        profile: a.profile,
      })),
      state,
    };
  }
  async publicTraces() {
    await this.reconcile();
    return [
      ...this.systemTraces,
      ...this.sales.flatMap((sale) => sale.traces.map(publicTrace)),
    ].sort((a, b) => a.at.localeCompare(b.at));
  }
  async send(
    role: Role,
    functionName: string,
    args: unknown[],
    event: string,
    record?: SaleRecord,
  ) {
    const traces = record?.traces ?? this.systemTraces;
    if (
      [...this.systemTraces, ...this.sales.flatMap((s) => s.traces)].some(
        (t) => t.status === "pending" && t.txHash,
      )
    ) {
      await this.reconcile();
      if (
        [...this.systemTraces, ...this.sales.flatMap((s) => s.traces)].some(
          (t) => t.status === "pending" && t.txHash,
        )
      )
        throw new Error(
          "미확정 거래가 있습니다. 영수증을 확인한 뒤 다시 요청하세요.",
        );
    }
    const trace: Trace = {
      id: randomUUID(),
      at: new Date().toISOString(),
      source: role,
      action: functionName,
      status: "pending",
    };
    traces.push(trace);
    this.save();
    try {
      const wallet = createWalletClient({
        account: this.env.accounts[role],
        chain: this.env.chain,
        transport: http(this.env.rpcUrl),
      });
      // Fixed gas also lets the missing-record demonstration reach the EVM and produce a reverted receipt.
      const hash = await wallet.writeContract({
        address: this.dep.ledger,
        abi: ledgerAbi,
        functionName: functionName as any,
        args: args as any,
        gas: 1_500_000n,
      });
      trace.txHash = hash;
      this.save();
      const receipt = await this.client.waitForTransactionReceipt({
        hash,
        timeout: 180_000,
      });
      trace.blockNumber = receipt.blockNumber.toString();
      trace.detail = receipt;
      if (receipt.status !== "success") {
        trace.status = "failed";
        this.save();
        throw new Error(
          "컨트랙트가 요청을 거절했습니다. 필수 기록과 현재 단계를 확인하세요.",
        );
      }
      const events = parseEventLogs({
        abi: ledgerAbi,
        logs: receipt.logs,
      }).filter(
        (l) => l.address.toLowerCase() === this.dep.ledger.toLowerCase(),
      );
      if (
        !events.some(
          (l) =>
            l.eventName === event &&
            (!record ||
              ("saleId" in l.args && l.args.saleId === BigInt(record.id))),
        )
      ) {
        trace.status = "failed";
        this.save();
        throw new Error("성공 영수증의 판매 ID와 이벤트를 대조할 수 없습니다.");
      }
      trace.event = event;
      trace.status = "confirmed";
      this.save();
      return hash;
    } catch (error) {
      if (!trace.txHash) {
        trace.status = "failed";
        trace.detail =
          "거래를 제출하지 못했습니다. RPC 연결과 테스트 ETH 잔액을 확인하세요.";
      }
      this.save();
      if (trace.status === "pending")
        throw new Error(
          "거래 영수증이 아직 없습니다. 온체인 처리 화면에서 해시를 확인하세요.",
        );
      throw error instanceof Error && error.message.startsWith("컨트랙트")
        ? error
        : new Error(
            "처리를 완료하지 못했습니다. 온체인 처리 기록을 확인하세요.",
          );
    }
  }
  async register() {
    const registrations = await Promise.all(
      PRODUCTS.map((product) => this.productRegistration(product.id)),
    );
    for (const [index, product] of PRODUCTS.entries()) {
      const { documentHash, minimumProfile } = registrations[index];
      if (minimumProfile === 0) {
        await this.send(
          "manager",
          "registerProduct",
          [product.id, product.documentHash, product.minimumProfile],
          "ProductRegistered",
        );
      } else if (
        documentHash !== product.documentHash ||
        minimumProfile !== product.minimumProfile
      ) {
        throw new Error("이미 등록한 상품의 설명서나 위험 기준이 달라요.");
      }
    }
    const rule = await this.client.readContract({
      address: this.dep.ledger,
      abi: ledgerAbi,
      functionName: "rules",
      args: [RULE_HASH],
    });
    if (!rule)
      await this.send("seller", "registerRule", [RULE_HASH], "RuleRegistered");
    return { documentHash: PRODUCTS[0].documentHash, ruleHash: RULE_HASH };
  }
  private async productRegistration(productId: Hex) {
    const call = {
      address: this.dep.ledger,
      abi: ledgerAbi,
      args: [productId],
    } as const;
    const [documentHash, minimumProfile] = await Promise.all([
      this.client.readContract({ ...call, functionName: "documents" }),
      this.client.readContract({ ...call, functionName: "minimumProfiles" }),
    ]);
    return { documentHash, minimumProfile };
  }
  private ensureDraft(record: StoredSale) {
    const enrollment = this.enrollmentTrace(record);
    if (enrollment?.status === "pending")
      throw new Error(
        "가입 요청을 처리하고 있어요. 거래 결과를 확인해 주세요.",
      );
    if (enrollment?.status === "confirmed")
      throw new Error("이미 완료한 가입 신청이에요.");
  }
  private async preparedProof(diagnosis: Diagnosis) {
    if (!diagnosis.confirmed || !diagnosis.proof || !diagnosis.publicSignals)
      throw new Error("진단 결과를 먼저 확인해 주세요.");
    const [a, b, c, signals] = await solidityProof(
      diagnosis.proof,
      diagnosis.publicSignals,
    );
    return { a, b, c, signals };
  }
  private recordEnrollmentReceipt(
    record: StoredSale,
    trace: StoredTrace,
    receipt: TransactionReceipt,
  ) {
    const logs = parseEventLogs({ abi: ledgerAbi, logs: receipt.logs }).filter(
      (log) =>
        log.address.toLowerCase() === this.dep.ledger.toLowerCase() &&
        "saleId" in log.args &&
        log.args.saleId === BigInt(record.id),
    );
    const success =
      receipt.status === "success" &&
      receipt.transactionHash === trace.txHash &&
      receipt.from.toLowerCase() === this.dep.roles.customer.toLowerCase() &&
      logs.some(
        (log) =>
          log.eventName === "ConditionsVerified" &&
          log.args.attempt === record.attempts.length,
      ) &&
      logs.some(
        (log) =>
          log.eventName === "EnrollmentAuthorized" &&
          log.args.attempt === record.attempts.length &&
          log.args.customer.toLowerCase() ===
            this.dep.roles.customer.toLowerCase(),
      );
    trace.status = success ? "confirmed" : "failed";
    trace.event = success ? "ConditionsVerified" : undefined;
    trace.blockNumber = receipt.blockNumber.toString();
    trace.detail = receipt;
    delete trace.rawTransaction;
  }
  private async settleEnrollment(record: StoredSale, trace: StoredTrace) {
    const { txHash, rawTransaction } = trace;
    if (!txHash || !rawTransaction)
      throw new Error("제출한 가입 거래를 찾을 수 없어요.");
    let receipt = await this.client
      .getTransactionReceipt({ hash: txHash })
      .catch(() => undefined);
    if (!receipt) {
      // A retry broadcasts the exact same signed transaction with the same hash and nonce.
      await this.client
        .sendRawTransaction({ serializedTransaction: rawTransaction })
        .catch(() => undefined);
      receipt = await this.client
        .waitForTransactionReceipt({
          hash: txHash,
          timeout: 180_000,
          checkReplacement: false,
        })
        .catch(() => undefined);
    }
    if (!receipt)
      throw new Error(
        "가입 거래를 확인하고 있어요. 같은 신청에서 다시 확인해 주세요.",
      );
    this.recordEnrollmentReceipt(record, trace, receipt);
    this.save();
    if (trace.status !== "confirmed")
      throw new Error(
        "가입 거래가 실패했어요. 온체인 처리 기록을 확인해 주세요.",
      );
    return this.publicSale(record);
  }
  async open(productId: Hex = PRODUCT_ID) {
    const product = requireProduct(productId);
    const [{ documentHash, minimumProfile }, rule] = await Promise.all([
      this.productRegistration(product.id),
      this.client.readContract({
        address: this.dep.ledger,
        abi: ledgerAbi,
        functionName: "rules",
        args: [RULE_HASH],
      }),
    ]);
    if (
      documentHash !== product.documentHash ||
      minimumProfile !== product.minimumProfile ||
      !rule
    )
      throw new Error(
        "관리자 화면에서 이 상품과 진단 규칙 v3를 먼저 등록하세요.",
      );
    const record: StoredSale = {
      id: randomField(),
      productId: product.id,
      amount: 1_050_000,
      createdAt: new Date().toISOString(),
      attempts: [],
      traces: [],
    };
    this.sales.unshift(record);
    this.save();
    return { id: record.id };
  }
  async diagnose(
    id: string,
    { loss, experience, salt }: Answers & { salt: string },
  ) {
    const answers = { loss, experience };
    validateAnswers(answers);
    if (!/^[1-9][0-9]{0,76}$/.test(salt) || BigInt(salt) >= FIELD)
      throw new Error("진단에 사용할 임의값을 확인해 주세요.");
    const record = this.find(id);
    const product = requireProduct(record.productId);
    this.ensureDraft(record);
    const previous = record.attempts.find((attempt) => attempt.salt === salt);
    if (previous) {
      if (
        previous !== record.attempts.at(-1) ||
        previous.answers.loss !== loss ||
        previous.answers.experience !== experience
      )
        throw new Error("이전 진단의 임의값이에요. 새 진단을 시작해 주세요.");
      return {
        ...(await this.publicSale(record)),
        preparedProof: await this.preparedProof(previous),
      };
    }
    const round = record.attempts.length + 1;
    if (round > 10)
      throw new Error("시연은 가입 신청당 최대 10회 진단할 수 있어요.");
    const commitment = diagnosisCommitment(answers, salt, {
      chainId: this.dep.chainId,
      ledger: this.dep.ledger,
      id,
      round,
      documentHash: product.documentHash,
    }).toString();
    const trace: Trace = {
      id: randomUUID(),
      at: new Date().toISOString(),
      source: "Groth16 · BN254",
      action: "증명 생성",
      status: "pending",
    };
    record.traces.push(trace);
    this.save();
    try {
      const result = await prove(
        answers,
        salt,
        commitment,
        this.dep,
        id,
        round,
        product.documentHash,
      );
      const profile = classifyProfile(answers);
      if (BigInt(result.publicSignals[0]) !== BigInt(profile))
        throw new Error("진단 결과가 일치하지 않아요.");
      const diagnosis: Diagnosis = {
        round,
        answers,
        salt,
        commitment,
        profile,
        proof: result.proof,
        publicSignals: result.publicSignals,
        confirmed: true,
      };
      const preparedProof = await this.preparedProof(diagnosis);
      record.attempts.push(diagnosis);
      delete record.reviewSignature;
      trace.status = "confirmed";
      trace.detail = {
        publicSignals: result.publicSignals,
        protocol: "groth16",
        curve: "bn128",
      };
      this.save();
      return { ...(await this.publicSale(record)), preparedProof };
    } catch {
      trace.status = "failed";
      this.save();
      throw new Error("진단 증명을 만들지 못했어요. 다시 시도해 주세요.");
    }
  }
  async confirm(id: string, confirmation: Confirmation) {
    const record = this.find(id);
    const product = requireProduct(record.productId);
    const last = record.attempts.at(-1);
    if (!last?.confirmed || last.profile === undefined)
      throw new Error("진단 기록을 먼저 확인하세요.");
    if (
      confirmation.round !== last.round ||
      confirmation.commitment !== last.commitment ||
      confirmation.profile !== last.profile
    )
      throw new Error(
        "확인한 답변 또는 진단 결과가 현재 신청과 달라요. 진단 결과를 다시 확인해 주세요.",
      );
    if (confirmation.explanationAccepted !== true)
      throw new Error("상품 설명과 원금 손실 가능성을 확인해 주세요.");
    const higherRisk = last.profile < product.minimumProfile;
    if (higherRisk && !confirmation.higherRiskAccepted)
      throw new Error(
        "투자성향보다 위험이 높은 상품의 추가 안내를 확인해 주세요.",
      );
    if (last.round >= 3 && !record.reviewSignature)
      throw new Error("세 번째 진단부터는 준법 담당자의 검토가 필요해요.");
    await this.reconcile();
    const existing = this.enrollmentTrace(record);
    if (existing?.status === "confirmed") return this.publicSale(record);
    if (existing?.status === "pending")
      return this.settleEnrollment(record, existing);
    if (
      this.sales.some(
        (sale) => this.enrollmentTrace(sale)?.status === "pending",
      )
    )
      throw new Error(
        "다른 가입 거래를 확인하고 있어요. 잠시 후 다시 시도해 주세요.",
      );
    const proofs = await Promise.all(
      record.attempts.map((attempt) => this.preparedProof(attempt)),
    );
    const data = encodeFunctionData({
      abi: ledgerAbi,
      functionName: "completeEnrollment",
      args: [
        BigInt(id),
        product.id,
        product.documentHash,
        RULE_HASH,
        proofs,
        true,
        higherRisk,
        record.reviewSignature ?? "0x",
      ],
    });
    const wallet = createWalletClient({
      account: this.env.accounts.customer,
      chain: this.env.chain,
      transport: http(this.env.rpcUrl),
    });
    const gas = 5_000_000n;
    const { nonce, maxFeePerGas, maxPriorityFeePerGas } =
      await wallet.prepareTransactionRequest({
        type: "eip1559",
        to: this.dep.ledger,
        data,
        gas,
      });
    const rawTransaction = (await this.env.accounts.customer.signTransaction({
      type: "eip1559",
      chainId: this.dep.chainId,
      to: this.dep.ledger,
      data,
      gas,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas,
    })) as TransactionSerializedEIP1559;
    const trace: StoredTrace = {
      id: randomUUID(),
      at: new Date().toISOString(),
      source: "customer",
      action: "completeEnrollment",
      status: "pending",
      rawTransaction,
      txHash: keccak256(rawTransaction),
    };
    record.traces.push(trace);
    this.save();
    return this.settleEnrollment(record, trace);
  }
  async action(id: string, action: string) {
    const record = this.find(id);
    switch (action) {
      case "abandon":
        await this.reconcile();
        this.ensureDraft(record);
        this.sales = this.sales.filter((sale) => sale !== record);
        this.save();
        return { id, abandoned: true };
      case "review": {
        this.ensureDraft(record);
        if (record.attempts.length < 3)
          throw new Error("세 번째 진단부터 검토할 수 있어요.");
        if (!record.reviewSignature) {
          const proofs = await Promise.all(
            record.attempts.map((attempt) => this.preparedProof(attempt)),
          );
          record.reviewSignature =
            await this.env.accounts.compliance.signMessage({
              message: {
                raw: reviewDigest(
                  this.dep,
                  id,
                  proofs,
                  requireProduct(record.productId),
                ),
              },
            });
          this.save();
        }
        break;
      }
      case "purchase": {
        const state = await this.chainSale(id);
        if (!state.finalized)
          throw new Error("가입을 완료한 뒤 매입 시연을 진행해 주세요.");
        if (state.purchaseState === 3) return this.publicSale(record);
        if (state.purchaseState === 0)
          await this.send(
            "seller",
            "requestMockPurchase",
            [BigInt(id)],
            "MockPurchaseUpdated",
            record,
          );
        if ((await this.chainSale(id)).purchaseState === 1)
          await this.send(
            "infrastructure",
            "awaitMockPurchase",
            [BigInt(id)],
            "MockPurchaseUpdated",
            record,
          );
        const block = await this.client.getBlock();
        await this.send(
          "infrastructure",
          "recordMockPurchase",
          [BigInt(id), 1_050_000n, 1_050n, block.timestamp],
          "MockPurchaseUpdated",
          record,
        );
        break;
      }
      default:
        throw new Error("지원하지 않는 동작입니다.");
    }
    return this.publicSale(record);
  }
  private async completedRecord(id: string) {
    const record = this.find(id);
    if (this.enrollmentTrace(record)?.status === "pending")
      await this.reconcile();
    if (this.enrollmentTrace(record)?.status !== "confirmed")
      throw new Error("가입이 완료되면 서류를 받을 수 있어요.");
    return record;
  }
  async original(id: string): Promise<OriginalBundle> {
    const record = await this.completedRecord(id);
    return {
      format: "finveric-original-v4",
      saleId: id,
      document: requireProduct(record.productId).document,
      attempts: record.attempts.map((a) => ({
        round: a.round,
        answers: a.answers,
        salt: a.salt,
      })),
    };
  }
  async receipt(id: string): Promise<EvidenceReceipt> {
    const record = await this.completedRecord(id);
    const product = requireProduct(record.productId);
    return {
      format: "finveric-receipt-v4",
      saleId: id,
      chainId: this.dep.chainId,
      ledger: this.dep.ledger,
      productId: product.id,
      documentHash: product.documentHash,
      ruleHash: RULE_HASH,
      transactions: record.traces
        .filter((t) => t.txHash && t.status === "confirmed")
        .map((t) => t.txHash!),
    };
  }
}
