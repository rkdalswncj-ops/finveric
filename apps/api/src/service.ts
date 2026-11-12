import { createPublicClient, http, type Hex } from "viem";
import { environment, deployment } from "../../../scripts/environment.ts";
import { proofKeyHash } from "../../../scripts/artifacts.ts";
import type {
  ConfirmRequest,
  DiagnoseRequest,
  SaleAction,
  SaleActionView,
} from "../../../packages/core/src/api.ts";
import {
  createStore,
  FileStore,
  type SaleStore,
} from "./repositories/store.ts";
import { SaleRepository, type StoredSale } from "./repositories/sales.ts";
import { readChainId, readCodeHash } from "./gateways/ledger.ts";
import * as enrollment from "./modules/enrollment.ts";
import * as monitoring from "./modules/health.ts";
import * as products from "./modules/products.ts";
import * as purchase from "./modules/purchase.ts";
import * as records from "./modules/records.ts";
import * as review from "./modules/review.ts";
import * as transactions from "./modules/transactions.ts";

/**
 * API의 실행 맥락: 배포 설정, 역할 키, RPC 클라이언트, 판매 기록 리포지토리.
 * 계층: routes(경로) → modules(업무 절차) → repositories(기록) · gateways(원장·증명).
 * 아래 업무 메서드는 경로·테스트·스크립트가 부르는 입구다. 실제 절차는 modules/에 있다.
 */
export class FundService {
  readonly env: ReturnType<typeof environment>;
  readonly dep: ReturnType<typeof deployment>;
  readonly client;
  readonly repository: SaleRepository;

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
    this.repository = new SaleRepository(
      options.store ??
        (options.file
          ? new FileStore(options.file)
          : createStore(
              this.dep,
              `.local/sales-${this.dep.chainId}-${this.dep.ledger.toLowerCase()}.json`,
            )),
    );
  }

  // ── 기록과 잠금 (리포지토리로 넘긴다) ───────────────────────

  get file() {
    return this.repository.file;
  }
  get sales() {
    return this.repository.all();
  }
  find(id: string) {
    return this.repository.find(id);
  }
  save() {
    this.repository.save();
  }
  /** 기록을 바꾸는 요청. 한 번에 하나만 실행한다. */
  exclusive<T>(operation: () => Promise<T>) {
    return this.repository.transaction(operation);
  }
  /** 조회 요청. 공유 저장소에서는 최신 기록을 먼저 읽는다. */
  view<T>(operation: () => Promise<T>) {
    return this.repository.read(operation);
  }

  // ── 시작 검사 ───────────────────────────────────────────────

  async initialize() {
    if (this.dep.ledgerVersion !== 4 || this.dep.ruleVersion !== 3)
      throw new Error("가입 원장 v4를 배포한 뒤 서버를 다시 시작하세요.");
    if (this.dep.proofKeyHash !== proofKeyHash())
      throw new Error(
        "증명 키와 배포한 Verifier가 다릅니다. 같은 키로 원장을 다시 배포하세요.",
      );
    if ((await readChainId(this)) !== this.dep.chainId)
      throw new Error("RPC 네트워크가 배포 설정과 다릅니다.");
    if ((await readCodeHash(this, this.dep.ledger)) !== this.dep.ledgerCodeHash)
      throw new Error(
        "원장이 없거나 배포 설정과 코드가 다릅니다. npm run deploy:local을 실행하세요.",
      );
    // 잠금 안에서 복구한다. 그래야 다른 인스턴스가 처리 중인 기록을 중단된 기록으로 보지 않는다.
    await this.exclusive(() => this.reconcile(true));
  }

  // ── 업무 메서드 (modules/로 넘긴다) ─────────────────────────

  /** RPC, 원장, 판매 기록 저장소 점검. */
  health() {
    return monitoring.health(this);
  }
  reconcile(recoverInterrupted = false) {
    return transactions.reconcile(this, recoverInterrupted);
  }
  chainSale(id: string) {
    return records.chainSale(this, id);
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
