// v5 시연 데이터를 판매사 API로 만든다. 고객 C-0001:
//   진단 1회차 → 가입 중단 → 진단 2·3회차 → 관리자 승인 → 부적합 ELS 청약(추가 위험 확인·녹취)
//   → 숙려 전 최종 확인 거절 → 숙려 뒤 확정, 적합 ELB 청약·확정, 사후 변경 시도 거절, 독립 검증.
// 결과 파일은 --out(기본 .local/demo/v5)에 쓴다.
//
// 사용법: npm run demo -- [--api http://127.0.0.1:3001] [--rpc <검증·시간 이동 RPC>] [--out <디렉터리>]
// 대상 API가 쓰는 원장에 기록이 쌓인다. 실행 중인 시연 원장이 아니면 --api로 다른 API를 지정한다.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createTestClient, http } from "viem";
import { environment } from "./environment.ts";
import { verifySale } from "@finveric/core/verify";
import {
  DEMO_CUSTOMER_NO,
  DEMO_PRODUCTS,
  PROFILE_NAMES,
  json,
  type EvidenceReceipt,
  type OriginalBundle,
} from "@finveric/core";
import type {
  ConfigDto,
  CustomerDto,
  DiagnosisDto,
  RegisterDto,
  SaleDto,
  TamperResponse,
} from "@finveric/core/api";

const { values: options } = parseArgs({
  options: {
    api: { type: "string" },
    rpc: { type: "string" },
    out: { type: "string", default: ".local/demo/v5" },
  },
});
environment();
const base = options.api ?? process.env.API_URL ?? "http://127.0.0.1:3001";

