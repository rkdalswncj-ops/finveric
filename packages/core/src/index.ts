import {
  encodeAbiParameters,
  getAbiItem,
  keccak256,
  parseAbi,
  parseAbiParameters,
  stringToHex,
  type Address,
  type ContractFunctionArgs,
  type Hex,
} from "viem";
import { poseidon10 } from "poseidon-lite/poseidon10";

export const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const RULE_TEXT =
  "FINVERIC_RULE_V3:profile=1+[sum>=2]+[sum>=3];higher-risk-if-profile<registered-product-minimum;self-directed-confirmation";
export const RULE_HASH = keccak256(stringToHex(RULE_TEXT));
export const RULE_HASH_V2 = keccak256(
  stringToHex(
    "FINVERIC_RULE_V2:profile=1+[sum>=2]+[sum>=3];higher-risk-if-profile<3;self-directed-confirmation",
  ),
);
export const RULE_HASH_V1 = keccak256(
  stringToHex("FINVERIC_RULE_V1:loss[0,2]+experience[0,2]>=3;risk=1"),
);
export const MIN_PROFILE = 3;
export const PROFILE_NAMES: Readonly<Record<number, string>> = {
  1: "안정형",
  2: "균형형",
  3: "적극형",
};
export const PRODUCT_ID = keccak256(stringToHex("FUND-DEMO-001:Ce:v1"));
export const DOCUMENT = {
  product: "FUND-DEMO-001",
  name: "균형성장 글로벌 펀드",
  class: "온라인 Ce",
  version: "v1",
  manager: "데모자산운용",
  seller: "데모증권",
  risk: "3등급 · 다소 높은 위험",
  annualFee: "0.68%",
  strategy: "글로벌 주식 60%와 채권 40%에 분산 투자해요.",
  warning:
    "원금 손실 가능. 예금자보호 대상이 아니에요. 모든 상품과 기관은 시연용이에요.",
};
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}
export const hashObject = (value: unknown) =>
  keccak256(stringToHex(canonical(value)));
export const DOCUMENT_HASH = hashObject(DOCUMENT);

export type Product = {
  id: Hex;
  document: typeof DOCUMENT;
  documentHash: Hex;
  category: "주식혼합" | "채권" | "주식";
  minimumProfile: number;
};
function defineProduct(
  document: Product["document"],
  category: Product["category"],
  minimumProfile: number,
): Product {
  return {
    id: keccak256(stringToHex(`${document.product}:Ce:${document.version}`)),
    document,
    documentHash: hashObject(document),
    category,
    minimumProfile,
  };
}
export const PRODUCTS = [
  defineProduct(DOCUMENT, "주식혼합", MIN_PROFILE),
  defineProduct(
    {
      ...DOCUMENT,
      product: "FUND-DEMO-002",
      name: "단기채권 안정추구 펀드",
      risk: "5등급 · 낮은 위험",
      annualFee: "0.24%",
      strategy: "단기 우량채권을 중심으로 운용하는 가상 상품이에요.",
    },
    "채권",
    1,
  ),
  defineProduct(
    {
      ...DOCUMENT,
      product: "FUND-DEMO-003",
      name: "글로벌 혁신기업 펀드",
      risk: "2등급 · 높은 위험",
      annualFee: "0.92%",
      strategy: "글로벌 기술·성장 기업에 투자하는 가상 상품이에요.",
    },
    "주식",
    3,
  ),
] as const;
export const field = (value: string | bigint) =>
  (BigInt(value) % FIELD).toString();
export const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );

export interface Deployment {
  ruleVersion?: 2 | 3;
  ledgerVersion?: 3 | 4;
  proofKeyHash: string;
  chainId: 31337 | 11155111;
  ledger: Address;
  verifier: Address;
  blockNumber: string;
  rpcUrl: string;
  roles: Record<Role, Address>;
  verifierCodeHash: Hex;
  ledgerCodeHash: Hex;
}
export function deploymentRuleHash({
  ruleVersion,
}: Pick<Deployment, "ruleVersion">) {
  return ruleVersion === 3
    ? RULE_HASH
    : ruleVersion === 2
      ? RULE_HASH_V2
      : RULE_HASH_V1;
}
export type Role =
  | "deployer"
  | "manager"
  | "seller"
  | "compliance"
  | "customer"
  | "infrastructure";
