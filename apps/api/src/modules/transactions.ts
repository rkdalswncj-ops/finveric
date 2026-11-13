// 원장 거래 처리 기록: 시뮬레이션·제출·영수증 대조를 기록하고, 대기 중인 거래의 영수증을 다시 확인한다.
import { randomUUID } from "node:crypto";
import type { Hex, TransactionReceipt } from "viem";
import type { Role, Trace } from "../../../../packages/core/src/index.ts";
import { CodedError } from "../errors.ts";
import type { FundService } from "../service.ts";
import type { StoredSale } from "../repositories/sales.ts";
import {
  getReceipt,
  LedgerRejection,
  ledgerEvents,
  simulate,
  submit,
  waitForReceipt,
  type LedgerEvent,
  type LedgerFunction,
} from "../gateways/ledger.ts";

/**
 * 대기 중인 거래의 영수증을 대조한다.
 * `recoverInterrupted`이면 거래 해시 없이 남은 기록을 실패로 바꾼다. 잠금 안에서만 이 옵션을 쓴다.
 */
export async function reconcile(svc: FundService, recoverInterrupted = false) {
  for (const { trace } of svc.repository
    .traces()
    .filter(({ trace }) => trace.status === "pending")) {
    if (!trace.txHash) {
      if (recoverInterrupted) {
        trace.status = "failed";
        trace.detail = "거래 제출 전 서버가 중단되었습니다. 다시 요청하세요.";
      }
      continue;
    }
    try {
      const receipt = await getReceipt(svc, trace.txHash);
      trace.status = receipt.status === "success" ? "confirmed" : "failed";
      trace.blockNumber = receipt.blockNumber.toString();
      trace.detail = receipt;
    } catch {
      /* Keep an unmined transaction pending; do not resubmit it. */
    }
  }
  svc.repository.save();
}

/** 미확정 거래가 있으면 영수증을 먼저 확인한다. 그래도 남아 있으면 새 거래를 거절한다. */
export async function ensureNoPending(svc: FundService) {
  if (!svc.repository.hasPendingTransaction()) return;
  await reconcile(svc);
  if (svc.repository.hasPendingTransaction())
    throw new CodedError(
      "미확정 거래가 있습니다. 영수증을 확인한 뒤 다시 요청하세요.",
      "pending",
    );
}

export type SendOptions = {
  /** 성공 영수증에 있어야 하는 이벤트. */
  event: LedgerEvent["eventName"];
  /** 그 이벤트가 이번 요청의 것인지 확인한다. */
  match: (log: LedgerEvent) => boolean;
  sale?: StoredSale;
  customerRef?: Hex;
  /** 거래 해시를 받은 직후 부른다. 영수증 전에 원본을 거래에 연결할 때 쓴다. */
  onSubmitted?: (hash: Hex) => void;
};

/**
 * 역할 키로 원장 함수를 호출한다. 먼저 시뮬레이션해서 원장이 거절하면 거래를 보내지 않는다.
 * 성공 영수증에서 이번 요청의 이벤트를 확인한다.
 */
export async function send(
  svc: FundService,
  role: Role,
  functionName: LedgerFunction,
  args: readonly unknown[],
  options: SendOptions,
): Promise<{ hash: Hex; receipt: TransactionReceipt; trace: Trace }> {
  await ensureNoPending(svc);
  const trace: Trace = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source: role,
    action: functionName,
    status: "pending",
    ...(options.sale ? { saleId: options.sale.id } : {}),
    customerRef: options.customerRef ?? options.sale?.customerRef,
  };
  svc.repository.addTrace(trace, options.sale);
  try {
    const request = await simulate(svc, role, functionName, args);
    const hash = await submit(svc, role, request);
    trace.txHash = hash;
    options.onSubmitted?.(hash);
    svc.repository.save();
    const receipt = await waitForReceipt(svc, hash);
    trace.blockNumber = receipt.blockNumber.toString();
    trace.detail = receipt;
    if (receipt.status !== "success") {
      trace.status = "failed";
      svc.repository.save();
      throw new LedgerRejection();
    }
    if (
      !ledgerEvents(svc, receipt).some(
        (log) => log.eventName === options.event && options.match(log),
      )
    ) {
      trace.status = "failed";
      svc.repository.save();
      throw new CodedError(
        "성공 영수증에서 이번 요청의 이벤트를 찾을 수 없습니다. 온체인 처리 기록에서 거래를 확인하세요.",
        "unavailable",
      );
    }
    trace.event = options.event;
    trace.status = "confirmed";
    svc.repository.save();
    return { hash, receipt, trace };
  } catch (error) {
    if (error instanceof LedgerRejection) {
      trace.status = "failed";
      trace.detail ??= { error: error.error, reason: error.message };
      svc.repository.save();
      throw error;
    }
    if (!trace.txHash) {
      trace.status = "failed";
      trace.detail =
        "거래를 제출하지 못했습니다. RPC 연결과 테스트 ETH 잔액을 확인하세요.";
    }
    svc.repository.save();
    if (trace.status === "pending")
      throw new CodedError(
        "거래 영수증이 아직 없습니다. 온체인 처리 화면에서 해시를 확인하세요.",
        "pending",
      );
    throw error instanceof Error && /^[가-힣]/.test(error.message)
      ? error
      : new CodedError(
          "처리를 완료하지 못했습니다. 온체인 처리 기록을 확인하세요.",
          "unavailable",
        );
  }
}

/** 원장 거래 없이 끝난 단계(관리자 서명, 가입 중단, 원장 거절)를 처리 기록에 남긴다. */
export function note(
  svc: FundService,
  trace: Omit<Trace, "id" | "at">,
  sale?: StoredSale,
) {
  const entry: Trace = {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...(sale ? { saleId: sale.id, customerRef: sale.customerRef } : {}),
    ...trace,
  };
  svc.repository.addTrace(entry, sale);
  return entry;
}
