// 판매사 API 계약(DTO). API(apps/api)와 웹(apps/web)이 이 파일만 기준으로 쓴다.
// 요청 DTO는 같은 자리에 JSON Schema를 둔다. 스키마의 속성 이름이 DTO 필드와 다르면 타입 검사가 실패한다.
import type { Hex } from "viem";
import type {
  Answers,
  ChainSale,
  Deployment,
  EvidenceReceipt,
  OriginalBundle,
  PreparedProof,
  Product,
  Trace,
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

// ── 요청 DTO와 스키마 ─────────────────────────────────────────

/** `/api/sales/:id/...`의 경로 값. 판매 ID는 BN254 필드 범위의 10진수다. */
export type SaleIdParams = { id: string };
export const saleIdParamsSchema = {
  type: "object",
  required: ["id"],
  properties: { id: SALE_ID },
} as const satisfies ObjectSchema<SaleIdParams>;

/** POST `/api/sales`. 상품을 고르지 않으면 기본 상품으로 신청한다. */
export type OpenSaleRequest = { productId?: Hex };

/** POST `/api/sales/:id/diagnose`. 진단 답변과 고객 쪽에서 만든 임의값. */
export type DiagnoseRequest = Answers & { salt: string };
export const diagnoseBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["loss", "experience", "salt"],
  properties: {
    loss: { type: "integer", minimum: 0, maximum: 2 },
    experience: { type: "integer", minimum: 0, maximum: 2 },
    salt: { type: "string", pattern: "^[1-9][0-9]{0,76}$" },
  },
} as const satisfies ObjectSchema<DiagnoseRequest>;

/** POST `/api/sales/:id/confirm`. 고객이 최종 확인한 진단 회차와 동의. */
export type ConfirmRequest = {
  round: number;
  commitment: string;
  profile: number;
  explanationAccepted: true;
  higherRiskAccepted: boolean;
};
export const confirmBodySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "round",
    "commitment",
    "profile",
    "explanationAccepted",
    "higherRiskAccepted",
  ],
  properties: {
    round: { type: "integer", minimum: 1, maximum: 10 },
    commitment: { type: "string", pattern: "^[1-9][0-9]{0,76}$" },
    profile: { type: "integer", minimum: 1, maximum: 3 },
    explanationAccepted: { const: true },
    higherRiskAccepted: { type: "boolean" },
  },
} as const satisfies ObjectSchema<ConfirmRequest>;

/** POST `/api/sales/:id/action/:action`. 중단은 고객, 검토(관리자 승인)는 판매사 관리자, 매입은 기존 인프라가 한다. */
export const SALE_ACTIONS = ["review", "abandon", "purchase"] as const;
export type SaleAction = (typeof SALE_ACTIONS)[number];
export type SaleActionParams = SaleIdParams & { action: SaleAction };
export const saleActionParamsSchema = {
  type: "object",
  required: ["id", "action"],
  properties: { id: SALE_ID, action: { enum: SALE_ACTIONS } },
} as const satisfies ObjectSchema<SaleActionParams>;

/** GET `/api/sales/:id/export/:kind`. 가입을 확정한 건의 고객 증빙. */
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

/** GET `/api/config`. 검증 설정과 상품 목록. */
export type ConfigResponse = {
  deployment: Deployment;
  product: Product["document"];
  products: readonly Product[];
  requiresToken: boolean;
};
export type ConfigDto = Wire<ConfigResponse>;

/** GET `/api/traces`. 증명 생성·거래 제출·영수증 기록. */
export type TraceDto = Wire<Trace>;

/** POST `/api/register`. 원장에 등록된 설명서 지문과 진단 규칙. */
export type RegisterResponse = { documentHash: Hex; ruleHash: Hex };

/** POST `/api/sales`. 새 임시 신청의 판매 ID. */
export type OpenSaleResponse = { id: string };

/** 판매 건 공개 조회. 답변·임의값·서명 거래 원문은 넣지 않는다. */
export type SaleView = {
  id: string;
  productId: Hex;
  amount: number;
  createdAt: string;
  traces: Trace[];
  submissionPending: boolean;
  attempts: {
    round: number;
    commitment: string;
    confirmed: boolean;
    profile?: number;
  }[];
  state: ChainSale;
};
export type SaleDto = Wire<SaleView>;

/** 진단 응답. 고객 화면이 확인 전에 검사할 증명을 함께 준다. */
export type DiagnoseView = SaleView & { preparedProof: PreparedProof };
export type DiagnoseDto = Wire<DiagnoseView>;

/** 가입 중단 응답. 임시 기록은 폐기된다. */
export type AbandonResponse = { id: string; abandoned: true };

/** 검토·매입은 갱신한 판매 건을, 중단은 폐기 결과를 돌려준다. */
export type SaleActionView = SaleView | AbandonResponse;
export type SaleActionDto = Wire<SaleActionView>;

/** 내보내기 종류별 응답. */
export type ExportResponse = {
  receipt: EvidenceReceipt;
  original: OriginalBundle;
};
