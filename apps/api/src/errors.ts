// 오류 응답에 `code`를 싣는 오류와 고정 오류 문장. 모든 계층이 쓸 수 있다. 이 파일은 다른 계층을 import하지 않는다.
import type { ErrorCode, ErrorResponse } from "@finveric/core/api";
import { LEDGER_ERRORS, type LedgerError } from "@finveric/core";

/**
 * 이유를 기계가 읽을 수 있는 오류. 오류 처리기(`app.ts`)가 `error`, `code`, `ledgerError`를 응답에 넣는다.
 * 문장은 우리가 쓴 한국어 문장이다. 합니다체로 원인과 다음 행동을 쓴다.
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

/** 원장 거절(`code: "rejected"`)의 문장. 원장 오류 이름을 모르면 일반 안내를 쓴다. */
export const ledgerRejectionMessage = (error?: LedgerError) =>
  `원장이 요청을 거절했습니다. ${error ? LEDGER_ERRORS[error] : "필수 기록과 현재 단계를 확인하세요."}`;

/**
 * 경로 밖에서 정하는 오류 응답: 접근 검사, Fastify·플러그인의 4xx, 없는 경로, 우리가 쓰지 않은 오류.
 * 오류 처리기(`app.ts`)와 API 문서의 예시(`docs/openapi.ts`)가 함께 쓴다.
 */
export const HTTP_ERRORS = {
  badRequest: {
    error:
      "요청 형식이 맞지 않습니다. API 문서에서 경로 값과 본문 형식을 확인하세요.",
    code: "invalid_input",
  },
  bodyTooLarge: {
    error: "본문이 64KB를 넘습니다. 본문을 줄여 다시 보내세요.",
    code: "invalid_input",
  },
  unsupportedMediaType: {
    error:
      "본문 형식이 JSON이 아닙니다. Content-Type을 application/json으로 보내세요.",
    code: "invalid_input",
  },
  accessCode: {
    error: "접근 코드가 없거나 맞지 않습니다. 접근 코드를 확인하세요.",
    code: "unauthorized",
  },
  apiKey: {
    error:
      "없거나 폐기한 API 키입니다. 판매사 콘솔에서 사용 중인 키를 확인하세요.",
    code: "unauthorized",
  },
  apiKeyScope: {
    error:
      "판매 채널 연동 API만 API 키로 부를 수 있습니다. 다른 API는 판매사 콘솔의 접근 코드로 부르세요.",
    code: "forbidden",
  },
  origin: {
    error:
      "허용하지 않은 출처의 요청입니다. 서버의 WEB_ORIGIN에 웹 주소를 등록하세요.",
    code: "forbidden",
  },
  notFound: {
    error:
      "없는 API 경로입니다. API 문서(/api/docs)에서 경로와 메서드를 확인하세요.",
    code: "not_found",
  },
  rateLimited: {
    error: "요청이 너무 많습니다. 1분 뒤 다시 시도하세요.",
    code: "rate_limited",
  },
  unavailable: {
    error:
      "처리를 완료하지 못했습니다. 잠시 뒤 다시 요청하세요. 계속 실패하면 서버 연결과 온체인 처리 기록을 확인하세요.",
    code: "unavailable",
  },
} as const satisfies Record<string, ErrorResponse>;
