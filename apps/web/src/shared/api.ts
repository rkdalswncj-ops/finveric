import type { LedgerError } from "@finveric/core";
import type { ErrorResponse } from "@finveric/core/api";
import type { ErrorCode, ErrorType } from "@finveric/core/errors";

export function token() {
  return sessionStorage.getItem("finveric-token") ?? "";
}

/** 서버에 닿지 못했거나 응답을 읽지 못했을 때의 문장. 판매사 콘솔·감독기관·진입 화면용(합니다체)이다. */
export const OFFLINE_MESSAGE =
  "서버에 연결하지 못했습니다. 연결을 확인하고 화면을 새로 고치세요.";

/**
 * API 오류. `message`는 화면에 보여 줄 한국어 문장이다.
 * `type`과 `code`는 API 응답의 값이다. 서버에 닿지 못했거나 응답이 JSON이 아니면 `type`이 `offline`이고 `code`가 없다.
 * 고객 화면은 `type`(필요하면 `code`)으로 고객용 문장을 고른다.
 */
export class ApiError extends Error {
  readonly type?: ErrorType | "offline";
  readonly code?: ErrorCode;
  readonly ledgerError?: LedgerError;
  readonly status?: number;
  constructor(
    message: string,
    details: {
      type?: ErrorType | "offline";
      code?: ErrorCode;
      ledgerError?: LedgerError;
      status?: number;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.type = details.type;
    this.code = details.code;
    this.ledgerError = details.ledgerError;
    this.status = details.status;
  }
}

/** 화면 자료를 읽는 상태. 처음 읽기에 실패하면 `failed`다. 다시 읽어 성공하면 `ready`가 된다. */
export type LoadState = "loading" | "ready" | "failed";

/** 판매사 API를 부른다. 응답을 해석하는 곳은 여기 하나다. 실패하면 `ApiError`를 던진다. */
export async function api<T>(
  path: string,
  body?: unknown,
  credential = token(),
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, { type: "offline" });
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    // 프록시가 돌려준 502처럼 본문이 비었거나 JSON이 아니다.
    throw new ApiError(OFFLINE_MESSAGE, {
      type: "offline",
      status: response.status,
    });
  }
  if (!response.ok) {
    const failure = (value ?? {}) as Partial<ErrorResponse>;
    throw new ApiError(
      typeof failure.error === "string" && failure.error
        ? failure.error
        : "요청을 완료하지 못했습니다. 잠시 뒤 다시 시도하세요.",
      {
        type: failure.type,
        code: failure.code,
        ledgerError: failure.ledgerError,
        status: response.status,
      },
    );
  }
  return value as T;
}

export function saveFile(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
