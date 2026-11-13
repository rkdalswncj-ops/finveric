// 온체인 처리 기록(/api/traces)의 표시 이름, 출처, 상태, 영수증 이벤트.
import { parseEventLogs, type Log } from "viem";
import {
  LEDGER_ERRORS,
  ledgerAbi,
  type LedgerError,
} from "../../../../packages/core/src/index.ts";
import type { TraceDto } from "../../../../packages/core/src/api.ts";
import type { Tone } from "../../../../packages/ui/src/components.tsx";

/** 원장 함수 이름의 작업 이름. 원장 밖 기록(증명 생성, 관리자 승인 서명, 가입 중단)은 API가 한국어로 쓴다. */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  registerRule: "진단 기준 등록",
  registerProduct: "상품 설명서 등록",
  recordDiagnosis: "진단 회차 기록",
  subscribe: "청약",
  confirm: "최종 확인",
  withdraw: "철회",
  recordSettlement: "결제 기록",
};
const SOURCE_LABELS: Readonly<Record<string, string>> = {
  seller: "판매사 키",
  approver: "관리자 승인 키",
  customer: "고객 키",
  infrastructure: "인프라 키",
};

export const traceLabel = (trace: TraceDto) =>
  trace.action.startsWith("recordDiagnosis ·")
    ? "기록 변경 시도(시뮬레이션)"
    : (ACTION_LABELS[trace.action] ?? trace.action);
export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;

export type TraceGroup = "registry" | "diagnosis" | "sale";
export const TRACE_GROUPS: Readonly<Record<TraceGroup, string>> = {
  registry: "기준·상품 등록",
  diagnosis: "진단",
  sale: "판매 건",
};
export function traceGroup(trace: TraceDto): TraceGroup {
  if (trace.action === "registerRule" || trace.action === "registerProduct")
    return "registry";
  if (trace.saleId) return "sale";
  return "diagnosis";
}

/**
 * 실패 기록 중 원장이 사용자 정의 오류로 거절한 경우의 오류 이름과 이유.
 * 오류 이름을 알면 core의 이유 문장(합니다체)을 쓴다. 예전 기록에 남은 문장(`reason`)의 말투와 관계없이 같은 문장이 된다.
 */
export function ledgerRejection(trace: TraceDto) {
  const detail = trace.detail as
    { error?: string; reason?: string } | undefined;
  if (trace.status !== "failed" || !detail || typeof detail !== "object")
    return undefined;
  const error =
    detail.error && detail.error in LEDGER_ERRORS
      ? (detail.error as LedgerError)
      : undefined;
  return error || detail.reason
    ? {
        error,
        reason: error
          ? LEDGER_ERRORS[error]
          : (detail.reason ??
            "원장이 거절했습니다. 필수 기록과 현재 단계를 확인하세요."),
      }
    : undefined;
}

/** 처리 상태 표시. 대기, 완료, 원장 거절, 실패를 구분한다. 영수증을 기다리는 대기는 info다. */
export function traceStatus(trace: TraceDto): [label: string, tone: Tone] {
  if (trace.status === "confirmed") return ["완료", "success"];
  if (trace.status === "pending") return ["대기", "info"];
  return ledgerRejection(trace) ? ["원장 거절", "warning"] : ["실패", "danger"];
}

/** 성공 영수증에서 이 원장이 남긴 이벤트. */
export function receiptEvents(trace?: TraceDto, ledger?: string) {
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
    return parseEventLogs({ abi: ledgerAbi, logs, strict: true });
  } catch {
    return [];
  }
}
