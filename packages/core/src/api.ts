// 판매사 API 계약(DTO). API(apps/api)와 웹(apps/web)이 이 파일만 기준으로 쓴다.
// 요청 DTO는 같은 자리에 JSON Schema를 둔다. 스키마의 속성 이름이 DTO 필드와 다르면 타입 검사가 실패한다.
import type { Hex } from "viem";
import {
  CATEGORIES,
  PRODUCT_TYPES,
  type ChainSale,
  type Deployment,
  type EvidenceReceipt,
  type LedgerError,
  type OriginalBundle,
  type Product,
  type ProductDocument,
  type RuleDocument,
  type Trace,
} from "./index.ts";

/** API는 bigint를 문자열로 보낸다(`json()`). 응답 DTO는 이 변환을 거친 모양이다. */
export type Wire<T> = T extends bigint
  ? string
  : T extends object
    ? { [Key in keyof T]: Wire<T[Key]> }
    : T;

type Keys<T> = Extract<keyof T, string>;
/** 요청 스키마. `properties`에 DTO의 모든 필드가 있어야 하고 다른 필드는 없어야 한다. */
type ObjectSchema<T> = {
  type: "object";
  additionalProperties?: false;
  required: readonly Keys<T>[];
  properties: { [Key in Keys<T>]-?: object };
};

const SALE_ID = { type: "string", pattern: "^[1-9][0-9]{0,76}$" } as const;
const CUSTOMER_NO = {
  type: "string",
  pattern: "^[A-Za-z0-9-]{1,32}$",
} as const;
const BYTES32 = { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" } as const;
const text = (maxLength: number) =>
  ({ type: "string", minLength: 1, maxLength }) as const;

// ── 요청 DTO와 스키마 ─────────────────────────────────────────

/** `/api/sales/:id/...`의 경로 값. 판매 ID는 BN254 필드 범위의 10진수다. */
export type SaleIdParams = { id: string };
export const saleIdParamsSchema = {
  type: "object",
  required: ["id"],
  properties: { id: SALE_ID },
} as const satisfies ObjectSchema<SaleIdParams>;

/** `/api/customers/:customerNo/...`의 경로 값. 고객 번호는 판매사 시스템의 번호다(시연 C-0001). */
export type CustomerParams = { customerNo: string };
export const customerParamsSchema = {
  type: "object",
  required: ["customerNo"],
  properties: { customerNo: CUSTOMER_NO },
} as const satisfies ObjectSchema<CustomerParams>;

const ruleChoiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "score"],
  properties: {
    text: text(500),
    score: { type: "integer", minimum: 0, maximum: 15 },
    cap: { type: "integer", minimum: 1, maximum: 6 },
    elderly: { type: "boolean" },
  },
} as const satisfies ObjectSchema<
  RuleDocument["questions"][number]["choices"][number]
>;
const ruleQuestionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "title", "choices"],
  properties: {
    category: { enum: CATEGORIES },
    title: text(500),
    choices: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: ruleChoiceSchema,
    },
  },
} as const satisfies ObjectSchema<RuleDocument["questions"][number]>;
export const ruleDocumentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["format", "version", "name", "questions", "thresholds", "matrix"],
  properties: {
    format: { const: "finveric-rule-v5" },
    version: { type: "integer", minimum: 1, maximum: 4294967295 },
    name: text(100),
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: ruleQuestionSchema,
    },
    thresholds: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "integer", minimum: 0, maximum: 255 },
    },
    matrix: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "integer", minimum: 1, maximum: 6 },
    },
  },
} as const satisfies ObjectSchema<RuleDocument>;

/**
 * POST `/api/rules`. 진단 기준을 검사하고 원장에 다음 버전으로 등록한다.
 * `version`은 API가 다음 버전 번호로 정한다. 응답의 원문과 해시가 등록한 값이다.
 */
export type RegisterRuleRequest = { document: RuleDocument };
export const registerRuleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["document"],
  properties: { document: ruleDocumentSchema },
} as const satisfies ObjectSchema<RegisterRuleRequest>;

export const productDocumentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "format",
    "code",
    "version",
    "name",
    "type",
    "issuer",
    "seller",
    "riskGrade",
    "complex",
    "derivative",
    "targetMarket",
    "maxLoss",
    "fee",
    "summary",
    "cards",
  ],
  properties: {
    format: { const: "finveric-product-v5" },
    code: { type: "string", pattern: "^[A-Z0-9][A-Z0-9-]{1,39}$" },
    version: { type: "integer", minimum: 1, maximum: 4294967295 },
    name: text(500),
    type: { enum: PRODUCT_TYPES },
    issuer: text(500),
    seller: text(500),
    riskGrade: { type: "integer", minimum: 1, maximum: 6 },
    complex: { type: "boolean" },
    derivative: { type: "boolean" },
    targetMarket: text(500),
    maxLoss: text(500),
    fee: text(500),
    summary: text(500),
    cards: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text"],
        properties: { title: text(100), text: text(1000) },
      },
    },
  },
} as const satisfies ObjectSchema<ProductDocument>;

