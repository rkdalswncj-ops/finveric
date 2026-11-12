import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { randomField } from "../apps/api/src/gateways/proofs.ts";
import { environment } from "./environment.ts";
import { verifyEvidence } from "../packages/core/src/verify.ts";
import {
  json,
  ledgerAbi,
  PROFILE_NAMES,
  PRODUCTS,
  type OriginalBundle,
  type EvidenceReceipt,
  type Deployment,
} from "../packages/core/src/index.ts";

environment();
const base = process.env.API_URL ?? "http://127.0.0.1:3001";
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.DEMO_TOKEN
        ? { Authorization: `Bearer ${process.env.DEMO_TOKEN}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value as T;
}
const { deployment } = await request<{ deployment: Deployment }>("/config");
if (deployment.ledgerVersion !== 4 || deployment.ruleVersion !== 3)
  throw new Error("상품별 가입 원장 v4를 배포한 뒤 시연을 실행하세요.");
const client = createPublicClient({ transport: http(deployment.rpcUrl) });
console.log("세 상품과 설명서, 진단 규칙 v3을 등록합니다.");
await request("/register", {});

const [balanced, bond, innovation] = PRODUCTS;
const cases = [
  {
    product: balanced,
    directory: ".local/demo/v4",
    answers: [
      { loss: 0, experience: 1 },
      { loss: 1, experience: 2 },
      { loss: 1, experience: 1 },
    ],
  },
  {
    product: bond,
    directory: ".local/demo/v4/bond",
    answers: [{ loss: 0, experience: 0 }],
  },
  {
    product: innovation,
    directory: ".local/demo/v4/innovation",
    answers: [{ loss: 0, experience: 0 }],
  },
];
type Attempt = { round: number; commitment: string; profile: number };

for (const { product, directory, answers } of cases) {
  const { id } = await request<{ id: string }>("/sales", {
    productId: product.id,
  });
  console.log(`${product.document.name} · 가입 신청 번호 ${id}`);

  let last: Attempt | undefined;
  for (const answer of answers) {
    const draft = await request<{ productId: string; attempts: Attempt[] }>(
      `/sales/${id}/diagnose`,
      {
        ...answer,
        salt: randomField(),
      },
    );
    last = draft.attempts.at(-1);
    if (draft.productId !== product.id || !last || !PROFILE_NAMES[last.profile])
      throw new Error("선택한 상품의 투자성향이 계산되지 않았습니다.");
    console.log(
      `진단 ${last.round}회차 · ${PROFILE_NAMES[last.profile]} · 임시 저장`,
    );
  }
  if (!last) throw new Error("진단 결과가 없습니다.");
  if (last.round >= 3) await request(`/sales/${id}/action/review`, {});
  const draft = await client.readContract({
    address: deployment.ledger,
    abi: ledgerAbi,
    functionName: "getSale",
    args: [BigInt(id)],
  });
  if (draft.attempts !== 0 || draft.finalized)
    throw new Error("가입 확정 전에 원장 기록이 생겼습니다.");
  console.log("가입 거래를 제출하기 전까지 원장 기록은 없습니다.");

  const higherRiskAccepted = last.profile < product.minimumProfile;
  const completed = await request<{
    productId: string;
    state: {
      finalized: boolean;
      higherRiskConfirmed: boolean;
      purchaseState: number;
    };
  }>(`/sales/${id}/confirm`, {
    round: last.round,
    commitment: last.commitment,
    profile: last.profile,
    explanationAccepted: true,
    higherRiskAccepted,
  });
  if (
    completed.productId !== product.id ||
    !completed.state.finalized ||
    completed.state.higherRiskConfirmed !== higherRiskAccepted ||
    completed.state.purchaseState !== 0
  )
    throw new Error("선택한 상품의 가입 확정 상태를 확인할 수 없습니다.");

  const original = await request<OriginalBundle>(
    `/sales/${id}/export/original`,
  );
  const receipt = await request<EvidenceReceipt>(`/sales/${id}/export/receipt`);
  if (
    receipt.productId !== product.id ||
    receipt.documentHash !== product.documentHash ||
    receipt.transactions.length !== 1
  )
    throw new Error("선택한 상품의 가입 확정 거래가 한 건이어야 합니다.");
  const [txHash] = receipt.transactions;
  const result = await verifyEvidence(deployment, id, receipt, original);
  if (!result.checks.every((check) => check.ok))
    throw new Error("독립 검증 실패 " + json(result.checks));
  const expectedKinds = higherRiskAccepted
    ? ["higher-risk", "signature", "completion"]
    : ["signature", "completion"];
  for (const kind of expectedKinds) {
    const reference = result.procedureReferences.find(
      (entry) => entry.kind === kind,
    );
    if (reference?.txHash !== txHash)
      throw new Error(`가입 절차가 확정 거래에 포함되지 않았습니다. ${kind}`);
  }
  console.log(
    `RPC 독립 검증 통과 · 블록 ${result.procedureReferences[0].block} · ${txHash}`,
  );
  const modified = structuredClone(original);
  modified.attempts[0].answers.loss = 2;
  const tampered = await verifyEvidence(deployment, id, receipt, modified);
  if (tampered.checks.find((check) => check.name === "고객 원본 무결성")?.ok)
    throw new Error("변경 탐지 실패");
  console.log("변경한 사본에서 원본 불일치를 확인했습니다.");

  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const [name, value] of Object.entries({
    original,
    receipt,
    modified,
    result,
  }))
    writeFileSync(`${directory}/${name}.json`, json(value), { mode: 0o600 });
  console.log(`고객 파일과 검증 결과를 ${directory}/에 저장했습니다.`);
}
