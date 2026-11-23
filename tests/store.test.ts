import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStore,
  FileStore,
  RedisStore,
} from "../apps/api/src/repositories/store.ts";
import {
  allowedOrigins,
  corsOrigins,
  sameSiteOrigin,
} from "../apps/api/src/app.ts";
import { normalizeApiUrl } from "../apps/api/src/vercel.ts";
import { SaleRepository } from "../apps/api/src/repositories/sales.ts";
import { fakeUpstash } from "./fake-upstash.ts";

const store = (upstash: { fetch: typeof fetch }, lockWaitMs = 5_000) =>
  new RedisStore({
    url: "https://example.upstash.io",
    token: "test-token",
    key: "finveric:test",
    lockWaitMs,
    fetch: upstash.fetch,
  });
const respondToGet = (
  upstash: ReturnType<typeof fakeUpstash>,
  respond: () => Response,
): { fetch: typeof fetch } => ({
  fetch: async (url, init) => {
    const [command] = JSON.parse(String(init?.body));
    return command === "GET" ? respond() : upstash.fetch(url, init);
  },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("공유 저장소 잠금은 인스턴스 사이에서 한 작업만 실행한다", async () => {
  const upstash = fakeUpstash();
  const [a, b] = [store(upstash), store(upstash)];
  const log: string[] = [];
  const work = (name: string, s: RedisStore) =>
    s.lock(async () => {
      log.push(`${name}:start`);
      await sleep(80);
      await s.write(name);
      log.push(`${name}:end`);
    });
  await Promise.all([work("a", a), work("b", b)]);
  const first = log[0].split(":")[0];
  const second = first === "a" ? "b" : "a";
  assert.deepEqual(log, [
    `${first}:start`,
    `${first}:end`,
    `${second}:start`,
    `${second}:end`,
  ]);
  assert.equal(await a.read(), second);
});

test("저장소 연결 점검(ping)은 기록을 읽지 않고 응답만 확인한다", async () => {
  const upstash = fakeUpstash();
  await store(upstash).ping();
  assert.equal(upstash.commands, 1);
  const file = new FileStore(join(tmpdir(), "finveric-ping-test", "s.json"));
  await file.ping();
});

test("잠금 밖에서는 공유 저장소에 쓰지 않는다", async () => {
  await assert.rejects(store(fakeUpstash()).write("x"), /잠금 안에서만 저장/);
});

test("잠금이 만료되면 저장을 거절하고 다른 인스턴스의 잠금을 지우지 않는다", async () => {
  const upstash = fakeUpstash();
  const [a, b] = [store(upstash), store(upstash)];
  await assert.rejects(
    a.lock(async () => {
      upstash.expire("finveric:test:lock");
      // 다른 인스턴스가 만료된 잠금을 가져간다.
      const taken = b.lock(() => sleep(50));
      await sleep(10);
      await a.write("stale");
      await taken;
    }),
    /잠금이 만료/,
  );
  assert.equal(await a.read(), undefined);
});

test("다른 인스턴스가 잠금을 오래 잡으면 기다리다가 거절한다", async () => {
  const upstash = fakeUpstash();
  const holder = store(upstash);
  const waiter = store(upstash, 300);
  const held = holder.lock(() => sleep(900));
  await sleep(20);
  await assert.rejects(
    waiter.lock(async () => undefined),
    (error: Error & { code?: string; type?: string }) =>
      /다른 요청을 처리하고 있습니다/.test(error.message) &&
      error.code === "STORE_LOCK_BUSY" &&
      error.type === "unavailable",
  );
  await held;
  assert.equal(await waiter.lock(async () => "ok"), "ok");
});

test("저장소 오류에 연결 주소나 토큰을 노출하지 않는다", async () => {
  const failing = store(
    respondToGet(fakeUpstash(), () =>
      Response.json(
        { error: "WRONGPASS secret-host secret-token" },
        { status: 401 },
      ),
    ),
  );
  await assert.rejects(failing.read(), (error: Error) => {
    assert.equal(
      error.message,
      "판매 기록 저장소에 연결하지 못했습니다. 잠시 뒤 다시 요청하세요.",
    );
    // 오류 응답의 type과 code. 연동 앱은 type으로 "잠시 후 다시 시도" 안내를 고른다.
    const coded = error as Error & { code?: string; type?: string };
    assert.equal(coded.type, "unavailable");
    assert.equal(coded.code, "STORE_UNAVAILABLE");
    return true;
  });
});

test("Redis 연결 실패는 저장소 오류로 반환한다", async () => {
  const failing = store(
    respondToGet(fakeUpstash(), () => {
      throw new Error("example.upstash.io 연결 실패");
    }),
  );
  await assert.rejects(failing.read(), { code: "STORE_UNAVAILABLE" });
});

test("Redis 조회는 잘못된 성공 응답을 기록 없음으로 처리하지 않는다", async (t) => {
  for (const body of [
    "not-json",
    "{}",
    "null",
    "[]",
    '{"result":42}',
    '{"result":{}}',
    '{"result":""}',
    '{"result":null,"error":""}',
  ]) {
    await t.test(body, async () => {
      const invalid = store(
        respondToGet(fakeUpstash(), () => new Response(body)),
      );
      await assert.rejects(invalid.read(), { code: "STORE_UNAVAILABLE" });
    });
  }
});

test("Redis 조회의 null은 기록 없음이고 문자열은 원문 그대로다", async () => {
  const valid = store(fakeUpstash());
  assert.equal(await valid.read(), undefined);
  const raw = '{"sales":[]}';
  await valid.lock(() => valid.write(raw));
  assert.equal(await valid.read(), raw);
});

test("최신 기록 조회가 잘못되면 저장소 변경 작업을 시작하지 않는다", async (t) => {
  const upstash = fakeUpstash();
  const original = JSON.stringify({
    sales: [],
    systemTraces: [],
    rules: [],
    products: [],
    diagnoses: [],
    apiKeys: [
      {
        id: "key_000000000001",
        name: "기존 키",
        prefix: "fvk_testonly",
        hash: "0".repeat(64),
        scope: "channel",
        createdAt: "2026-11-22T00:00:00.000Z",
      },
    ],
  });
  const seed = store(upstash);
  await seed.lock(() => seed.write(original));
  const cases = [
    ["result가 없는 응답", "{}"],
    ["빈 저장 값", '{"result":""}'],
    ["잘못된 저장 JSON", JSON.stringify({ result: "not-json" })],
    ["배열 스냅샷", JSON.stringify({ result: "[]" })],
    ["판매 목록 누락", JSON.stringify({ result: "{}" })],
    ["판매 목록에 null 포함", JSON.stringify({ result: '{"sales":[null]}' })],
    [
      "API 키 목록이 객체",
      JSON.stringify({ result: '{"sales":[],"apiKeys":{}}' }),
    ],
  ];
  for (const [label, body] of cases) {
    await t.test(label, async () => {
      const broken = store(respondToGet(upstash, () => new Response(body)));
      const repository = new SaleRepository(broken);
      let ran = false;
      await assert.rejects(
        repository.transaction(async () => {
          ran = true;
          repository.save();
        }),
        { code: "STORE_UNAVAILABLE" },
      );
      assert.equal(ran, false);
      assert.equal(await seed.read(), original);
      assert.equal(await seed.lock(async () => "released"), "released");
    });
  }
});

test("이전 스냅샷의 빠진 목록을 채우고 Redis 기록이 사라지면 메모리에서 비운다", async () => {
  const upstash = fakeUpstash();
  const shared = store(upstash);
  const repository = new SaleRepository(shared);
  const legacy = '{"sales":[],"systemTraces":[]}';
  await shared.lock(() => shared.write(legacy));
  assert.deepEqual(await repository.read(async () => repository.apiKeys()), []);

  const key = {
    id: "key_000000000001",
    name: "기존 키",
    prefix: "fvk_testonly",
    hash: "0".repeat(64),
    scope: "channel" as const,
    createdAt: "2026-11-22T00:00:00.000Z",
  };
  await repository.transaction(async () => repository.addApiKey(key));
  assert.deepEqual(await repository.read(async () => repository.apiKeys()), [
    key,
  ]);

  upstash.expire("finveric:test:sales");
  assert.deepEqual(await repository.read(async () => repository.apiKeys()), []);
});

test("Vercel에서는 Redis 없이 파일 저장소로 실행하지 않는다", () => {
  const scope = { chainId: 11155111, ledger: "0xABC" };
  assert.throws(
    () => createStore(scope, "/tmp/x.json", { VERCEL: "1" }),
    /Upstash Redis/,
  );
  const redis = createStore(scope, "/tmp/x.json", {
    VERCEL: "1",
    KV_REST_API_URL: "https://kv.example",
    KV_REST_API_TOKEN: "t",
  });
  assert.ok(redis instanceof RedisStore);
  assert.equal(redis.label, "redis:finveric:11155111:0xabc");
  assert.ok(
    createStore(
      scope,
      join(tmpdir(), "finveric-store-test", "x.json"),
      {},
    ) instanceof FileStore,
  );
});

test("같은 도메인과 지정한 출처의 POST만 받는다", () => {
  assert.equal(
    sameSiteOrigin({
      host: "internal",
      "x-forwarded-host": "finveric-git-main.vercel.app",
      "x-forwarded-proto": "https",
    }),
    "https://finveric-git-main.vercel.app",
  );
  assert.equal(
    sameSiteOrigin({ host: "127.0.0.1:3001" }),
    "http://127.0.0.1:3001",
  );
  const env = { WEB_ORIGIN: "https://a.example, https://b.example" };
  assert.deepEqual(corsOrigins(env), [
    "https://a.example",
    "https://b.example",
  ]);
  assert.ok(allowedOrigins(env).includes("http://localhost:5173"));
  assert.ok(!allowedOrigins(env).includes("https://evil.example"));
  assert.ok(corsOrigins({}).includes("http://127.0.0.1:5173"));
});

test("Vercel이 바꾼 API 주소를 원래 경로로 되돌린다", () => {
  assert.equal(normalizeApiUrl("/api/sales?x=1"), "/api/sales?x=1");
  assert.equal(
    normalizeApiUrl("/api?__path=sales/12/diagnose"),
    "/api/sales/12/diagnose",
  );
  assert.equal(normalizeApiUrl("/api/sales?__path=sales"), "/api/sales");
  assert.equal(normalizeApiUrl("/api?__path=health&x=2"), "/api/health?x=2");
});
