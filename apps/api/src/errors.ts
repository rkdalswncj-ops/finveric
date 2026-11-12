// 오류 응답에 `code`를 싣는 오류. 모든 계층이 던질 수 있다. 이 파일은 다른 계층을 import하지 않는다.
import type { ErrorCode } from "../../../packages/core/src/api.ts";
import type { LedgerError } from "../../../packages/core/src/index.ts";

/**
 * 이유를 기계가 읽을 수 있는 업무 오류. 오류 처리기(`app.ts`)가 `error`, `code`, `ledgerError`를 응답에 넣는다.
 * 문장은 우리가 쓴 한국어 문장이어야 한다.
 */
export class CodedError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly ledgerError?: LedgerError,
  ) {
    super(message);
  }
}