class ApiError extends Error {}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(process.env.DEMO_TOKEN
        ? { Authorization: `Bearer ${process.env.DEMO_TOKEN}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) throw new ApiError(value.error);
  return value as T;
}

const { deployment, demoCustomer } = await request<ConfigDto>("/config");
if (deployment.ledgerVersion !== 5)
  throw new Error("판매 기록 원장 v5를 배포한 뒤 시연을 실행하세요.");
const dep = { ...deployment, rpcUrl: options.rpc ?? deployment.rpcUrl };
const customerNo = DEMO_CUSTOMER_NO;
console.log(`대상 API ${base} · 원장 ${dep.ledger} · 고객 ${customerNo}`);

console.log("진단 기준 v1과 시연 상품 3종을 등록합니다.");
await request<RegisterDto>("/register", {});
const [els, , elb] = DEMO_PRODUCTS;
const before = await request<CustomerDto>(`/customers/${customerNo}`);
if (before.diagnoses.length)
  console.log(
    `이미 진단 ${before.diagnoses.length}회 기록이 있어요. 회차가 이어집니다.`,
  );

// 위험중립형 → 적극투자형 → 공격투자형(위험 태도 "원금 20%까지"로 2등급까지만 권유).
const ANSWERS = [
  [2, 1, 1, 0, 1, 1],
  [2, 1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2, 1],
];
const diagnose = async (answers: number[]) => {
  const result = await request<DiagnosisDto>(
    `/customers/${customerNo}/diagnose`,
    { answers },
  );
  console.log(
    `진단 ${result.attempt}회차 · ${PROFILE_NAMES[result.profile]} · 권유 가능 ${result.limit}등급까지 · 블록 ${result.block}`,
  );
  return result;
};
const open = (productId: string) =>
  request<SaleDto>("/sales", { productId, customerNo });
const action = (id: string, name: string, body: object = {}) =>
  request<SaleDto>(`/sales/${id}/action/${name}`, body);

// 1. 진단 1회차 뒤 가입 중단. 회차는 원장에 남는다.
const first = await open(els.id);
await diagnose(ANSWERS[0]);
await action(first.id, "abandon");
console.log(`신청 ${first.id.slice(0, 12)}… 중단`);

// 2. 다시 시작해 두 번 더 진단. 3회차부터 관리자 승인이 필요하다.
const sale = await open(els.id);
await diagnose(ANSWERS[1]);
const third = await diagnose(ANSWERS[2]);
let state = await action(sale.id, "approve");
if (!state.approvalRequired || state.approvedAttempt !== third.attempt)
  throw new Error("관리자 승인을 확인할 수 없습니다.");

// 3. 부적합 ELS 청약: 추가 위험 확인, 녹취, 핵심 설명 카드 확인.
state = await action(sale.id, "subscribe", {
  explanationSeconds: 180,
  higherRiskConfirmed: true,
  recordingConsent: true,
});
if (state.status !== "subscribed" || state.suitable || !state.protectedSale)
  throw new Error("부적합·녹취 대상 청약 상태가 아닙니다.");
console.log(`ELS 청약 · 부적합 · 녹취·숙려 대상 · ${sale.id.slice(0, 12)}…`);

// 4. 숙려 중 최종 확인은 원장이 거절한다. 숙려 시간이 지나면 확정한다.
const early = await action(sale.id, "confirm").then(
  () => undefined,
  (error: unknown) => (error instanceof ApiError ? error.message : undefined),
);
if (!early?.includes("숙려"))
  throw new Error("숙려기간 전 최종 확인이 거절되지 않았습니다.");
console.log(`숙려 전 최종 확인 거절: ${early}`);
if (dep.chainId === 31337) {
  const anvil = createTestClient({
    mode: "anvil",
    transport: http(dep.rpcUrl),
  });
  await anvil.increaseTime({ seconds: dep.coolingPeriod });
  await anvil.mine({ blocks: 1 });
  console.log(`Anvil 시간을 ${dep.coolingPeriod}초 옮겼습니다.`);
} else {
  const wait = (state.coolingEndsAt! - Date.now() / 1000 + 15) * 1000;
  console.log(`숙려 ${Math.ceil(wait / 1000)}초를 기다립니다.`);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, wait)));
}
state = await action(sale.id, "confirm");
if (state.status !== "confirmed")
  throw new Error("ELS 가입이 확정되지 않았습니다.");
console.log("ELS 최종 확인 · 가입 확정");

// 5. 적합 ELB 청약과 확정. 같은 3회차라 승인이 다시 필요하다(판매 ID마다 서명).
const bond = await open(elb.id);
await action(bond.id, "approve");
state = await action(bond.id, "subscribe", {
  explanationSeconds: 95,
  higherRiskConfirmed: false,
  recordingConsent: false,
});
if (!state.suitable || state.protectedSale)
  throw new Error("ELB는 적합·비대상이어야 합니다.");
state = await action(bond.id, "confirm");
if (state.status !== "confirmed")
  throw new Error("ELB 가입이 확정되지 않았습니다.");
console.log(`ELB 청약·확정 · 적합 · ${bond.id.slice(0, 12)}…`);

// 6. 사후 변경 시도: 판매사가 2회차를 더 높은 투자성향으로 다시 쓰려 한다.
const tamper = await request<TamperResponse>("/demo/tamper", {
  customerNo,
  attempt: third.attempt - 1,
});
if (!tamper.rejected || tamper.error !== "InvalidAttempt")
  throw new Error("원장이 기록 변경을 거절하지 않았습니다.");
console.log(`기록 변경 시도 거절: ${tamper.error}`);

// 7. 판매사 API 없이 RPC로 독립 검증한다. 바꾼 설명서는 불일치, 없는 판매 ID는 기록 없음이다.
const out = options.out!;
const summary: Record<string, unknown> = {
  ledger: dep.ledger,
  customer: demoCustomer,
  tamper,
};
for (const [name, id] of [
  ["els", sale.id],
  ["elb", bond.id],
] as const) {
  const original = await request<OriginalBundle>(
    `/sales/${id}/export/original`,
  );
  const receipt = await request<EvidenceReceipt>(`/sales/${id}/export/receipt`);
  const result = await verifySale(dep, id, receipt, original);
  if (result.outcome !== "match")
    throw new Error(`독립 검증 실패 ${json(result.checks)}`);
  const modified = structuredClone(original);
  modified.productDocument.cards[0].text += ".";
  const tampered = await verifySale(dep, id, receipt, modified);
  if (tampered.outcome !== "mismatch") throw new Error("변경 탐지 실패");
  const directory = join(out, name);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [file, value] of Object.entries({
    original,
    receipt,
    modified,
    result,
    tampered,
  }))
    writeFileSync(join(directory, `${file}.json`), json(value), {
      mode: 0o600,
    });
  summary[name] = {
    saleId: id,
    outcome: result.outcome,
    modified: tampered.outcome,
  };
  console.log(`${name.toUpperCase()} 독립 검증 일치 · 바꾼 설명서 불일치`);
}
const missing = await verifySale(dep, "1");
if (missing.outcome !== "missing")
  throw new Error("없는 판매 ID를 구분하지 못했습니다.");
summary.missing = missing.outcome;
mkdirSync(out, { recursive: true, mode: 0o700 });
writeFileSync(join(out, "summary.json"), json(summary), { mode: 0o600 });
console.log(`고객 파일과 검증 결과를 ${out}/에 저장했습니다.`);