export interface Answers {
  loss: number;
  experience: number;
}
export function classifyProfile({ loss, experience }: Answers): number {
  const score = loss + experience;
  return 1 + Number(score >= 2) + Number(score >= 3);
}
export function diagnosisCommitment(
  answers: Answers,
  salt: string,
  context: {
    chainId: number;
    ledger: string;
    id: string;
    round: number;
    ruleHash?: string;
    documentHash?: string;
  },
): bigint {
  return poseidon10([
    BigInt(answers.loss),
    BigInt(answers.experience),
    0n,
    BigInt(salt),
    BigInt(context.chainId),
    BigInt(context.ledger),
    BigInt(context.id),
    BigInt(context.round),
    BigInt(field(context.ruleHash ?? RULE_HASH)),
    BigInt(field(context.documentHash ?? DOCUMENT_HASH)),
  ]);
}
export interface Diagnosis {
  round: number;
  answers: Answers;
  salt: string;
  commitment: string;
  profile?: number;
  proof?: any;
  publicSignals?: string[];
  confirmed: boolean;
}
export interface Trace {
  id: string;
  at: string;
  source: string;
  action: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: Hex;
  blockNumber?: string;
  event?: string;
  detail?: unknown;
}
export interface SaleRecord {
  id: string;
  amount: number;
  createdAt: string;
  attempts: Diagnosis[];
  signature?: Hex;
  signatureMessage?: string;
  traces: Trace[];
}
export interface ChainSale {
  productId: Hex;
  documentHash: Hex;
  ruleHash: Hex;
  attempts: number;
  explained: boolean;
  signed: boolean;
  reviewed: boolean;
  finalized: boolean;
  purchaseState: number;
  amount: bigint;
  nav: bigint;
  units: bigint;
  pricedAt: bigint;
  signatureHash: Hex;
  higherRiskConfirmed: boolean;
}
export interface ChainAttempt {
  commitment: bigint;
  recorded: boolean;
  profile: number;
}
export interface EvidenceReceipt {
  format:
    | "finveric-receipt-v1"
    | "finveric-receipt-v2"
    | "finveric-receipt-v3"
    | "finveric-receipt-v4";
  saleId: string;
  chainId: number;
  ledger: Address;
  productId: Hex;
  documentHash: Hex;
  ruleHash: Hex;
  transactions: Hex[];
}
type Original = {
  saleId: string;
  document: typeof DOCUMENT;
};
type LegacySignature = {
  signature?: Hex;
  signatureMessage?: string;
};
export type OriginalBundle = Original &
  (
    | (LegacySignature & {
        format: "finveric-original-v1";
        attempts: {
          round: number;
          answers: Answers & { risk: number };
          salt: string;
        }[];
      })
    | (LegacySignature & {
        format: "finveric-original-v2";
        attempts: { round: number; answers: Answers; salt: string }[];
      })
    | {
        format: "finveric-original-v3" | "finveric-original-v4";
        attempts: { round: number; answers: Answers; salt: string }[];
      }
  );
export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const sharedLedgerAbi = [
  "function registerRule(bytes32 ruleHash)",
  "function requestMockPurchase(uint256 saleId)",
  "function awaitMockPurchase(uint256 saleId)",
  "function recordMockPurchase(uint256 saleId, uint256 amount, uint256 nav, uint256 pricedAt)",
  "function getSale(uint256 saleId) view returns (Sale)",
  "function getAttempt(uint256 saleId, uint32 attempt) view returns (Attempt)",
  "function documents(bytes32 productId) view returns (bytes32)",
  "function rules(bytes32 ruleHash) view returns (bool)",
  "event ProductRegistered(bytes32 indexed productId, bytes32 documentHash)",
  "event RuleRegistered(bytes32 indexed ruleHash)",
  "event SaleOpened(uint256 indexed saleId, bytes32 productId, bytes32 documentHash, bytes32 ruleHash)",
  "event AnswersCommitted(uint256 indexed saleId, uint32 indexed attempt, uint256 commitment)",
  "event ExplanationConfirmed(uint256 indexed saleId, uint32 attempt, bytes32 documentHash)",
  "event ReviewApproved(uint256 indexed saleId, uint32 attempt)",
  "event ConditionsVerified(uint256 indexed saleId, uint32 attempt)",
  "event MockPurchaseUpdated(uint256 indexed saleId, uint8 state, uint256 amount, uint256 nav, uint256 units, uint256 pricedAt)",
  "error Unauthorized()",
  "error InvalidVersion()",
  "error InvalidState()",
  "error InvalidProof()",
  "error MissingRecords()",
] as const;
const legacyProductRegistration =
  "function registerProduct(bytes32 productId, bytes32 documentHash)" as const;
const preAtomicLedgerAbi = [
  "function openSale(uint256 saleId, bytes32 productId, bytes32 documentHash, bytes32 ruleHash)",
  "function commitAnswers(uint256 saleId, uint32 attempt, uint256 commitment)",
  "function recordDiagnosis(uint256 saleId, uint32 attempt, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[8] signals)",
  "function confirmExplanation(uint256 saleId, uint32 attempt, bytes32 documentHash)",
  "function confirmMockSignature(uint256 saleId, uint32 attempt, uint256 commitment, bytes32 signatureHash)",
  "function approveReview(uint256 saleId, uint32 attempt)",
  "function finalize(uint256 saleId)",
  "event MockSignatureConfirmed(uint256 indexed saleId, uint32 attempt, uint256 commitment, bytes32 signatureHash)",
] as const;
const saleFields =
  "bytes32 productId; bytes32 documentHash; bytes32 ruleHash; uint32 attempts; bool explained; bool signed; bool reviewed; bool finalized; uint8 purchaseState; uint256 amount; uint256 nav; uint256 units; uint256 pricedAt; bytes32 signatureHash;" as const;
