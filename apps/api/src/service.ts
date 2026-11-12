import { createPublicClient, http, keccak256, type Hex } from "viem";
import { environment, deployment } from "../../../scripts/environment.ts";
import { proofKeyHash } from "../../../scripts/artifacts.ts";
import { json, type Trace } from "../../../packages/core/src/index.ts";
import type {
  ConfirmRequest,
  DiagnoseRequest,
  SaleAction,
  SaleActionView,
} from "../../../packages/core/src/api.ts";
import { createStore, FileStore, type SaleStore } from "./store.ts";
import type { StoredSale } from "./modules/types.ts";
import * as enrollment from "./modules/enrollment.ts";
import * as ledger from "./modules/ledger.ts";
import * as products from "./modules/products.ts";
import * as purchase from "./modules/purchase.ts";
import * as records from "./modules/records.ts";
import * as review from "./modules/review.ts";

/**
 * API의 상태와 실행 규칙: 배포 설정, 판매 기록, 저장, 잠금, 시작 검사.
 * 업무 로직은 `modules/`에 있다. 아래 업무 메서드는 해당 모듈로 넘긴다.
 */
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

  // ── 저장과 잠금 ─────────────────────────────────────────────

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

  // ── 시작 검사 ───────────────────────────────────────────────

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

  // ── 업무 메서드 (modules/로 넘긴다) ─────────────────────────

  reconcile(recoverInterrupted = false) {
    return ledger.reconcile(this, recoverInterrupted);
  }
  chainSale(id: string) {
    return ledger.chainSale(this, id);
  }
  register() {
    return products.register(this);
  }
  open(productId?: Hex) {
    return enrollment.open(this, productId);
  }
  diagnose(id: string, request: DiagnoseRequest) {
    return enrollment.diagnose(this, id, request);
  }
  confirm(id: string, request: ConfirmRequest) {
    return enrollment.confirm(this, id, request);
  }
  async action(id: string, action: SaleAction): Promise<SaleActionView> {
    const record = this.find(id);
    switch (action) {
      case "abandon":
        return enrollment.abandon(this, record);
      case "review":
        await review.review(this, record);
        break;
      case "purchase":
        await purchase.purchase(this, record);
        break;
      default:
        throw new Error("지원하지 않는 동작입니다.");
    }
    return this.publicSale(record);
  }
  publicSale(record: StoredSale) {
    return records.publicSale(this, record);
  }
  publicTraces() {
    return records.publicTraces(this);
  }
  original(id: string) {
    return records.original(this, id);
  }
  receipt(id: string) {
    return records.receipt(this, id);
  }
}
