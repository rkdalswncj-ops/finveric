// API 문서의 경로별 설명. 경로·경로 값·요청 본문은 Fastify에 등록한 경로에서 만든다.
// 여기에는 경로가 알 수 없는 값(operationId, 분류, 설명, 성공 응답, 요청 예시)만 둔다.
// 키는 `<METHOD> <Fastify 경로>`다. 경로를 추가하면 여기에도 추가한다. 빠지면 문서 생성이 실패한다.
import {
  DEMO_CUSTOMER_NO,
  DEMO_PRODUCTS,
  DEMO_RULE,
} from "@finveric/core";
import {
  apiKeySchema,
  configResponseSchema,
  customerSchema,
  diagnosisSchema,
  healthResponseSchema,
  issuedApiKeySchema,
  originalSchema,
  productEntrySchema,
  receiptSchema,
  registerResponseSchema,
  ruleEntrySchema,
  saleSchema,
  tamperResponseSchema,
  traceSchema,
  type DiagnoseRequest,
  type HealthResponse,
  type IssueApiKeyRequest,
  type OpenSaleRequest,
  type SubscribeRequest,
  type TamperRequest,
} from "@finveric/core/api";

export const TAGS = [
  {
    name: "판매 채널 연동",
    description:
      "증권사 앱이 고객 한 명의 진단과 가입을 처리할 때 부르는 API입니다. 설정·기준·상품 조회, 진단, 신청, 청약, 최종 확인, 철회, 증빙 내려받기가 있습니다.",
  },
  {
    name: "판매사 콘솔",
    description:
      "판매사 직원이 콘솔에서 쓰는 API입니다. 진단 기준과 상품 등록, 관리자 승인, 결제 기록, 판매 건과 처리 기록 조회가 있습니다.",
  },
  {
    name: "시스템",
    description: "상태 확인과 API 문서입니다.",
  },
] as const;
export type Tag = (typeof TAGS)[number]["name"];
/** API 키로 부를 수 있는 분류. 키의 범위(`channel`)와 같다. */
export const CHANNEL_TAG: Tag = "판매 채널 연동";

/** 성공 응답 하나. `schema`가 없으면 본문을 설명하지 않는다. */
export type SuccessResponse = {
  description: string;
  contentType?: string;
  schema?: object;
  /** 응답 예시. 없으면 문서 화면이 스키마에서 예시를 만든다. */
  example?: unknown;
};
export type Operation = {
  operationId: string;
  tag: Tag;
  summary: string;
  description: string;
  /** 성공(2xx)과 그 경로만의 응답. 공통 오류(400·401·403·409·429)는 문서 생성이 더한다. */
  responses: Record<number, SuccessResponse>;
  /** 업무 오류(409)가 없는 경로. */
  noConflict?: true;
  /** 요청 본문 예시. */
  example?: unknown;
};

const arrayOf = (items: object) => ({ type: "array", items });
const sale = (description: string) => ({
  200: { description, schema: saleSchema },
});
const [els] = DEMO_PRODUCTS;

/** 경로 값 예시. 이름이 같으면 모든 경로에 쓴다. */
export const PARAMETER_EXAMPLES: Record<string, string> = {
  id: "4271985206413397846153087021933850614795261143808975106625139452705981023416",
  customerNo: DEMO_CUSTOMER_NO,
  kind: "receipt",
};
/** API 키 ID 예시. 경로 이름이 `id`라서 판매 ID 예시와 따로 둔다. */
export const API_KEY_ID_EXAMPLE = "key_3f9a1c2b7d4e";

