// 해시와 직렬화의 공통 규칙. rules.ts, products.ts, index.ts가 함께 쓴다.
// 이 파일은 다른 core 파일을 import하지 않는다(순환 import 방지).
import { keccak256, stringToHex, toHex, type Hex } from "viem";

/** BN254 스칼라 필드. 회로의 모든 값은 이 범위 안이다. */
export const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * 키를 정렬한 JSON. 값이 undefined인 키는 JSON.stringify처럼 뺀다.
 * 진단 기준·상품 설명서의 지문과 원장에 등록하는 원문은 이 문자열이다.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`)
    .join(",")}}`;
}
export const hashObject = (value: unknown) =>
  keccak256(stringToHex(canonical(value)));
/** 값을 필드 원소(10진 문자열)로 줄인다. */
export const field = (value: string | bigint) =>
  (BigInt(value) % FIELD).toString();
/** 필드 원소를 0x 32바이트 hex로 쓴다. 기준 해시와 고객 가명 ID 표기에 쓴다. */
export const fieldHex = (value: bigint): Hex => toHex(value, { size: 32 });
/** bigint를 문자열로 바꾼 JSON. API 응답과 내려받는 파일에 쓴다. */
export const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
