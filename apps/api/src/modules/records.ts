// 가입 기록: 공개 조회, 처리 기록, 고객 증빙(영수증·원본).
import {
  RULE_HASH,
  type ChainSale,
  type EvidenceReceipt,
  type OriginalBundle,
  type Trace,
} from "../../../../packages/core/src/index.ts";
import type { FundService } from "../service.ts";
import type { StoredSale, StoredTrace } from "./types.ts";
import { chainSale, reconcile } from "./ledger.ts";
import { requireProduct } from "./products.ts";

function publicTrace({
  rawTransaction: _rawTransaction,
  ...trace
}: StoredTrace): Trace {
  return trace;
}

/** 실패하지 않은 가입 확정 거래 기록. */
export function enrollmentTrace(record: StoredSale) {
  return record.traces.find(
    (trace) =>
      trace.action === "completeEnrollment" && trace.status !== "failed",
  );
}

/** 공개 조회용 판매 건. 답변·임의값·서명 거래 원문은 넣지 않는다. */
export async function publicSale(svc: FundService, record: StoredSale) {
  const product = requireProduct(record.productId);
  const onchain = enrollmentTrace(record)
    ? await chainSale(svc, record.id)
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
      enrollmentTrace(record)?.status === "pending" && !state.finalized,
    attempts: record.attempts.map((a) => ({
      round: a.round,
      commitment: a.commitment,
      confirmed: a.confirmed,
      profile: a.profile,
    })),
    state,
  };
}

/** 모든 처리 기록을 시간순으로 돌려준다. 대기 중인 거래는 먼저 영수증을 대조한다. */
export async function publicTraces(svc: FundService) {
  await reconcile(svc);
  return [
    ...svc.systemTraces,
    ...svc.sales.flatMap((sale) => sale.traces.map(publicTrace)),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

async function completedRecord(svc: FundService, id: string) {
  const record = svc.find(id);
  if (enrollmentTrace(record)?.status === "pending") await reconcile(svc);
  if (enrollmentTrace(record)?.status !== "confirmed")
    throw new Error("가입이 완료되면 서류를 받을 수 있어요.");
  return record;
}

/** 고객이 보관하는 원본 묶음. 회차별 가상 답변과 임의값, 설명서를 담는다. */
export async function original(
  svc: FundService,
  id: string,
): Promise<OriginalBundle> {
  const record = await completedRecord(svc, id);
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

/** 검증 영수증. 네트워크·원장 주소와 확정된 거래 해시를 담는다. */
export async function receipt(
  svc: FundService,
  id: string,
): Promise<EvidenceReceipt> {
  const record = await completedRecord(svc, id);
  const product = requireProduct(record.productId);
  return {
    format: "finveric-receipt-v4",
    saleId: id,
    chainId: svc.dep.chainId,
    ledger: svc.dep.ledger,
    productId: product.id,
    documentHash: product.documentHash,
    ruleHash: RULE_HASH,
    transactions: record.traces
      .filter((t) => t.txHash && t.status === "confirmed")
      .map((t) => t.txHash!),
  };
}