/**
 * POST `/api/products`. 상품 설명서를 원장에 새 버전으로 등록한다.
 * `version`은 API가 그 상품의 다음 버전 번호로 정한다.
 */
export type RegisterProductRequest = { document: ProductDocument };
export const registerProductBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["document"],
  properties: { document: productDocumentSchema },
} as const satisfies ObjectSchema<RegisterProductRequest>;

/** POST `/api/customers/:customerNo/diagnose`. 최신 등록 기준의 문항 순서대로 고른 선택지 번호(0부터). */
export type DiagnoseRequest = { answers: number[] };
export const diagnoseBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "integer", minimum: 0, maximum: 4 },
    },
  },
} as const satisfies ObjectSchema<DiagnoseRequest>;

/** POST `/api/sales`. 고객과 상품으로 청약 전 신청(초안)을 만든다. 원장 거래는 없다. */
export type OpenSaleRequest = { productId: Hex; customerNo: string };
export const openSaleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["productId", "customerNo"],
  properties: { productId: BYTES32, customerNo: CUSTOMER_NO },
} as const satisfies ObjectSchema<OpenSaleRequest>;

/**
 * POST `/api/sales/:id/action/subscribe`. 고객 키로 청약 거래를 보낸다.
 * 녹취 대상이면 모의 녹취록을 만들고 지문을 기록한다. 녹취에 동의하지 않으면 거절한다.
 */
export type SubscribeRequest = {
  explanationSeconds: number;
  higherRiskConfirmed: boolean;
  recordingConsent: boolean;
};
export const subscribeBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["explanationSeconds", "higherRiskConfirmed", "recordingConsent"],
  properties: {
    explanationSeconds: { type: "integer", minimum: 1, maximum: 86400 },
    higherRiskConfirmed: { type: "boolean" },
    recordingConsent: { type: "boolean" },
  },
} as const satisfies ObjectSchema<SubscribeRequest>;

/**
 * POST `/api/sales/:id/action/:action`. 본문은 없다.
 * approve: 승인자 서명(3회차 이상) · abandon: 초안 중단 · confirm·withdraw: 고객 키 · settle: 인프라 키.
 */
export const SALE_ACTIONS = [
  "approve",
  "abandon",
  "confirm",
  "withdraw",
  "settle",
] as const;
export type SaleAction = (typeof SALE_ACTIONS)[number];
export type SaleActionParams = SaleIdParams & { action: SaleAction };
export const saleActionParamsSchema = {
  type: "object",
  required: ["id", "action"],
  properties: { id: SALE_ID, action: { enum: SALE_ACTIONS } },
} as const satisfies ObjectSchema<SaleActionParams>;

/** POST `/api/demo/tamper`. 이미 기록한 회차를 다시 쓰는 거래를 시뮬레이션한다. 거래는 보내지 않는다. */
export type TamperRequest = { customerNo: string; attempt: number };
export const tamperBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["customerNo", "attempt"],
  properties: {
    customerNo: CUSTOMER_NO,
    attempt: { type: "integer", minimum: 1, maximum: 4294967295 },
  },
} as const satisfies ObjectSchema<TamperRequest>;

