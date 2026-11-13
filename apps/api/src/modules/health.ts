// 운영: API가 의존하는 RPC, 원장, 판매 기록 저장소를 점검한다.
import type { HealthCheck, HealthResponse } from "@finveric/core/api";
import type { FundService } from "../service.ts";
import { readChainId, readCodeHash } from "../gateways/ledger.ts";

/** 점검 하나에 쓰는 최대 시간. Vercel 함수와 Docker healthcheck가 오래 기다리지 않게 한다. */
const TIMEOUT_MS = 5_000;

async function check(operation: () => Promise<void>): Promise<HealthCheck> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("응답 시간이 초과되었습니다.")),
          TIMEOUT_MS,
        );
      }),
    ]);
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    // RPC·Redis 오류에는 주소와 토큰이 들어갈 수 있다. 우리가 쓴 문장만 내보낸다.
    const message =
      error instanceof Error &&
      /^[가-힣]/.test(error.message) &&
      !error.message.includes("http")
        ? error.message
        : "연결하지 못했습니다.";
    return { ok: false, ms: Date.now() - started, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function health(svc: FundService): Promise<HealthResponse> {
  const [rpc, ledger, store] = await Promise.all([
    check(async () => {
      if ((await readChainId(svc)) !== svc.dep.chainId)
        throw new Error("RPC 네트워크가 배포 설정과 다릅니다.");
    }),
    check(async () => {
      if ((await readCodeHash(svc, svc.dep.ledger)) !== svc.dep.ledgerCodeHash)
        throw new Error("원장이 없거나 배포 설정과 코드가 다릅니다.");
    }),
    check(() => svc.repository.ping()),
  ]);
  return {
    ok: rpc.ok && ledger.ok && store.ok,
    network: svc.env.network,
    chainId: svc.dep.chainId,
    ledger: svc.dep.ledger,
    checks: { rpc, ledger, store },
  };
}
