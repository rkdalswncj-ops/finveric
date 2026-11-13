// API 문서: @fastify/swagger 설정. 등록한 경로에서 OpenAPI 3.1 문서를 만든다.
// 경로·경로 값·요청 본문은 경로의 스키마(packages/core/src/api.ts)에서 온다.
// 설명·분류·성공 응답은 operations.ts에서, 인증·오류·공통 설명은 이 파일에서 더한다.
// 응답 스키마는 문서에만 넣는다. 경로의 schema.response에 넣으면 직렬화에 쓰여 필드가 빠진다.
import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import {
  ERROR_CODES,
  errorResponseSchema,
  type ErrorResponse,
} from "../../../../packages/core/src/api.ts";
import { LEDGER_ERRORS } from "../../../../packages/core/src/index.ts";
import { HTTP_ERRORS, ledgerRejectionMessage } from "../errors.ts";
import {
  API_KEY_ID_EXAMPLE,
  CHANNEL_TAG,
  OPERATIONS,
  PARAMETER_EXAMPLES,
  TAGS,
  type Operation,
} from "./operations.ts";

/** Fastify 경로(`/api/sales/:id`)의 문서 설명. 없으면 문서를 만들지 않는다. */
export function operationFor(method: string, url: string): Operation {
  const operation = OPERATIONS[`${method} ${url}`];
  if (!operation)
    throw new Error(
      `API 문서에 없는 경로입니다: ${method} ${url}. apps/api/src/docs/operations.ts에 추가하세요.`,
    );
  return operation;
}

const PARAMETER_DESCRIPTIONS: Record<string, string> = {
  id: "판매 ID(10진수)",
  customerNo: "판매사 시스템의 고객 번호",
  kind: "receipt: 고객 증명서, original: 원본 묶음",
};

type MediaType = { schema?: unknown; example?: unknown };
type OperationObject = {
  operationId?: string;
  parameters?: {
    in: string;
    name: string;
    description?: string;
    example?: unknown;
  }[];
  requestBody?: { content: Record<string, MediaType> };
  responses?: Record<string, unknown>;
  security?: Record<string, string[]>[];
};
type Spec = {
  paths: Record<string, Record<string, OperationObject>>;
  components?: Record<string, unknown>;
};

/** title이 있는 스키마를 `components.schemas`로 옮기고 그 자리를 `$ref`로 바꾼다. */
class Components {
  readonly schemas: Record<string, unknown> = {};
  private readonly named = new Map<string, object>();

  ref(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.ref(item));
    if (!value || typeof value !== "object") return value;
    const title = (value as { title?: unknown }).title;
    if (typeof title !== "string") return this.copy(value);
    const known = this.named.get(title);
    if (known && known !== value)
      throw new Error(`API 문서의 스키마 이름이 겹칩니다: ${title}`);
    if (!known) {
      this.named.set(title, value);
      this.schemas[title] = this.copy(value);
    }
    return { $ref: `#/components/schemas/${title}` };
  }
  private copy(value: object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.ref(item)]),
    );
  }
}

const json = (schema: unknown, example?: unknown) => ({
  "application/json": {
    schema,
    ...(example === undefined ? {} : { example }),
  },
});

