// 오류 응답에 `type`과 `code`를 싣는 오류. 모든 계층이 쓸 수 있다. 이 파일은 다른 계층을 import하지 않는다.
import type { ErrorResponse } from "@finveric/core/api";
import { errorBody, type ErrorCode } from "@finveric/core/errors";

/**
 * 이유를 기계가 읽을 수 있는 오류. 오류 처리기(`app.ts`)가 `body`를 그대로 응답한다.
 * 문장은 `@finveric/core/errors`의 `ERROR_CODES`에 있다. `detail`은 그 문장 뒤에 붙는 바뀌는 부분이다(검사 이유, 빠진 기록).
 */
export class CodedError extends Error {
  readonly body: ErrorResponse;
  constructor(
    readonly code: ErrorCode,
    detail?: string,
  ) {
    const body = errorBody(code, detail);
    super(body.error);
    this.body = body;
  }
  get type() {
    return this.body.type;
  }
}
