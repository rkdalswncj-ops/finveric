import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_PATHS } from "../apps/api/src/app.ts";
import { offlineApp } from "./offline-app.ts";
import { OPERATIONS, TAGS } from "../apps/api/src/docs/operations.ts";
import { HTTP_ERRORS } from "../apps/api/src/errors.ts";
import { ERROR_CODES, type ErrorCode } from "@finveric/core/api";

/** 해요체 끝맺음. API 오류 문장은 합니다체(지시는 "-세요")로 쓴다. */
const HAEYO = /(어|아|에|해|예|워|돼|봐)요[.?!]|주세요/;

/** printRoutes 결과에서 `METHOD /경로` 목록을 만든다. HEAD·OPTIONS는 Fastify와 CORS가 만든 경로다. */
function registeredRoutes(tree: string) {
  const routes: string[] = [];
  const stack: string[] = [];
  for (const line of tree.split("\n")) {
    const match = /^((?:│ {3}| {4})*)(?:├── |└── )(\S+)(?: \(([^)]+)\))?$/.exec(
      line,
    );
    if (!match) continue;
    const depth = match[1].length / 4;
    stack.length = depth;
    const path = (stack[depth - 1] ?? "") + match[2];
    stack.push(path);
    for (const method of match[3]?.split(", ") ?? [])
      if (method !== "HEAD" && method !== "OPTIONS")
        routes.push(`${method} ${path}`);
  }
  return routes;
}

