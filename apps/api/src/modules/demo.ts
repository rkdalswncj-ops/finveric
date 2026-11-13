// 시연: 사후 변경 시도. 판매사가 이미 기록한 회차를 더 유리한 결과로 다시 쓰려 한다.
// 판매사 키로 원장 호출을 시뮬레이션만 한다. 거래는 보내지 않는다. 원장이 회차 검사(InvalidAttempt)로 거절한다.
import type {
  TamperRequest,
  TamperResponse,
} from "../../../../packages/core/src/api.ts";
import { CodedError } from "../errors.ts";
import type { FundService } from "../service.ts";
import {
  LedgerRejection,
  readAttemptCount,
  readDiagnosis,
  simulate,
} from "../gateways/ledger.ts";
import { customerRef } from "./customers.ts";
import { note } from "./transactions.ts";

export async function tamper(
  svc: FundService,
  { customerNo, attempt }: TamperRequest,
): Promise<TamperResponse> {
  const ref = customerRef(svc, customerNo);
  if (attempt > (await readAttemptCount(svc, ref)))
    throw new CodedError(
      "아직 기록하지 않은 회차입니다. 이미 기록한 회차를 고르세요.",
      "wrong_state",
    );
  const recorded = await readDiagnosis(svc, ref, attempt);
  // 투자성향을 한 단계 올리고 권유 가능 등급을 한 단계 넓힌 결과로 바꾸려 한다.
  const profile = Math.min(5, recorded.profile + 1);
  const limit = Math.max(1, recorded.limit - 1);
  const trace = note(svc, {
    source: "seller",
    action: "recordDiagnosis · 기록 변경 시도",
    status: "pending",
    customerRef: ref,
    detail: { attempt, from: recorded.profile, to: profile },
  });
  try {
    await simulate(svc, "seller", "recordDiagnosis", [
      BigInt(ref),
      attempt,
      recorded.ruleHash,
      recorded.commitment,
      profile,
      limit,
      recorded.elderly,
      Array<bigint>(8).fill(0n),
    ]);
  } catch (error) {
    if (!(error instanceof LedgerRejection)) {
      trace.status = "failed";
      svc.repository.save();
      throw new CodedError(
        "원장 시뮬레이션을 하지 못했습니다. RPC 연결을 확인하세요.",
        "unavailable",
      );
    }
    trace.status = "failed";
    trace.detail = { attempt, error: error.error, reason: error.message };
    svc.repository.save();
    return {
      rejected: true,
      ...(error.error ? { error: error.error } : {}),
      reason: error.message,
      customerRef: ref,
      attempt,
    };
  }
  trace.status = "confirmed";
  svc.repository.save();
  return {
    rejected: false,
    reason: "원장이 변경 요청을 거절하지 않았습니다. 원장 버전을 확인하세요.",
    customerRef: ref,
    attempt,
  };
}
