// 리포지토리: 판매 건과 처리 기록의 조회·추가·삭제·저장, 변경 작업의 잠금.
// 저장 방식(로컬 파일, Upstash Redis)은 store.ts가 맡는다. 업무 모듈은 저장 방식을 모른다.
import type { Hex, TransactionSerializedEIP1559 } from "viem";
import {
  json,
  type SaleRecord,
  type Trace,
} from "../../../../packages/core/src/index.ts";
import { FileStore, type SaleStore } from "./store.ts";

/** 서버만 보관하는 처리 기록. 서명한 가입 거래 원문은 공개하지 않는다. */
export type StoredTrace = Trace & {
  rawTransaction?: TransactionSerializedEIP1559;
};

/** 서버가 보관하는 판매 건. 답변·임의값·준법 서명을 포함한다. */
export type StoredSale = Omit<SaleRecord, "traces"> & {
  productId: Hex;
  traces: StoredTrace[];
  reviewSignature?: Hex;
};

/** 처리 기록 하나와 그 기록이 속한 판매 건. 상품·규칙 등록 기록은 판매 건이 없다. */
export type TraceEntry = { trace: StoredTrace; sale?: StoredSale };

export class SaleRepository {
  private sales: StoredSale[] = [];
  private systemTraces: Trace[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  /** 이 인스턴스에서 대기 중이거나 실행 중인 변경 작업 수. */
  private active = 0;
  private locked = false;
  private persisting: Promise<void> = Promise.resolve();
  private persistError?: unknown;

  constructor(readonly store: SaleStore) {
    if (store instanceof FileStore) this.load(store.readSync());
  }
  get file() {
    return this.store instanceof FileStore ? this.store.file : undefined;
  }

  // ── 조회와 변경 ─────────────────────────────────────────────

  /** 판매 건 목록. 최근 신청이 앞에 온다. */
  all(): readonly StoredSale[] {
    return this.sales;
  }
  find(id: string) {
    const record = this.sales.find((s) => s.id === id);
    if (!record) throw new Error("판매 건을 찾을 수 없습니다.");
    return record;
  }
  add(record: StoredSale) {
    this.sales.unshift(record);
    this.save();
  }
  remove(record: StoredSale) {
    this.sales = this.sales.filter((sale) => sale !== record);
    this.save();
  }
  /** 처리 기록을 판매 건에, 판매 건이 없으면 상품·규칙 등록 기록에 붙인다. */
  addTrace(trace: Trace, sale?: Pick<StoredSale, "traces">) {
    (sale?.traces ?? this.systemTraces).push(trace);
    this.save();
  }
  /** 모든 처리 기록. 상품·규칙 등록 기록이 먼저 온다. */
  traces(): TraceEntry[] {
    return [
      ...this.systemTraces.map((trace) => ({ trace })),
      ...this.sales.flatMap((sale) =>
        sale.traces.map((trace) => ({ trace, sale })),
      ),
    ];
  }
  /** 제출했지만 영수증을 아직 대조하지 않은 거래가 있는지. */
  hasPendingTransaction() {
    return this.traces().some(
      ({ trace }) => trace.status === "pending" && trace.txHash,
    );
  }

  // ── 저장과 잠금 ─────────────────────────────────────────────

  private load(raw: string | undefined) {
    if (!raw) return;
    const saved = JSON.parse(raw);
    this.sales = saved.sales;
    this.systemTraces = saved.systemTraces;
  }
  /**
   * 현재 상태를 저장한다. 판매 건의 필드를 바꾼 뒤에도 부른다.
   * 공유 저장소는 잠금 안에서만 쓴다. 조회 중 영수증 대조 결과는 메모리에만 반영한다.
   */
  save() {
    const data = json({ sales: this.sales, systemTraces: this.systemTraces });
    if (this.store instanceof FileStore) return this.store.writeSync(data);
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
  transaction<T>(operation: () => Promise<T>): Promise<T> {
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
   * 조회 작업. 공유 저장소에서는 다른 인스턴스가 쓴 기록을 먼저 읽는다.
   * 이 인스턴스에서 변경 작업이 진행 중이면 메모리의 최신 상태를 그대로 쓴다.
   */
  async read<T>(operation: () => Promise<T>): Promise<T> {
    if (this.store.shared && this.active === 0) {
      const raw = await this.store.read();
      if (this.active === 0) this.load(raw);
    }
    return operation();
  }
}