test("OpenAPI 3.1 문서가 등록한 모든 경로를 분류와 operationId로 설명한다", async (t) => {
  const app = await offlineApp(t);
  const response = await app.inject({ url: "/api/openapi.json" });
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers["content-type"] as string, /application\/json/);
  const spec = response.json();

  assert.match(spec.openapi, /^3\.1\.\d+$/);
  assert.equal(spec.info.title, "FINVERIC API");
  assert.ok(spec.info.version);
  assert.deepEqual(
    spec.servers.map((s: { url: string }) => s.url),
    ["/"],
  );
  const tagNames = TAGS.map((tag) => tag.name);
  assert.deepEqual(
    spec.tags.map((tag: { name: string }) => tag.name),
    tagNames,
  );
  assert.deepEqual(spec.components.securitySchemes.accessCode, {
    type: "http",
    scheme: "bearer",
    description: spec.components.securitySchemes.accessCode.description,
  });

  const documented = new Map<string, any>();
  for (const [path, item] of Object.entries<Record<string, any>>(spec.paths))
    for (const [method, op] of Object.entries(item))
      documented.set(
        `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ":$1")}`,
        op,
      );

  // 등록한 경로 = 문서의 경로 = operations.ts의 항목.
  const routes = registeredRoutes(app.printRoutes({ commonPrefix: false }));
  assert.ok(routes.length >= 20, routes.join("\n"));
  assert.deepEqual([...documented.keys()].sort(), [...routes].sort());
  assert.deepEqual(Object.keys(OPERATIONS).sort(), [...routes].sort());

  const ids = new Set<string>();
  const refs: string[] = [];
  JSON.stringify(spec, (key, value) => {
    if (key === "$ref") refs.push(value);
    return value;
  });
  for (const ref of refs) {
    const target = ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((node: any, part) => node?.[part], spec);
    assert.ok(target, `풀리지 않는 $ref: ${ref}`);
  }
  for (const [key, op] of documented) {
    assert.ok(op.operationId, key);
    assert.ok(!ids.has(op.operationId), `operationId 중복: ${op.operationId}`);
    ids.add(op.operationId);
    assert.equal(op.tags.length, 1, key);
    assert.ok(tagNames.includes(op.tags[0]), `${key}: ${op.tags[0]}`);
    assert.match(op.summary, /[가-힣]/, key);
    assert.match(op.description, /[가-힣]/, key);
    const success = Object.keys(op.responses).filter((code) =>
      code.startsWith("2"),
    );
    assert.ok(success.length, `${key}: 성공 응답 없음`);
    for (const code of success)
      assert.ok(op.responses[code].content, `${key} ${code}: 응답 스키마 없음`);
    const path = key.split(" ")[1];
    const channel = op.tags[0] === "판매 채널 연동";
    if (PUBLIC_PATHS.has(path)) assert.deepEqual(op.security, [], key);
    else {
      // 판매 채널 연동 API만 API 키를 받는다.
      assert.deepEqual(
        op.security,
        channel ? [{ accessCode: [] }, { apiKey: [] }] : [{ accessCode: [] }],
        key,
      );
      assert.ok(op.responses[401], `${key}: 401 없음`);
    }
    if ((key.startsWith("POST ") || !channel) && !PUBLIC_PATHS.has(path))
      assert.ok(op.responses[403], `${key}: 403 없음`);
    if (op.requestBody) {
      const body = op.requestBody.content["application/json"];
      assert.ok(body.schema.properties, `${key}: 요청 스키마 없음`);
      assert.ok(body.example, `${key}: 요청 예시 없음`);
      assert.ok(op.responses[400], `${key}: 400 없음`);
    }
  }
  // 요청 스키마는 core의 스키마에서 온다(같은 제약이 문서에 있다).
  assert.equal(
    documented.get("POST /api/customers/:customerNo/diagnose").requestBody
      .content["application/json"].schema.properties.answers.items.maximum,
    4,
  );
  assert.equal(
    documented.get("GET /api/sales/:id").parameters[0].schema.pattern,
    "^[1-9][0-9]{0,76}$",
  );
  assert.equal(
    documented.get("GET /api/health").responses[503].content["application/json"]
      .schema.$ref,
    "#/components/schemas/Health",
  );
  assert.equal(
    documented.get("GET /api/sales/:id").responses[200].content[
      "application/json"
    ].schema.$ref,
    "#/components/schemas/Sale",
  );
  assert.equal(
    spec.components.responses.Conflict.content["application/json"].schema.$ref,
    "#/components/schemas/Error",
  );
  // 모든 오류 응답에 code가 있다. 문서는 모든 code와 HTTP 상태를 설명한다.
  const errorSchema = spec.components.schemas.Error;
  assert.deepEqual(errorSchema.required, ["error", "code"]);
  assert.deepEqual(errorSchema.properties.code.enum, Object.keys(ERROR_CODES));
  for (const [name, response] of Object.entries<any>(
    spec.components.responses,
  )) {
    const example = response.content["application/json"].example;
    assert.ok(example.code in ERROR_CODES, `${name}: 예시에 code 없음`);
    assert.match(example.error, /^[가-힣]/, name);
    assert.doesNotMatch(example.error, HAEYO, name);
  }
  for (const [code, { status }] of Object.entries(ERROR_CODES))
    assert.ok(
      spec.info.description.includes(`\`${code}\` (${status.join("·")})`),
      `API 설명에 ${code} 없음`,
    );
});

test("API 문서 화면은 외부 파일 없이 한 HTML로 열린다", async (t) => {
  const app = await offlineApp(t);
  const page = await app.inject({ url: "/api/docs" });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers["content-type"] as string, /^text\/html/);
  assert.match(page.body, /^<!doctype html>/);
  assert.match(page.body, /<html lang="ko">/);
  assert.match(page.body, /fetch\("openapi\.json"/);
  // 외부 스크립트·스타일·글꼴을 읽지 않는다.
  assert.doesNotMatch(page.body, /<(script|link|img)[^>]+(src|href)=/);
  assert.doesNotMatch(page.body, /https?:\/\//);
  // 화면 문구에 시연·모의·테스트용을 쓰지 않는다(DESIGN.md). 데이터는 문서에서 읽는다.
  assert.doesNotMatch(page.body, /시연|모의|테스트용/);
});

test("접근 코드를 설정해도 상태 확인·설정·API 문서는 열리고 나머지는 401이다", async (t) => {
  process.env.DEMO_TOKEN = "docs-test-token-32-characters-0000000";
  t.after(() => delete process.env.DEMO_TOKEN);
  const app = await offlineApp(t);
  for (const url of ["/api/openapi.json", "/api/docs", "/api/config"])
    assert.equal((await app.inject({ url })).statusCode, 200, url);
  assert.equal((await app.inject({ url: "/api/rules" })).statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/api/openapi.json?download=1" })).statusCode,
    200,
  );
  const missing = await app.inject({
    method: "POST",
    url: "/api/sales/1/action/unknown",
    headers: { authorization: `Bearer ${process.env.DEMO_TOKEN}` },
    payload: {},
  });
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.json(), HTTP_ERRORS.notFound);
});

