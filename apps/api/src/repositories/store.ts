import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { CodedError } from "../errors.ts";

/**
 * 판매 기록 저장소.
 *
 * `shared`가 false이면 한 프로세스만 기록을 쓴다. 로컬 API가 이 경우다.
 * `shared`가 true이면 여러 서버 인스턴스가 같은 기록을 쓴다. Vercel 함수가 이 경우다.
 * 이때는 잠금 안에서만 기록을 바꾸고, 요청마다 저장소에서 기록을 다시 읽는다.
 */
export interface SaleStore {
  readonly shared: boolean;
  readonly label: string;
  read(): Promise<string | undefined>;
  write(data: string): Promise<void>;
  lock<T>(operation: () => Promise<T>): Promise<T>;
  /** 저장소에 접근할 수 있는지 가볍게 확인한다. health 점검에 쓴다. */
  ping(): Promise<void>;
}

export class FileStore implements SaleStore {
  readonly shared = false;
  constructor(readonly file: string) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  }
  get label() {
    return this.file;
  }
  readSync() {
    return existsSync(this.file) ? readFileSync(this.file, "utf8") : undefined;
  }
  async read() {
    return this.readSync();
  }
  writeSync(data: string) {
    writeFileSync(this.file + ".tmp", data, { mode: 0o600 });
    renameSync(this.file + ".tmp", this.file);
  }
  async write(data: string) {
    this.writeSync(data);
  }
  // 한 프로세스 안의 순서는 FundService의 큐가 지킨다.
  lock<T>(operation: () => Promise<T>) {
    return operation();
  }
  async ping() {
    try {
      accessSync(dirname(this.file), constants.R_OK | constants.W_OK);
    } catch {
      throw new CodedError("STORE_UNAVAILABLE");
    }
  }
}

type Fetch = typeof fetch;
const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
const WRITE_IF_OWNER = `if redis.call("get", KEYS[1]) == ARGV[1] then redis.call("set", KEYS[2], ARGV[2]) return 1 else return 0 end`;

/** Upstash Redis REST API를 쓰는 공유 저장소. 클라이언트 라이브러리 없이 HTTP로 호출한다. */
export class RedisStore implements SaleStore {
  readonly shared = true;
  private owner?: string;
  constructor(
    private readonly options: {
      url: string;
      token: string;
      key: string;
      /** 잠금 유지 시간. Vercel Hobby 함수 최대 실행 시간 300초보다 길게 둔다. */
      lockTtlMs?: number;
      /** 잠금을 기다리는 최대 시간. */
      lockWaitMs?: number;
      fetch?: Fetch;
    },
  ) {}
  get label() {
    return `redis:${this.options.key}`;
  }
  private get dataKey() {
    return `${this.options.key}:sales`;
  }
  private get lockKey() {
    return `${this.options.key}:lock`;
  }
  private async command(args: (string | number)[]) {
    const response = await (this.options.fetch ?? fetch)(this.options.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map(String)),
    });
    const body = (await response.json().catch(() => ({}))) as {
      result?: unknown;
      error?: string;
    };
    // Upstash 오류 본문에는 저장소 주소가 들어갈 수 있다. 우리가 쓴 문장만 내보낸다.
    if (!response.ok || body.error) throw new CodedError("STORE_UNAVAILABLE");
    return body.result;
  }
  async read() {
    const result = await this.command(["GET", this.dataKey]);
    return typeof result === "string" ? result : undefined;
  }
  async ping() {
    if ((await this.command(["PING"])) !== "PONG")
      throw new CodedError("STORE_UNAVAILABLE");
  }
  async write(data: string) {
    // 저장은 잠금 안에서만 부른다(`SaleRepository.save`). 여기에 닿으면 코드 오류다.
    if (!this.owner)
      throw new Error(
        "판매 기록은 잠금 안에서만 저장할 수 있습니다. 잠시 뒤 다시 요청하세요.",
      );
    const written = await this.command([
      "EVAL",
      WRITE_IF_OWNER,
      2,
      this.lockKey,
      this.dataKey,
      this.owner,
      data,
    ]);
    if (Number(written) !== 1) throw new CodedError("STORE_LOCK_EXPIRED");
  }
  async lock<T>(operation: () => Promise<T>) {
    const owner = randomUUID();
    const ttl = this.options.lockTtlMs ?? 310_000;
    const deadline = Date.now() + (this.options.lockWaitMs ?? 120_000);
    for (;;) {
      const result = await this.command([
        "SET",
        this.lockKey,
        owner,
        "NX",
        "PX",
        ttl,
      ]);
      if (result === "OK") break;
      if (Date.now() >= deadline) throw new CodedError("STORE_LOCK_BUSY");
      await new Promise((resolve) =>
        setTimeout(resolve, 200 + Math.random() * 300),
      );
    }
    this.owner = owner;
    try {
      return await operation();
    } finally {
      this.owner = undefined;
      await this.command(["EVAL", RELEASE, 1, this.lockKey, owner]).catch(
        () => undefined,
      );
    }
  }
}

export function redisSettings(env: NodeJS.ProcessEnv = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : undefined;
}

/**
 * Redis 설정이 있으면 공유 저장소를 쓴다. 없으면 로컬 파일을 쓴다.
 * Vercel 함수의 파일은 다음 호출까지 남는다는 보장이 없다. 그래서 Vercel에서는 Redis를 요구한다.
 */
export function createStore(
  scope: { chainId: number; ledger: string },
  file: string,
  env: NodeJS.ProcessEnv = process.env,
): SaleStore {
  const redis = redisSettings(env);
  if (redis)
    return new RedisStore({
      ...redis,
      key: `finveric:${scope.chainId}:${scope.ledger.toLowerCase()}`,
    });
  if (env.VERCEL)
    throw new Error(
      "Vercel에서는 판매 기록 저장소(Upstash Redis)를 연결해야 합니다.",
    );
  return new FileStore(file);
}