/** 경로를 등록하기 전에 `app.register(swagger, openApiOptions(...))`로 쓴다. */
export function openApiOptions(
  publicPaths: ReadonlySet<string>,
): FastifyDynamicSwaggerOptions {
  const open = [...publicPaths].map((path) => `\`GET ${path}\``).join(", ");
  return {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "FINVERIC API",
        version: "v5",
        description: [
          "FINVERIC은 증권사(판매사) 앱 아래에서 금융상품 판매 기록을 남기고 검증하는 B2B API입니다. 증권사 앱은 고객의 투자성향 진단, 가입 신청, 청약, 최종 확인, 증빙 내려받기를 이 API로 처리합니다. 판매사 직원은 콘솔에서 진단 기준과 상품을 등록하고 관리자 승인을 합니다. 결제 기록은 API(`settle`)로만 합니다. 진단 결과와 판매 상태는 원장(EVM 스마트 컨트랙트)에 기록합니다. 감독기관은 판매사 서버 없이 원장만으로 기록을 대조합니다.",
          "### 기본 주소",
          "모든 경로는 `/api`로 시작합니다. 서버 주소는 `/`입니다. 이 문서를 받은 서버(로컬, Docker, Vercel)에 그대로 요청합니다.",
          "### 접근 코드",
          `서버에 접근 코드(\`DEMO_TOKEN\`)를 설정하면, 공개 경로를 뺀 모든 요청에 \`Authorization: Bearer <접근 코드>\` 헤더가 필요합니다. 코드가 없거나 다르면 401을 돌려줍니다. 공개 경로는 ${open}입니다. 설정 여부는 \`GET /api/config\`의 \`requiresToken\`으로 확인합니다.`,
          "### API 키",
          "증권사 앱 서버는 판매사 콘솔에서 발급한 API 키로 `판매 채널 연동` API를 부릅니다. `Authorization: Bearer fvk_...` 헤더로 보냅니다. 키 원문은 발급할 때 한 번만 보여 줍니다. 서버는 해시만 보관합니다. 키는 서버에만 두고 고객 앱이나 브라우저에 넣지 않습니다. API 키는 접근 코드 설정과 관계없이 항상 검사합니다. 없는 키나 폐기한 키는 401, `판매 채널 연동` 밖의 경로는 403입니다. 요청 한도는 키마다 셉니다.",
          "### 출처 검사",
          "POST 요청에 `Origin` 헤더가 있으면 출처를 검사합니다. API와 같은 도메인, `WEB_ORIGIN`에 등록한 출처, 로컬 개발 서버(5173 포트)만 받습니다. 다른 출처는 403을 돌려줍니다. 서버 간 호출처럼 `Origin` 헤더가 없으면 검사하지 않습니다.",
          "### 오류",
          '오류 본문은 `{ "error": "<한국어 문장>", "code": "<이유>", "ledgerError": "<원장 오류 이름>" }`입니다. `error`와 `code`는 모든 오류 응답에 있습니다.',
          "`error`는 판매사 개발자와 판매사 콘솔이 읽는 합니다체 문장입니다. 원인과 다음 행동을 적습니다. 고객 화면에는 `error`를 그대로 보여 주지 않습니다. `code`(원장 거절이면 `ledgerError`도)로 고객용 문장을 고릅니다. 모르는 `code`는 `unavailable`처럼 다룹니다.",
          [
            "- 400: 경로 값이나 본문이 스키마와 다르거나, 본문이 올바른 JSON이 아닙니다.",
            "- 401: 접근 코드가 없거나 다릅니다. 또는 없는 API 키, 폐기한 API 키입니다.",
            "- 403: 허용하지 않은 출처입니다. 또는 API 키로 부를 수 없는 경로입니다.",
            "- 404: 없는 경로입니다.",
            "- 409: 업무 규칙이나 원장이 요청을 거절했습니다. 없는 판매 건, RPC·저장소 연결 실패도 409입니다. `code`로 이유를 나눕니다.",
            "- 413: 본문이 64KB를 넘습니다.",
            "- 415: 본문 형식(`Content-Type`)이 JSON이 아닙니다.",
            "- 429: 같은 API 키로, 키가 없으면 같은 IP에서 1분에 120번을 넘게 요청했습니다.",
            "- 503: `GET /api/health`의 점검이 실패했습니다. Vercel 함수가 시작 검사에 실패해도 503입니다.",
          ].join("\n"),
          "`code`의 값과 HTTP 상태는 다음과 같습니다.",
          Object.entries(ERROR_CODES)
            .map(
              ([code, { status, meaning }]) =>
                `- \`${code}\` (${status.join("·")}): ${meaning}`,
            )
            .join("\n"),
          "`ledgerError`의 값과 이유는 다음과 같습니다.",
          Object.entries(LEDGER_ERRORS)
            .map(([name, reason]) => `- \`${name}\`: ${reason}`)
            .join("\n"),
          "### 값 형식",
          "원장의 uint256 값(커밋먼트, 블록 번호, 원장 시각 등)은 10진수 문자열입니다. 판매 ID도 10진수 문자열입니다. 해시와 주소는 `0x`로 시작하는 16진수입니다. 응답에 없는 선택 필드는 키를 넣지 않습니다.",
        ].join("\n\n"),
      },
      servers: [{ url: "/", description: "이 문서를 받은 서버" }],
      tags: TAGS.map((tag) => ({ ...tag })),
    },
    convertConstToEnum: false,
    transform: ({ schema, url, route }) => {
      if (schema?.hide) return { schema, url };
      if (schema?.response)
        throw new Error(
          `응답 스키마는 문서 전용입니다. ${url} 경로의 schema.response를 빼고 docs/operations.ts에 적으세요.`,
        );
      const method = Array.isArray(route.method)
        ? route.method[0]
        : route.method;
      const operation = operationFor(String(method), url);
      return {
        schema: {
          ...schema,
          operationId: operation.operationId,
          tags: [operation.tag],
          summary: operation.summary,
          description: operation.description,
        },
        url,
      };
    },
    transformObject: (document) => {
      if (!("openapiObject" in document))
        throw new Error("OpenAPI 문서만 만듭니다.");
      const spec = document.openapiObject as unknown as Spec;
      finish(spec, publicPaths);
      return document.openapiObject;
    },
  };
}