/** 응답의 상태 코드와 `code`를 확인한다. 문장은 우리가 쓴 합니다체 문장이다. */
function assertError(
  response: { statusCode: number; json(): any; body: string },
  status: number,
  code: ErrorCode,
) {
  assert.equal(response.statusCode, status, response.body);
  const body = response.json();
  assert.equal(body.code, code, response.body);
  assert.match(body.error, /^[가-힣]/, response.body);
  assert.doesNotMatch(body.error, HAEYO, response.body);
  assert.deepEqual(Object.keys(body).sort(), ["code", "error"]);
}

test("Fastify·플러그인·접근 검사의 오류도 원래 상태 코드와 code를 보낸다", async (t) => {
  process.env.DEMO_TOKEN = "docs-test-token-32-characters-0000000";
  t.after(() => delete process.env.DEMO_TOKEN);
  const app = await offlineApp(t);
  const auth = { authorization: `Bearer ${process.env.DEMO_TOKEN}` };
  const post = (headers: Record<string, string>, payload: string) =>
    app.inject({ method: "POST", url: "/api/sales", headers, payload });
  const json = { ...auth, "content-type": "application/json" };

  // 잘못된 JSON 400, 스키마 400, 본문 초과 413, 본문 형식 415.
  assertError(await post(json, "{"), 400, "invalid_input");
  assertError(await post(json, "{}"), 400, "invalid_input");
  assertError(
    await post(json, JSON.stringify({ name: "x".repeat(70_000) })),
    413,
    "invalid_input",
  );
  assertError(
    await post({ ...auth, "content-type": "application/xml" }, "<x/>"),
    415,
    "invalid_input",
  );
  // 접근 코드 401, API 키 401, 허용하지 않은 출처 403, API 키 범위 403, 없는 경로 404.
  assertError(await app.inject({ url: "/api/sales" }), 401, "unauthorized");
  assertError(
    await app.inject({
      url: "/api/sales",
      headers: { authorization: `Bearer fvk_${"A".repeat(32)}` },
    }),
    401,
    "unauthorized",
  );
  assertError(
    await post(
      { ...json, origin: "https://other.example" },
      JSON.stringify({
        productId: `0x${"1".repeat(64)}`,
        customerNo: "C-0001",
      }),
    ),
    403,
    "forbidden",
  );
  assertError(
    await app.inject({ url: "/api/nothing", headers: auth }),
    404,
    "not_found",
  );
  // 업무 오류: 없는 판매 건은 409 not_found다(원장을 읽기 전에 끝난다).
  assertError(
    await app.inject({ url: "/api/sales/1/export/receipt", headers: auth }),
    409,
    "not_found",
  );
  // 요청 한도 429. 같은 IP의 요청을 센다.
  let last;
  for (let i = 0; i < 121; i++)
    last = await app.inject({ url: "/api/openapi.json" });
  assertError(last!, 429, "rate_limited");
});

test("우리가 쓰지 않은 오류는 RPC 문장을 숨기고 unavailable로 보낸다", async (t) => {
  // offline 스택의 RPC는 닫힌 포트다. 원장을 읽는 경로는 viem 오류로 끝난다.
  const app = await offlineApp(t);
  const failed = await app.inject({ url: "/api/rules" });
  assertError(failed, 409, "unavailable");
  assert.deepEqual(failed.json(), HTTP_ERRORS.unavailable);
  assert.doesNotMatch(failed.body, /127\.0\.0\.1|http/);
});
