// 원장: 거래 제출, 영수증 대조, 판매 건 조회.
import { randomUUID } from "node:crypto";
import {
  createWalletClient,
  http,
  parseEventLogs,
  type TransactionReceipt,
} from "viem";
import {
  ledgerAbi,
  type Role,
  type SaleRecord,
  type Trace,
} from "../../../../packages/core/src/index.ts";
import type { FundService } from "../service.ts";
import type { StoredSale, StoredTrace } from "./types.ts";

export function chainSale(svc: FundService, id: string) {
  return svc.client.readContract({
    address: svc.dep.ledger,
    abi: ledgerAbi,
    functionName: "getSale",
    args: [BigInt(id)],
  });
}

/**
 * 대기 중인 거래의 영수증을 대조한다.
 * `recoverInterrupted`이면 거래 해시 없이 남은 기록을 실패로 바꾼다. 잠금 안에서만 이 옵션을 쓴다.
 */
export async function reconcile(svc: FundService, recoverInterrupted = false) {
  const tracedSales = svc.sales.flatMap((sale) =>
    sale.traces.map((trace) => ({ trace, sale })),
  );
  for (const { trace, sale } of [
    ...svc.systemTraces.map((trace) => ({ trace, sale: undefined })),
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
      const receipt = await svc.client.getTransactionReceipt({
        hash: trace.txHash,
      });
      if (sale && trace.action === "completeEnrollment")
        recordEnrollmentReceipt(svc, sale, trace, receipt);
      else {
        trace.status = receipt.status === "success" ? "confirmed" : "failed";
        trace.blockNumber = receipt.blockNumber.toString();
        trace.detail = receipt;
      }
    } catch {
      /* Keep an unmined transaction pending; do not resubmit it. */
    }
  }
  svc.save();
}

/** 역할 키로 원장 함수를 호출하고, 성공 영수증에서 같은 판매 ID의 이벤트를 확인한다. */
export async function send(
  svc: FundService,
  role: Role,
  functionName: string,
  args: unknown[],
  event: string,
  record?: SaleRecord,
) {
  const traces = record?.traces ?? svc.systemTraces;
  if (
    [...svc.systemTraces, ...svc.sales.flatMap((s) => s.traces)].some(
      (t) => t.status === "pending" && t.txHash,
    )
  ) {
    await reconcile(svc);
    if (
      [...svc.systemTraces, ...svc.sales.flatMap((s) => s.traces)].some(
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
  svc.save();
  try {
    const wallet = createWalletClient({
      account: svc.env.accounts[role],
      chain: svc.env.chain,
      transport: http(svc.env.rpcUrl),
    });
    // Fixed gas also lets the missing-record demonstration reach the EVM and produce a reverted receipt.
    const hash = await wallet.writeContract({
      address: svc.dep.ledger,
      abi: ledgerAbi,
      functionName: functionName as any,
      args: args as any,
      gas: 1_500_000n,
    });
    trace.txHash = hash;
    svc.save();
    const receipt = await svc.client.waitForTransactionReceipt({
      hash,
      timeout: 180_000,
    });
    trace.blockNumber = receipt.blockNumber.toString();
    trace.detail = receipt;
    if (receipt.status !== "success") {
      trace.status = "failed";
      svc.save();
      throw new Error(
        "컨트랙트가 요청을 거절했습니다. 필수 기록과 현재 단계를 확인하세요.",
      );
    }
    const events = parseEventLogs({
      abi: ledgerAbi,
      logs: receipt.logs,
    }).filter((l) => l.address.toLowerCase() === svc.dep.ledger.toLowerCase());
    if (
      !events.some(
        (l) =>
          l.eventName === event &&
          (!record ||
            ("saleId" in l.args && l.args.saleId === BigInt(record.id))),
      )
    ) {
      trace.status = "failed";
      svc.save();
      throw new Error("성공 영수증의 판매 ID와 이벤트를 대조할 수 없습니다.");
    }
    trace.event = event;
    trace.status = "confirmed";
    svc.save();
    return hash;
  } catch (error) {
    if (!trace.txHash) {
      trace.status = "failed";
      trace.detail =
        "거래를 제출하지 못했습니다. RPC 연결과 테스트 ETH 잔액을 확인하세요.";
    }
    svc.save();
    if (trace.status === "pending")
      throw new Error(
        "거래 영수증이 아직 없습니다. 온체인 처리 화면에서 해시를 확인하세요.",
      );
    throw error instanceof Error && error.message.startsWith("컨트랙트")
      ? error
      : new Error("처리를 완료하지 못했습니다. 온체인 처리 기록을 확인하세요.");
  }
}

/** 가입 확정 거래의 영수증을 송신자, 회차, 이벤트로 대조해 기록한다. */
export function recordEnrollmentReceipt(
  svc: FundService,
  record: StoredSale,
  trace: StoredTrace,
  receipt: TransactionReceipt,
) {
  const logs = parseEventLogs({ abi: ledgerAbi, logs: receipt.logs }).filter(
    (log) =>
      log.address.toLowerCase() === svc.dep.ledger.toLowerCase() &&
      "saleId" in log.args &&
      log.args.saleId === BigInt(record.id),
  );
  const success =
    receipt.status === "success" &&
    receipt.transactionHash === trace.txHash &&
    receipt.from.toLowerCase() === svc.dep.roles.customer.toLowerCase() &&
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
          svc.dep.roles.customer.toLowerCase(),
    );
  trace.status = success ? "confirmed" : "failed";
  trace.event = success ? "ConditionsVerified" : undefined;
  trace.blockNumber = receipt.blockNumber.toString();
  trace.detail = receipt;
  delete trace.rawTransaction;
}