const profileLedgerAbi = [
  `struct Sale { ${saleFields} bool higherRiskConfirmed; }`,
  "struct Attempt { uint256 commitment; bool recorded; uint8 profile; }",
  "event DiagnosisRecorded(uint256 indexed saleId, uint32 indexed attempt, uint256 commitment, uint8 profile)",
  "event HigherRiskConfirmed(uint256 indexed saleId, uint32 attempt)",
] as const;
const atomicLedgerAbi = [
  ...profileLedgerAbi,
  ...sharedLedgerAbi,
  "struct DiagnosisProof { uint256[2] a; uint256[2][2] b; uint256[2] c; uint256[8] signals; }",
  "function completeEnrollment(uint256 saleId, bytes32 productId, bytes32 documentHash, bytes32 ruleHash, DiagnosisProof[] proofs, bool explanationAccepted, bool higherRiskAccepted, bytes reviewSignature)",
  "event EnrollmentAuthorized(uint256 indexed saleId, uint32 attempt, address customer)",
] as const;
export const ledgerAbi = parseAbi([
  ...atomicLedgerAbi,
  "function registerProduct(bytes32 productId, bytes32 documentHash, uint8 minimumProfile)",
  "function minimumProfiles(bytes32 productId) view returns (uint8)",
]);
export const ledgerAbiV3 = parseAbi([
  ...atomicLedgerAbi,
  legacyProductRegistration,
]);
export const ledgerAbiV2 = parseAbi([
  ...profileLedgerAbi,
  ...sharedLedgerAbi,
  ...preAtomicLedgerAbi,
  legacyProductRegistration,
  "function confirmHigherRisk(uint256 saleId, uint32 attempt)",
]);
export const legacyLedgerAbi = parseAbi([
  `struct Sale { ${saleFields} }`,
  "struct Attempt { uint256 commitment; bool recorded; bool passed; }",
  ...sharedLedgerAbi,
  ...preAtomicLedgerAbi,
  legacyProductRegistration,
  "event DiagnosisRecorded(uint256 indexed saleId, uint32 indexed attempt, uint256 commitment, bool passed)",
]);
export const verifierAbi = parseAbi([
  "function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[8] signals) view returns (bool)",
]);
export type SolidityProof = ContractFunctionArgs<
  typeof verifierAbi,
  "view",
  "verifyProof"
>;
export type PreparedProof = {
  a: SolidityProof[0];
  b: SolidityProof[1];
  c: SolidityProof[2];
  signals: SolidityProof[3];
};

const proofsParameter = getAbiItem({
  abi: ledgerAbi,
  name: "completeEnrollment",
}).inputs[4];
const reviewDomain = keccak256(stringToHex("FINVERIC_V3_REVIEW"));
const reviewParameters = parseAbiParameters(
  "bytes32, uint256, address, uint256, bytes32, bytes32, bytes32, bytes32",
);
export function reviewDigest(
  dep: Pick<Deployment, "chainId" | "ledger" | "ruleVersion" | "ledgerVersion">,
  saleId: string,
  proofs: readonly PreparedProof[],
  product?: Product,
): Hex {
  if (dep.ledgerVersion === 4 && !product)
    throw new Error("검토할 상품을 지정해 주세요.");
  const selected = product ?? PRODUCTS[0];
  const proofsHash = keccak256(
    encodeAbiParameters([proofsParameter], [proofs]),
  );
  return keccak256(
    encodeAbiParameters(reviewParameters, [
      reviewDomain,
      BigInt(dep.chainId),
      dep.ledger,
      BigInt(saleId),
      selected.id,
      selected.documentHash,
      dep.ledgerVersion === 4 ? RULE_HASH : RULE_HASH_V2,
      proofsHash,
    ]),
  );
}

function signatureFields(
  deployment: Deployment,
  id: string,
  round: number,
  commitment: string,
) {
  return {
    purpose: "FINVERIC_MOCK_SIGNATURE",
    chainId: deployment.chainId,
    ledger: deployment.ledger.toLowerCase(),
    saleId: id,
    round,
    commitment,
    documentHash: DOCUMENT_HASH,
  };
}
export function legacySignatureMessage(
  deployment: Deployment,
  id: string,
  round: number,
  commitment: string,
) {
  return canonical(signatureFields(deployment, id, round, commitment));
}
export function signatureMessage(
  deployment: Deployment,
  id: string,
  round: number,
  commitment: string,
  profile: number,
) {
  return canonical({
    ...signatureFields(deployment, id, round, commitment),
    ruleHash: RULE_HASH_V2,
    profile,
    higherRiskConfirmed: profile < MIN_PROFILE,
  });
}