export const OPERATIONS: Record<string, Operation> = {
  // ── 판매 채널 연동 ─────────────────────────────────────────
  "GET /api/config": {
    operationId: "getConfig",
    tag: "판매 채널 연동",
    summary: "검증 설정 조회",
    description:
      "원장 주소, 체인 ID, 역할 주소, 숙려 시간 같은 공개 검증 설정을 돌려줍니다. 접근 코드 사용 여부(`requiresToken`)와 기본 고객 번호도 함께 돌려줍니다. 접근 코드 없이 부를 수 있습니다.",
    responses: {
      200: { description: "검증 설정", schema: configResponseSchema },
    },
    noConflict: true,
  },
  "GET /api/rules": {
    operationId: "listRules",
    tag: "판매 채널 연동",
    summary: "진단 기준 조회",
    description:
      "원장에 등록한 진단 기준을 버전 순서로 돌려줍니다. 마지막 항목이 최신 기준입니다. 앱은 최신 기준의 문항과 선택지로 진단 화면을 만듭니다. 등록한 기준이 없으면 기본 기준 v1을 `registered: false`로 돌려줍니다.",
    responses: {
      200: { description: "기준 버전 목록", schema: arrayOf(ruleEntrySchema) },
    },
  },
  "GET /api/products": {
    operationId: "listProducts",
    tag: "판매 채널 연동",
    summary: "상품 조회",
    description:
      "상품마다 모든 설명서 버전을 돌려줍니다. `latest: true`인 버전으로 청약합니다. 원장에 등록하지 않은 기본 상품은 `registered: false`로 함께 돌려줍니다.",
    responses: {
      200: {
        description: "상품 버전 목록",
        schema: arrayOf(productEntrySchema),
      },
    },
  },
  "GET /api/customers/:customerNo": {
    operationId: "getCustomer",
    tag: "판매 채널 연동",
    summary: "고객 진단 회차 조회",
    description:
      "고객 번호로 고객 가명 ID와 원장의 모든 진단 회차를 돌려줍니다. 고객 번호는 판매사 시스템의 번호입니다. 원장에는 가명 ID만 기록합니다.",
    responses: {
      200: { description: "고객 가명 ID와 진단 회차", schema: customerSchema },
    },
  },
  "POST /api/customers/:customerNo/diagnose": {
    operationId: "diagnoseCustomer",
    tag: "판매 채널 연동",
    summary: "투자성향 진단 기록",
    description:
      "최신 기준의 문항 순서대로 고른 선택지 번호(0부터)를 보냅니다. 서버가 영지식 증명을 만들고, 판매사 키로 다음 회차를 원장에 기록합니다. 원장에는 결과(투자성향, 권유 가능 등급, 고령 여부)와 커밋먼트만 남습니다. 답변과 임의값은 원본 묶음에만 보관합니다. 증명 생성 때문에 몇 초가 걸립니다.",
    responses: {
      200: { description: "기록한 진단 회차", schema: diagnosisSchema },
    },
    example: { answers: [2, 1, 1, 0, 1, 1] } satisfies DiagnoseRequest,
  },
  "POST /api/sales": {
    operationId: "openSale",
    tag: "판매 채널 연동",
    summary: "가입 신청",
    description:
      "고객과 상품으로 청약 전 신청(초안)을 만듭니다. 상품의 최신 설명서 버전을 씁니다. 원장 거래는 보내지 않습니다.",
    responses: sale("만든 판매 건(status: draft)"),
    example: {
      productId: els.id,
      customerNo: DEMO_CUSTOMER_NO,
    } satisfies OpenSaleRequest,
  },
  "GET /api/sales/:id": {
    operationId: "getSale",
    tag: "판매 채널 연동",
    summary: "판매 건 조회",
    description:
      "판매 건의 상태, 적합 여부, 승인 필요 여부, 처리 기록을 돌려줍니다. 청약 뒤의 상태는 원장에서 읽습니다.",
    responses: sale("판매 건"),
  },
  "POST /api/sales/:id/action/subscribe": {
    operationId: "subscribeSale",
    tag: "판매 채널 연동",
    summary: "청약",
    description:
      "고객 키로 청약 거래를 보냅니다. 부적합이면 `higherRiskConfirmed`가 true여야 합니다. 녹취·숙려 대상이면 `recordingConsent`가 true여야 하고, 서버가 녹취록 지문을 기록합니다. 최신 회차가 3 이상이면 관리자 승인(`approveSale`)이 먼저 필요합니다. 조건이 빠지면 409와 함께 `code`로 이유를 알립니다: `needs_diagnosis`, `needs_higher_risk`, `needs_approval`, `needs_recording`, `product_changed`, `wrong_state`(중단한 신청). 이미 청약한 건은 거래를 다시 보내지 않습니다.",
    responses: sale("청약한 판매 건(status: subscribed)"),
    example: {
      explanationSeconds: 180,
      higherRiskConfirmed: true,
      recordingConsent: true,
    } satisfies SubscribeRequest,
  },
  "POST /api/sales/:id/action/confirm": {
    operationId: "confirmSale",
    tag: "판매 채널 연동",
    summary: "최종 확인",
    description:
      "고객 키로 가입을 확정합니다. 녹취·숙려 대상은 `coolingEndsAt`이 지나야 합니다. 그전에는 원장이 `TooEarly`로 거절합니다. 이미 확정한 건은 거래를 다시 보내지 않습니다.",
    responses: sale("확정한 판매 건(status: confirmed)"),
  },
  "POST /api/sales/:id/action/withdraw": {
    operationId: "withdrawSale",
    tag: "판매 채널 연동",
    summary: "청약 철회",
    description: "최종 확인 전의 청약을 고객 키로 철회합니다.",
    responses: sale("철회한 판매 건(status: withdrawn)"),
  },
  "POST /api/sales/:id/action/abandon": {
    operationId: "abandonSale",
    tag: "판매 채널 연동",
    summary: "신청 중단",
    description:
      "청약 전 신청을 중단합니다. 원장 거래는 없습니다. 이미 기록한 진단 회차는 원장에 남습니다.",
    responses: sale("중단한 판매 건(status: abandoned)"),
  },
  "GET /api/sales/:id/export/:kind": {
    operationId: "exportSale",
    tag: "판매 채널 연동",
    summary: "고객 증빙 내려받기",
    description:
      "`receipt`는 고객 증명서이고, `original`은 답변·임의값·설명서·녹취록을 담은 원본 묶음입니다. 청약한 건만 받을 수 있습니다. 응답에는 파일 내려받기 헤더(`Content-Disposition`)가 붙습니다.",
    responses: {
      200: {
        description: "kind가 receipt면 고객 증명서, original이면 원본 묶음",
        schema: { oneOf: [receiptSchema, originalSchema] },
      },
    },
  },

  // ── 판매사 콘솔 ───────────────────────────────────────────
  "POST /api/rules": {
    operationId: "registerRule",
    tag: "판매사 콘솔",
    summary: "진단 기준 등록",
    description:
      "진단 기준을 검사하고 원장에 다음 버전으로 등록합니다. `version`은 서버가 다음 버전 번호로 바꿉니다. 응답의 원문과 해시가 등록한 값입니다.",
    responses: {
      200: { description: "등록한 기준 버전", schema: ruleEntrySchema },
    },
    example: { document: DEMO_RULE },
  },
  "POST /api/products": {
    operationId: "registerProduct",
    tag: "판매사 콘솔",
    summary: "상품 설명서 등록",
    description:
      "상품 설명서를 원장에 그 상품의 다음 버전으로 등록합니다. `version`은 서버가 정합니다. 이전 버전은 그대로 남습니다.",
    responses: {
      200: { description: "등록한 상품 버전", schema: productEntrySchema },
    },
    example: { document: els.document },
  },
  "POST /api/register": {
    operationId: "registerDefaults",
    tag: "판매사 콘솔",
    summary: "기본 기준·상품 등록",
    description:
      "기본 진단 기준 v1과 기본 상품 3종 가운데 원장에 없는 것만 등록합니다. 모두 있으면 거래를 보내지 않습니다.",
    responses: {
      200: {
        description: "등록 뒤의 기준과 상품 목록",
        schema: registerResponseSchema,
      },
    },
  },
  "GET /api/sales": {
    operationId: "listSales",
    tag: "판매사 콘솔",
    summary: "판매 건 목록 조회",
    description:
      "모든 판매 건을 돌려줍니다. 판매사 콘솔의 판매·검토 화면이 씁니다.",
    responses: {
      200: { description: "판매 건 목록", schema: arrayOf(saleSchema) },
    },
  },
  "POST /api/sales/:id/action/approve": {
    operationId: "approveSale",
    tag: "판매사 콘솔",
    summary: "관리자 승인",
    description:
      "최신 회차가 3 이상인 고객의 청약 전에 승인자 키로 승인 서명을 만듭니다. 서명은 청약 거래에 들어갑니다. 고객이 다시 진단하면 새로 승인해야 합니다.",
    responses: sale("승인한 판매 건(approvedAttempt 포함)"),
  },
  "POST /api/sales/:id/action/settle": {
    operationId: "settleSale",
    tag: "판매사 콘솔",
    summary: "결제 기록",
    description:
      "확정한 건의 결제 완료를 업무 인프라 키로 원장에 기록합니다. 이미 기록했으면 거래를 다시 보내지 않습니다.",
    responses: sale("결제를 기록한 판매 건(settled: true)"),
  },
  "GET /api/traces": {
    operationId: "listTraces",
    tag: "판매사 콘솔",
    summary: "처리 기록 조회",
    description:
      "증명 생성, 거래 제출, 영수증, 원장 거절 기록을 시간순으로 돌려줍니다. 대기 중인 거래는 먼저 영수증을 대조합니다.",
    responses: {
      200: { description: "처리 기록 목록", schema: arrayOf(traceSchema) },
    },
  },
  "GET /api/keys": {
    operationId: "listApiKeys",
    tag: "판매사 콘솔",
    summary: "API 키 목록",
    description:
      "발급한 API 키를 최근 발급 순서로 돌려줍니다. 폐기한 키도 기록으로 남습니다. 키 원문은 돌려주지 않습니다.",
    responses: {
      200: { description: "API 키 목록", schema: arrayOf(apiKeySchema) },
    },
    noConflict: true,
  },
  "POST /api/keys": {
    operationId: "issueApiKey",
    tag: "판매사 콘솔",
    summary: "API 키 발급",
    description:
      "증권사 앱 서버가 `판매 채널 연동` API를 부를 때 쓰는 키를 발급합니다. 키 원문(`key`)은 이 응답에만 한 번 나옵니다. 서버는 해시만 보관합니다. 사용 중인 키는 20개까지입니다. API 키로는 이 경로를 부를 수 없습니다.",
    responses: {
      200: { description: "발급한 키와 키 원문", schema: issuedApiKeySchema },
    },
    example: { name: "증권사 앱 운영 서버" } satisfies IssueApiKeyRequest,
  },
  "POST /api/keys/:id/revoke": {
    operationId: "revokeApiKey",
    tag: "판매사 콘솔",
    summary: "API 키 폐기",
    description:
      "키를 폐기합니다. 폐기한 키로 보낸 요청은 바로 401입니다. 이미 폐기한 키는 그대로 돌려줍니다.",
    responses: {
      200: { description: "폐기한 키", schema: apiKeySchema },
    },
  },
  "POST /api/demo/tamper": {
    operationId: "simulateTamper",
    tag: "판매사 콘솔",
    summary: "기록 변경 시도 시뮬레이션",
    description:
      "이미 기록한 진단 회차를 더 유리한 결과로 다시 쓰는 거래를 판매사 키로 시뮬레이션합니다. 거래는 보내지 않습니다. 원장은 `InvalidAttempt`로 거절합니다.",
    responses: {
      200: { description: "시뮬레이션 결과", schema: tamperResponseSchema },
    },
    example: { customerNo: DEMO_CUSTOMER_NO, attempt: 1 } satisfies TamperRequest,
  },

  // ── 시스템 ────────────────────────────────────────────────
  "GET /api/health": {
    operationId: "getHealth",
    tag: "시스템",
    summary: "상태 확인",
    description:
      "RPC 연결과 체인 ID, 원장 코드, 판매 기록 저장소를 점검합니다. 모두 정상이면 200, 하나라도 실패하면 503입니다. 접근 코드 없이 부를 수 있습니다.",
    responses: {
      200: { description: "모든 점검 통과", schema: healthResponseSchema },
      503: {
        description: "점검 항목 가운데 하나 이상 실패. 본문 형식은 200과 같습니다.",
        schema: healthResponseSchema,
        example: {
          ok: false,
          network: "local",
          chainId: 31337,
          ledger: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
          checks: {
            rpc: { ok: false, ms: 5001, error: "응답 시간이 초과되었습니다." },
            ledger: {
              ok: false,
              ms: 5001,
              error: "응답 시간이 초과되었습니다.",
            },
            store: { ok: true, ms: 2 },
          },
        } satisfies HealthResponse,
      },
    },
    noConflict: true,
  },
  "GET /api/openapi.json": {
    operationId: "getOpenApi",
    tag: "시스템",
    summary: "OpenAPI 문서",
    description:
      "이 API의 OpenAPI 3.1 문서입니다. 클라이언트 코드 생성 도구에 그대로 넣을 수 있습니다. 접근 코드 없이 부를 수 있습니다.",
    responses: {
      200: { description: "OpenAPI 3.1 문서", schema: { type: "object" } },
    },
    noConflict: true,
  },
  "GET /api/docs": {
    operationId: "getDocs",
    tag: "시스템",
    summary: "API 문서 화면",
    description:
      "OpenAPI 문서를 읽어 사람이 읽는 참조 화면을 보여 줍니다. 접근 코드 없이 열 수 있습니다.",
    responses: {
      200: {
        description: "HTML 화면",
        contentType: "text/html",
        schema: { type: "string" },
        example: '<!doctype html>\n<html lang="ko">\n…\n</html>',
      },
    },
    noConflict: true,
  },
};

/** 경로의 분류. API 키의 범위 검사에 쓴다. 문서에 없는 경로는 undefined다. */
export function tagOf(method: string, url: string): Tag | undefined {
  return OPERATIONS[`${method === "HEAD" ? "GET" : method} ${url}`]?.tag;
}
