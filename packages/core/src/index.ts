// core 공개 API: 진단 기준·상품·판정·해시·커밋먼트·증명 형식·원장 ABI·증빙 형식.
// 원장 읽기(ledger.ts)와 독립 검증(verify.ts)은 각 파일에서 직접 import한다.
import {
  concat,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { poseidon16 } from "poseidon-lite/poseidon16";
import { FIELD, fieldHex } from "./encoding.ts";
import {
  MAX_QUESTIONS,
  answersFit,
  ruleFields,
  ruleTextHash,
  type RuleDocument,
} from "./rules.ts";
import type { ProductDocument } from "./products.ts";

export * from "./encoding.ts";
export * from "./rules.ts";
export * from "./products.ts";
export * from "./abi.ts";
export * from "./signals.ts";

// ── 배포와 역할 ─────────────────────────────────────────────

/** 역할별 키. 원장은 deployer를 제외한 네 역할만 안다. */
export const ROLES = [
  "deployer",
  "seller",
  "approver",
  "customer",
  "infrastructure",
] as const;
export type Role = (typeof ROLES)[number];

/** 공개 검증 설정. `.local/deployment-<network>.json`과 `deploy/<network>/deployment.json`. */
export interface Deployment {
  ledgerVersion: 5;
  proofKeyHash: string;
  chainId: 31337 | 11155111;
  ledger: Address;
  verifier: Address;
  blockNumber: string;
  rpcUrl: string;
  /** 녹취·숙려 대상의 최소 경과 시간(초). 원장 생성자 값과 같다. */
  coolingPeriod: number;
  roles: Record<Role, Address>;
  verifierCodeHash: Hex;
  ledgerCodeHash: Hex;
}

// ── 고객 가명 ID ────────────────────────────────────────────

/** 시연 고객 번호. */
export const DEMO_CUSTOMER_NO = "C-0001";
export const CUSTOMER_NO_PATTERN = /^[A-Za-z0-9-]{1,32}$/;
/**
 * 고객 가명 ID = keccak256(판매사 비밀값 ‖ 고객 번호) mod FIELD. 0x 32바이트 hex.
 * 비밀값이 없으면 고객 번호에서 가명 ID를 다시 만들 수 없다.
 */
export function customerRefFor(secret: Hex, customerNo: string): Hex {
  if (!CUSTOMER_NO_PATTERN.test(customerNo))
    throw new Error(
      "고객 번호 형식이 맞지 않습니다. 영문, 숫자, 하이픈으로 32자 안에서 보내세요.",
    );
  return fieldHex(
    BigInt(keccak256(concat([secret, stringToHex(customerNo)]))) % FIELD,
  );
}
/** 비밀값을 따로 정하지 않으면 판매사 키에서 만든다. */
export const customerRefSecret = (sellerPrivateKey: Hex) =>
  keccak256(concat([sellerPrivateKey, stringToHex("finveric-customer-ref")]));

// ── 커밋먼트와 증명 ─────────────────────────────────────────

export type DiagnosisContext = {
  chainId: number;
  ledger: string;
  customerRef: Hex | bigint;
  attempt: number;
  ruleHash: Hex | bigint;
};

/** 답변을 회로의 10칸에 맞춘다. 쓰지 않는 문항의 답은 0이다. */
export const paddedAnswers = (answers: readonly number[]) =>
  Array.from({ length: MAX_QUESTIONS }, (_, q) => BigInt(answers[q] ?? 0));

/** 답변 커밋먼트 = Poseidon(답변 10개, 임의값, 체인 ID, 원장, 고객 가명 ID, 회차, 기준 해시). */
export function diagnosisCommitment(
  answers: readonly number[],
  salt: string | bigint,
  context: DiagnosisContext,
): bigint {
  return poseidon16([
    ...paddedAnswers(answers),
    BigInt(salt),
    BigInt(context.chainId),
    BigInt(context.ledger),
    BigInt(context.customerRef),
    BigInt(context.attempt),
    BigInt(context.ruleHash),
  ]);
}

/** snarkjs `groth16.fullProve`에 넣는 회로 입력. 이름과 순서는 suitability.circom과 같다. */
export function proofInput(
  rule: RuleDocument,
  answers: readonly number[],
  salt: string | bigint,
  context: DiagnosisContext,
) {
  if (!answersFit(rule, answers))
    throw new Error(
      "답변이 진단 기준의 선택지 범위를 벗어났습니다. 문항마다 기준의 선택지 하나를 고르세요.",
    );
  const fields = ruleFields(rule).map(String);
  const chunk = (q: number) => fields.slice(q * 16, q * 16 + 16);
  const option = (offset: number) =>
    Array.from({ length: MAX_QUESTIONS }, (_, q) =>
      Array.from({ length: 5 }, (_, o) => chunk(q)[1 + o * 3 + offset]),
    );
  const tail = chunk(10);
  return {
    answers: paddedAnswers(answers).map(String),
    salt: BigInt(salt).toString(),
    optionCount: Array.from({ length: MAX_QUESTIONS }, (_, q) => chunk(q)[0]),
    score: option(0),
    cap: option(1),
    elderly: option(2),
    threshold: tail.slice(0, 4),
    matrix: tail.slice(4, 9),
    textHash: ruleTextHash(rule).toString(),
    commitment: diagnosisCommitment(answers, salt, context).toString(),
    chainId: String(context.chainId),
    ledger: BigInt(context.ledger).toString(),
    customerRef: BigInt(context.customerRef).toString(),
    attempt: String(context.attempt),
    ruleHash: BigInt(context.ruleHash).toString(),
  };
}

/** 회로의 공개 신호 순서. */
export const PUBLIC_SIGNALS = [
  "profile",
  "limit",
  "elderly",
  "commitment",
  "chainId",
  "ledger",
  "customerRef",
  "attempt",
  "ruleHash",
] as const;

/** snarkjs 증명(JSON). */
export type Groth16Proof = {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
};
/** 원장 recordDiagnosis의 증명 인자 [a0, a1, b00, b01, b10, b11, c0, c1]. b는 Solidity 순서로 바꾼다. */
export type ProofWords = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
];
export function solidityProof({ pi_a, pi_b, pi_c }: Groth16Proof): ProofWords {
  return [
    pi_a[0],
    pi_a[1],
    pi_b[0][1],
    pi_b[0][0],
    pi_b[1][1],
    pi_b[1][0],
    pi_c[0],
    pi_c[1],
  ].map(BigInt) as unknown as ProofWords;
}
/** Verifier 호출 형식으로 나눈다. */
export const verifierArgs = (proof: ProofWords) =>
  [
    [proof[0], proof[1]],
    [
      [proof[2], proof[3]],
      [proof[4], proof[5]],
    ],
    [proof[6], proof[7]],
  ] as const;

