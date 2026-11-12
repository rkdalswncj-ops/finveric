import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_PATHS } from "../apps/api/src/app.ts";
import { offlineApp } from "./offline-app.ts";
import { OPERATIONS, TAGS } from "../apps/api/src/docs/operations.ts";

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
  assert.deepEqual(missing.json(), { error: "없는 API 경로입니다." });
});

test("잘못된 JSON 본문과 요청 한도 초과는 409가 아니라 원래 상태 코드다", async (t) => {
  const app = await offlineApp(t);
  const broken = await app.inject({
    method: "POST",
    url: "/api/sales",
    headers: { "content-type": "application/json" },
    payload: "{",
  });
  assert.equal(broken.statusCode, 400);
  assert.deepEqual(broken.json(), {
    error: "입력 형식과 허용 범위를 확인하세요.",
  });
  let last;
  for (let i = 0; i < 121; i++)
    last = await app.inject({ url: "/api/openapi.json" });
  assert.equal(last?.statusCode, 429);
  assert.deepEqual(last?.json(), {
    error: "요청이 너무 많습니다. 1분 뒤 다시 시도하세요.",
  });
});