/** 성공 응답, 공통 오류, 인증, 예시를 더한다. */
function finish(spec: Spec, publicPaths: ReadonlySet<string>) {
  const components = new Components();
  const byId = new Map(
    Object.values(OPERATIONS).map((op) => [op.operationId, op]),
  );
  const error = (description: string, example: ErrorResponse) => ({
    description,
    content: json(components.ref(errorResponseSchema), example),
  });
  const errors = {
    BadRequest: error(
      "경로 값이나 본문이 스키마와 다릅니다. 본문이 올바른 JSON이 아닌 경우도 포함합니다. `code`는 `invalid_input`입니다.",
      HTTP_ERRORS.badRequest,
    ),
    Unauthorized: error(
      "접근 코드가 없거나 다릅니다. 또는 API 키가 없는 키이거나 폐기한 키입니다. 접근 코드는 서버에 설정한 경우에만 검사하고, API 키는 보내면 항상 검사합니다. `code`는 `unauthorized`입니다.",
      HTTP_ERRORS.accessCode,
    ),
    Forbidden: error(
      "POST 요청의 `Origin` 헤더 출처가 API와 같은 도메인도 아니고 허용 목록(`WEB_ORIGIN`)에도 없습니다. 또는 API 키로 `판매 채널 연동` 밖의 경로를 불렀습니다. `code`는 `forbidden`입니다.",
      HTTP_ERRORS.apiKeyScope,
    ),
    Conflict: error(
      "업무 규칙이나 원장이 요청을 거절했습니다. 없는 판매 건, RPC·저장소 연결 실패도 포함합니다. `error`에 이유와 다음 행동을 적습니다. `code`와 `ledgerError`로 이유를 나눕니다.",
      {
        error: ledgerRejectionMessage("TooEarly"),
        code: "rejected",
        ledgerError: "TooEarly",
      },
    ),
    TooManyRequests: error(
      "같은 API 키로, 키가 없으면 같은 IP에서 1분에 120번을 넘게 요청했습니다. `code`는 `rate_limited`입니다.",
      HTTP_ERRORS.rateLimited,
    ),
  };
  const shared = (name: keyof typeof errors) => ({
    $ref: `#/components/responses/${name}`,
  });

  for (const [path, item] of Object.entries(spec.paths)) {
    const fastifyPath = path.replace(/\{(\w+)\}/g, ":$1");
    const open = publicPaths.has(fastifyPath);
    for (const [method, op] of Object.entries(item)) {
      const operation = byId.get(op.operationId ?? "");
      if (!operation)
        throw new Error(`API 문서에 없는 경로입니다: ${method} ${path}`);
      const responses: Record<string, unknown> = {};
      for (const [status, response] of Object.entries(operation.responses))
        responses[status] = {
          description: response.description,
          ...(response.schema
            ? {
                content: {
                  [response.contentType ?? "application/json"]: {
                    schema: components.ref(response.schema),
                  },
                },
              }
            : {}),
        };
      // POST는 본문을 JSON으로 읽는다. 본문 스키마가 없어도 잘못된 JSON은 400이다.
      if (op.parameters?.length || op.requestBody || method === "post")
        responses[400] = shared("BadRequest");
      const channel = operation.tag === CHANNEL_TAG;
      if (!open) responses[401] = shared("Unauthorized");
      // 403: POST의 출처 검사, 또는 API 키로 판매 채널 연동 밖의 경로를 부른 경우.
      if (!open && (method === "post" || !channel))
        responses[403] = shared("Forbidden");
      if (!operation.noConflict) responses[409] = shared("Conflict");
      responses[429] = shared("TooManyRequests");
      op.responses = Object.fromEntries(
        Object.entries(responses).sort(([a], [b]) => Number(a) - Number(b)),
      );
      // 판매 채널 연동 API는 접근 코드나 API 키 중 하나로 부른다. 나머지는 접근 코드만 받는다.
      op.security = open
        ? []
        : channel
          ? [{ accessCode: [] }, { apiKey: [] }]
          : [{ accessCode: [] }];
      const keyPath = fastifyPath.startsWith("/api/keys/");
      for (const parameter of op.parameters ?? []) {
        const keyId = keyPath && parameter.name === "id";
        parameter.description ??= keyId
          ? "API 키 ID"
          : PARAMETER_DESCRIPTIONS[parameter.name];
        parameter.example ??= keyId
          ? API_KEY_ID_EXAMPLE
          : PARAMETER_EXAMPLES[parameter.name];
      }
      const body = op.requestBody?.content["application/json"];
      if (body && operation.example !== undefined)
        body.example = operation.example;
    }
  }

  // 경로를 operations.ts의 순서(업무 순서)로 둔다. 문서 화면도 이 순서로 보여 준다.
  const order = [...byId.keys()];
  const rank = (op: OperationObject) => order.indexOf(op.operationId ?? "");
  const first = (item: Record<string, OperationObject>) =>
    Math.min(...Object.values(item).map(rank));
  spec.paths = Object.fromEntries(
    Object.entries(spec.paths)
      .sort(([, a], [, b]) => first(a) - first(b))
      .map(([path, item]) => [
        path,
        Object.fromEntries(
          Object.entries(item).sort(([, a], [, b]) => rank(a) - rank(b)),
        ),
      ]),
  );
  spec.components = {
    ...spec.components,
    schemas: components.schemas,
    responses: errors,
    securitySchemes: {
      accessCode: {
        type: "http",
        scheme: "bearer",
        description:
          "접근 코드. 판매사 콘솔이 씁니다. 서버에 `DEMO_TOKEN`을 설정한 경우에만 검사합니다. `GET /api/config`의 `requiresToken`이 true면 필요합니다.",
      },
      apiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "fvk_<32자>",
        description:
          "API 키. 증권사 앱 서버가 씁니다. 판매사 콘솔에서 발급합니다. `판매 채널 연동` API만 부를 수 있습니다.",
      },
    },
  };
}
