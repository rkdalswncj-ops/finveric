// 검사 도우미: 실제 응답을 API 문서(/api/openapi.json)의 응답 스키마와 대조한다.
// 문서에 없는 필드도 실패로 본다. 검사할 때만 모든 객체 스키마에 additionalProperties: false를 더한다.
import assert from "node:assert/strict";
import { Ajv2020 } from "ajv/dist/2020.js";

type Json = Record<string, any>;

/** properties가 있는 객체 스키마에 additionalProperties: false를 더한 사본. */
function strict(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strict);
  if (!value || typeof value !== "object") return value;
  const copy: Json = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, strict(item)]),
  );
  if (
    copy.properties &&
    typeof copy.properties === "object" &&
    copy.additionalProperties === undefined
  )
    copy.additionalProperties = false;
  return copy;
}

export function responseChecker(spec: Json) {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    validateFormats: false,
  });
  ajv.addSchema({ components: strict(spec.components) }, "spec");
  const routes = Object.entries(spec.paths as Json).flatMap(([path, item]) =>
    Object.entries(item as Json).map(([method, op]) => ({
      method,
      op: op as Json,
      pattern: new RegExp(
        "^" + path.replace(/\./g, "\\.").replace(/\{\w+\}/g, "[^/]+") + "$",
      ),
    })),
  );
  const local = (ref: string) =>
    ref
      .replace(/^#\//, "")
      .split("/")
      .reduce<Json>((node, key) => node?.[key], spec);
  const validators = new Map<string, ReturnType<typeof ajv.compile>>();
  /** 확인한 `operationId 상태` 목록. */
  const covered = new Set<string>();

  /** 응답 본문을 문서와 대조한다. 문서에 없는 경로·상태 코드도 실패다. */
  function check(method: string, url: string, status: number, body: unknown) {
    const pathname = url.split("?")[0];
    const route = routes.find(
      (r) => r.method === method.toLowerCase() && r.pattern.test(pathname),
    );
    assert.ok(route, `API 문서에 없는 경로: ${method} ${pathname}`);
    const id = route.op.operationId as string;
    let response = route.op.responses?.[String(status)];
    assert.ok(response, `API 문서에 없는 응답: ${id} ${status}`);
    if (response.$ref) response = local(response.$ref);
    const schema = response.content?.["application/json"]?.schema;
    assert.ok(schema, `API 문서에 응답 스키마가 없음: ${id} ${status}`);
    const key = `${id} ${status}`;
    let validate = validators.get(key);
    if (!validate) {
      validate = ajv.compile(
        JSON.parse(
          JSON.stringify(strict(schema)).replaceAll(
            '"#/components/',
            '"spec#/components/',
          ),
        ),
      );
      validators.set(key, validate);
    }
    assert.ok(
      validate(body),
      `${key} 응답이 API 문서와 다릅니다: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(body).slice(0, 600)}`,
    );
    covered.add(key);
    return id;
  }
  return { check, covered };
}