// ── 승인과 녹취 ─────────────────────────────────────────────

const approvalParameters = parseAbiParameters(
  "string, uint256, address, uint256, uint256, uint32",
);
/**
 * 관리자 승인 원문의 해시. 승인자는 이 32바이트를 EIP-191(personal_sign)로 서명한다.
 * 판매 ID, 고객 가명 ID, 회차에 묶인다. 원장과 같은 식이다.
 */
export function approvalDigest(
  dep: Pick<Deployment, "chainId" | "ledger">,
  saleId: string | bigint,
  customerRef: Hex | bigint,
  attempt: number,
): Hex {
  return keccak256(
    encodeAbiParameters(approvalParameters, [
      "FINVERIC_APPROVAL_V5",
      BigInt(dep.chainId),
      dep.ledger,
      BigInt(saleId),
      BigInt(customerRef),
      attempt,
    ]),
  );
}
/** 녹취 지문 = keccak256(녹취록). 시연은 모의 녹취록을 쓴다. */
export const recordingHash = (text: string) => keccak256(stringToHex(text));

// ── 원장 상태 ───────────────────────────────────────────────

/** getSale의 status 값. */
export const SALE_STATUSES = [
  "none",
  "subscribed",
  "confirmed",
  "withdrawn",
] as const;
export type ChainSaleStatus = (typeof SALE_STATUSES)[number];
/** 원장 getSale 결과. */
export type ChainSale = {
  customerRef: bigint;
  productId: Hex;
  recordingHash: Hex;
  amount: bigint;
  productVersion: number;
  attempt: number;
  explanationSeconds: number;
  suitable: boolean;
  protectedSale: boolean;
  higherRiskConfirmed: boolean;
  approved: boolean;
  status: number;
  subscribedAt: bigint;
  confirmedAt: bigint;
  withdrawnAt: bigint;
  settledAt: bigint;
};
/** 원장 getDiagnosis 결과. */
export type ChainDiagnosis = {
  ruleHash: bigint;
  commitment: bigint;
  profile: number;
  limit: number;
  elderly: boolean;
  recordedAt: bigint;
};

// ── 처리 기록과 증빙 ────────────────────────────────────────

export interface Trace {
  id: string;
  at: string;
  source: string;
  action: string;
  status: "pending" | "confirmed" | "failed";
  saleId?: string;
  customerRef?: Hex;
  txHash?: Hex;
  blockNumber?: string;
  event?: string;
  detail?: unknown;
}
export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** 고객 증명서. 가입 기록 확인과 감독기관 조회가 원장과 대조한다. */
export type EvidenceReceipt = {
  format: "finveric-receipt-v5";
  saleId: string;
  chainId: number;
  ledger: Address;
  customerRef: Hex;
  productId: Hex;
  productVersion: number;
  documentHash: Hex;
  attempt: number;
  ruleHash: Hex;
  /** 원 단위 10진 문자열. */
  amount: string;
  subscribeTx: Hex;
  confirmTx?: Hex;
  issuedAt: string;
};
/** 모의 녹취록. 지문은 recordingHash(text)다. */
export type MockRecording = { name: string; text: string };
export type OriginalAttempt = {
  attempt: number;
  ruleHash: Hex;
  answers: number[];
  salt: string;
};
/** 고객과 판매사가 보관하는 원본 묶음. 청약 회차까지 모든 회차의 답변과 임의값을 담는다. */
export type OriginalBundle = {
  format: "finveric-original-v5";
  saleId: string;
  customerRef: Hex;
  attempts: OriginalAttempt[];
  productDocument: ProductDocument;
  recording?: MockRecording;
  explanationSeconds: number;
};
