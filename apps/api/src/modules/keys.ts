// 판매사 콘솔: API 키 발급·폐기와 인증.
// 증권사 앱 서버가 `판매 채널 연동` API를 부를 때 쓴다. 키 원문은 발급 응답에만 한 번 내보내고, 저장소에는 SHA-256 해시만 둔다.
import { createHash, randomBytes } from "node:crypto";
import {
  API_KEY_PREFIX,
  MAX_ACTIVE_API_KEYS,
  type ApiKeyDto,
  type IssuedApiKeyDto,
} from "@finveric/core/api";
import { CodedError } from "../errors.ts";
import type { StoredApiKey } from "../repositories/sales.ts";
import type { FundService } from "../service.ts";

/** 마지막 사용 시각을 다시 기록하는 간격. 요청마다 저장소에 쓰지 않는다. */
export const TOUCH_INTERVAL_MS = 60_000;

const hashOf = (key: string) => createHash("sha256").update(key).digest("hex");
const active = (key: StoredApiKey) => !key.revokedAt;

function view(key: StoredApiKey): ApiKeyDto {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scope: key.scope,
    createdAt: key.createdAt,
    ...(key.lastUsedAt ? { lastUsedAt: key.lastUsedAt } : {}),
    ...(key.revokedAt ? { revokedAt: key.revokedAt } : {}),
  };
}

/** 발급한 키 목록. 최근 발급이 앞에 온다. 폐기한 키도 기록으로 남긴다. */
export function listApiKeys(svc: FundService): ApiKeyDto[] {
  return [...svc.repository.apiKeys()].reverse().map(view);
}

/** 새 키를 발급한다. 키 원문은 이 응답에만 있다. */
export function issueApiKey(svc: FundService, name: string): IssuedApiKeyDto {
  const label = name.trim();
  if (!label)
    throw new CodedError(
      "키 이름이 비어 있습니다. 키를 쓰는 곳을 알 수 있는 이름을 보내세요.",
      "invalid_input",
    );
  if (svc.repository.apiKeys().filter(active).length >= MAX_ACTIVE_API_KEYS)
    throw new CodedError(
      `사용 중인 API 키는 ${MAX_ACTIVE_API_KEYS}개까지입니다. 쓰지 않는 키를 폐기한 뒤 발급하세요.`,
      "limit_reached",
    );
  const key = API_KEY_PREFIX + randomBytes(24).toString("base64url");
  const stored: StoredApiKey = {
    id: `key_${randomBytes(6).toString("hex")}`,
    name: label,
    prefix: key.slice(0, 12),
    hash: hashOf(key),
    scope: "channel",
    createdAt: new Date().toISOString(),
  };
  svc.repository.addApiKey(stored);
  return { ...view(stored), key };
}

/** 키를 폐기한다. 이미 폐기한 키는 그대로 돌려준다. */
export function revokeApiKey(svc: FundService, id: string): ApiKeyDto {
  const key = svc.repository.apiKeys().find((k) => k.id === id);
  if (!key)
    throw new CodedError(
      "찾을 수 없는 API 키입니다. 키 목록을 다시 읽어 키 ID를 확인하세요.",
      "not_found",
    );
  if (!key.revokedAt) {
    key.revokedAt = new Date().toISOString();
    svc.repository.save();
  }
  return view(key);
}

/** 키 원문에 맞는 사용 중인 키. 없거나 폐기했으면 undefined다. */
export function findApiKey(svc: FundService, key: string) {
  const hash = hashOf(key);
  return svc.repository.apiKeys().find((k) => k.hash === hash && active(k));
}

/** 마지막 사용 시각을 다시 기록할 때가 됐는지. */
export function needsTouch(key: StoredApiKey, now = Date.now()) {
  return (
    !key.lastUsedAt || now - Date.parse(key.lastUsedAt) >= TOUCH_INTERVAL_MS
  );
}

/** 마지막 사용 시각을 기록한다. 잠금 안(`exclusive`)에서 부른다. */
export function touchApiKey(svc: FundService, id: string) {
  const key = svc.repository.apiKeys().find((k) => k.id === id);
  if (!key || !active(key) || !needsTouch(key)) return;
  key.lastUsedAt = new Date().toISOString();
  svc.repository.save();
}
