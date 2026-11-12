// 테스트용 Upstash Redis REST 서버. RedisStore가 쓰는 명령만 구현한다.
export function fakeUpstash() {
  const values = new Map<string, { value: string; expiresAt?: number }>();
  let commands = 0;
  const get = (key: string) => {
    const entry = values.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      values.delete(key);
      return undefined;
    }
    return entry?.value;
  };
  const run = (args: string[]): unknown => {
    const [name, ...rest] = args;
    switch (name) {
      case "PING":
        return "PONG";
      case "GET":
        return get(rest[0]) ?? null;
      case "SET": {
        const [key, value, ...options] = rest;
        const nx = options.includes("NX");
        const px = options.indexOf("PX");
        if (nx && get(key) !== undefined) return null;
        values.set(key, {
          value,
          expiresAt: px >= 0 ? Date.now() + Number(options[px + 1]) : undefined,
        });
        return "OK";
      }
      case "EVAL": {
        const [script, count, ...params] = rest;
        const keys = params.slice(0, Number(count));
        const argv = params.slice(Number(count));
        if (get(keys[0]) !== argv[0]) return 0;
        if (script.includes('"del"')) {
          values.delete(keys[0]);
          return 1;
        }
        values.set(keys[1], { value: argv[1] });
        return 1;
      }
      default:
        throw new Error(`fake upstash: unsupported ${name}`);
    }
  };
  const fakeFetch = (async (_url: string, init?: RequestInit) => {
    commands++;
    const args = JSON.parse(String(init?.body)) as string[];
    try {
      return new Response(JSON.stringify({ result: run(args) }));
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 400,
      });
    }
  }) as typeof fetch;
  return {
    fetch: fakeFetch,
    values,
    get commands() {
      return commands;
    },
    /** 잠금을 강제로 만료시킨다. 함수가 최대 실행 시간을 넘긴 경우를 흉내 낸다. */
    expire(key: string) {
      values.delete(key);
    },
  };
}