/** GET `/api/sales/:id/export/:kind`. 청약한 건의 고객 증빙. 증명서의 confirmTx는 확정 뒤에 들어간다. */
export const EXPORT_KINDS = ["receipt", "original"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export type ExportParams = SaleIdParams & { kind: ExportKind };
export const exportParamsSchema = {
  type: "object",
  required: ["id", "kind"],
  properties: { id: SALE_ID, kind: { enum: EXPORT_KINDS } },
} as const satisfies ObjectSchema<ExportParams>;

// ── 응답 DTO ─────────────────────────────────────────────────
// `...View`는 서버가 만드는 값(bigint 포함), `...Dto`는 웹이 받는 값이다.

/** 의존성 하나의 점검 결과. 실패 이유는 우리가 쓴 문장만 담는다. */
export type HealthCheck = { ok: boolean; ms: number; error?: string };

/**
 * GET `/api/health`. RPC 연결과 체인 ID, 원장 코드, 판매 기록 저장소를 점검한다.
 * 모두 정상이면 200, 하나라도 실패하면 503이다. 접근 코드 없이 열린다.
 */
export type HealthResponse = {
  ok: boolean;
  network: string;
  chainId: number;
  ledger: Hex;
  checks: { rpc: HealthCheck; ledger: HealthCheck; store: HealthCheck };
};

/** GET `/api/config`. 검증 설정과 시연 고객. 접근 코드 없이 열린다. */
export type ConfigResponse = {
  deployment: Deployment;
  requiresToken: boolean;
  demoCustomer: { number: string; ref: Hex };
};
export type ConfigDto = Wire<ConfigResponse>;

/** GET `/api/traces`. 증명 생성·거래 제출·영수증·원장 거절 기록. */
export type TraceDto = Wire<Trace>;

/**
 * 진단 기준 버전 하나. GET `/api/rules`는 등록한 버전을 버전 순서로 준다.
 * 아직 아무 기준도 없으면 시연 기준 v1을 `registered: false`로 함께 준다.
 */
export type RuleEntry = {
  document: RuleDocument;
  hash: Hex;
  version: number;
  registered: boolean;
  txHash?: Hex;
};
export type RuleEntryDto = Wire<RuleEntry>;

/**
 * 상품 버전 하나. GET `/api/products`는 상품마다 모든 등록 버전을 준다. `latest`가 청약에 쓰는 버전이다.
 * 등록하지 않은 시연 상품은 `registered: false`로 함께 준다.
 */
export type ProductEntry = {
  product: Product;
  registered: boolean;
  latest: boolean;
  txHash?: Hex;
};
export type ProductEntryDto = Wire<ProductEntry>;

/** POST `/api/register`. 시연 기준과 시연 상품을 없을 때만 등록한다. 등록 뒤 목록을 준다. */
export type RegisterResponse = { rules: RuleEntry[]; products: ProductEntry[] };
export type RegisterDto = Wire<RegisterResponse>;

/** 진단 회차 하나. 값은 원장에서 읽는다. `at`은 블록 시각(초)이다. 답변·임의값·총점은 넣지 않는다. */
export type DiagnosisView = {
  attempt: number;
  ruleHash: Hex;
  commitment: bigint;
  profile: number;
  limit: number;
  elderly: boolean;
  at: number;
  txHash?: Hex;
  block?: bigint;
};
export type DiagnosisDto = Wire<DiagnosisView>;

/** GET `/api/customers/:customerNo`. 고객 가명 ID와 모든 진단 회차. */
export type CustomerView = {
  number: string;
  ref: Hex;
  diagnoses: DiagnosisView[];
};
export type CustomerDto = Wire<CustomerView>;

/** 판매 건 상태. draft·abandoned는 원장 밖의 초안, 나머지는 원장 상태다. */
export const SALE_VIEW_STATUSES = [
  "draft",
  "abandoned",
  "subscribed",
  "confirmed",
  "withdrawn",
] as const;
export type SaleStatus = (typeof SALE_VIEW_STATUSES)[number];
/** 판매 건 상태 문구. 청약 상태에서 `coolingEndsAt`이 남아 있으면 화면은 "숙려 중"으로 보여 준다. */
export const SALE_STATUS_LABELS: Readonly<Record<SaleStatus, string>> = {
  draft: "신청",
  abandoned: "중단",
  subscribed: "청약",
  confirmed: "확정",
  withdrawn: "철회",
};

/** 판매 건. 고객 번호·답변·임의값·서명 원문은 넣지 않는다. */
export type SaleView = {
  id: string;
  customerRef: Hex;
  productId: Hex;
  productVersion: number;
  amount: number;
  createdAt: string;
  status: SaleStatus;
  /** 이 고객의 원장 최신 회차. 0이면 진단 전이다. */
  latestAttempt: number;
  /** 최신 회차가 3 이상이면 청약에 관리자 승인이 필요하다. */
  approvalRequired: boolean;
  /** 승인 서명을 만든 회차. 최신 회차와 같아야 청약할 수 있다. */
  approvedAttempt?: number;
  /** 청약 전에는 최신 회차로 계산한 예상 값, 청약 뒤에는 원장 값. 진단 전이면 없다. */
  suitable?: boolean;
  protectedSale?: boolean;
  /** 녹취·숙려 대상을 청약했으면 최종 확인이 가능한 시각(초). */
  coolingEndsAt?: number;
  settled: boolean;
  /** 원장 getSale 결과. 청약 뒤에만 있다. */
  chain?: ChainSale;
  /** 제출했지만 영수증을 아직 확인하지 않은 거래가 있다. */
  submissionPending: boolean;
  traces: Trace[];
};
export type SaleDto = Wire<SaleView>;

/** POST `/api/demo/tamper`의 결과. 원장이 거절하면 `rejected: true`와 오류 이름을 준다. */
export type TamperResponse = {
  rejected: boolean;
  error?: LedgerError;
  reason: string;
  customerRef: Hex;
  attempt: number;
};

/** 내보내기 종류별 응답. */
export type ExportResponse = {
  receipt: EvidenceReceipt;
  original: OriginalBundle;
};
