import { parseEventLogs, type Log } from "viem";
import {
  ledgerAbi,
  PRODUCTS,
  RULE_HASH,
  type Trace,
} from "../../../../packages/core/src/index.ts";
import { getProduct } from "../../../../packages/ui/src/sale.ts";

export const registrationActions = new Set(["registerProduct", "registerRule"]);

const traceLabels: Record<string, string> = {
  registerProduct: "상품 등록",
  registerRule: "진단 기준 등록",
  openSale: "가입 신청 접수",
  commitAnswers: "진단 답변 기록",
  recordDiagnosis: "진단 결과 기록",
  confirmExplanation: "상품 설명 확인",
  confirmHigherRisk: "추가 위험 확인",
  confirmMockSignature: "서명 기록",
  approveReview: "관리자 승인",
  finalize: "가입 조건 검증",
  completeEnrollment: "가입 완료 거래",
  requestMockPurchase: "테스트 매입 요청",
  awaitMockPurchase: "테스트 매입 대기",
  recordMockPurchase: "테스트 매입 결과 반영",
};

export function receiptEvents(trace?: Trace, ledger?: string) {
  if (
    trace?.status !== "confirmed" ||
    !trace.txHash ||
    !ledger ||
    !trace.detail ||
    typeof trace.detail !== "object" ||
    !("logs" in trace.detail) ||
    !Array.isArray(trace.detail.logs)
  )
    return [];
  try {
    const logs = (trace.detail.logs as Log[]).filter(
      (log) =>
        log.address.toLowerCase() === ledger.toLowerCase() &&
        log.transactionHash === trace.txHash,
    );
    return parseEventLogs({
      abi: ledgerAbi,
      logs,
      strict: true,
    });
  } catch {
    return [];
  }
}

export function traceLabel(trace: Trace, ledger?: string) {
  const label = traceLabels[trace.action] ?? trace.action;
  if (trace.action !== "registerProduct") return label;
  const registration = receiptEvents(trace, ledger).find(
    (event) => event.eventName === "ProductRegistered",
  );
  const product = getProduct(registration?.args.productId);
  return product ? `${label} · ${product.document.name}` : label;
}

/** 등록 거래 영수증의 이벤트로 상품과 진단 기준의 원장 등록 상태를 계산한다. */
export function registrationStatus(traces: Trace[], ledger?: string) {
  const events = traces
    .filter((trace) => registrationActions.has(trace.action))
    .flatMap((trace) => receiptEvents(trace, ledger));
  const documentHashes = new Map(
    events
      .filter((event) => event.eventName === "ProductRegistered")
      .map(({ args }) => [
        args.productId.toLowerCase(),
        args.documentHash.toLowerCase(),
      ]),
  );
  const ruleRegistered = events.some(
    (event) =>
      event.eventName === "RuleRegistered" &&
      event.args.ruleHash.toLowerCase() === RULE_HASH.toLowerCase(),
  );
  const productsRegistered = PRODUCTS.every(
    (product) =>
      documentHashes.get(product.id.toLowerCase()) ===
      product.documentHash.toLowerCase(),
  );
  return { documentHashes, ruleRegistered, productsRegistered };
}
