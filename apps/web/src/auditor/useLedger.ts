// 감독기관 화면의 원장 읽기. 판매사 API 없이 지정 RPC에서 원장 v5 이벤트를 읽는다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Deployment } from "@finveric/core";
import {
  ledgerClient,
  readLedger,
  type LedgerSnapshot,
} from "@finveric/core/ledger";
import { requireDeployment } from "@finveric/core/verify";
import { DEPLOYMENT_ERROR } from "../shared/deployment.ts";
import { koreanError } from "./format.ts";

export type Ledger = {
  /** 검증 설정(/deployment.json)을 읽었는지. */
  configured: boolean;
  snapshot?: LedgerSnapshot;
  /** 마지막으로 읽은 시각. */
  loadedAt?: Date;
  loading: boolean;
  error: string;
  /** 원장을 다시 읽는다. 실패하면 undefined를 돌려준다. */
  reload: () => Promise<LedgerSnapshot | undefined>;
};

/**
 * 배포 설정의 RPC로 원장을 읽는다. 먼저 체인 ID와 원장·Verifier 코드가 배포 설정과 같은지 확인한다.
 * 모든 화면이 같은 결과를 쓴다. 분쟁 조회와 보고서는 대조 직전에 다시 읽는다.
 * `configFailed`이면 검증 설정을 읽지 못한 것이다. 화면이 "불러오고 있습니다"에 머물지 않게 오류로 둔다.
 */
export function useLedger(
  deployment?: Deployment,
  configFailed = false,
): Ledger {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot>();
  const [loadedAt, setLoadedAt] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const reload = useCallback(async () => {
    if (!deployment) return undefined;
    const current = ++request.current;
    setLoading(true);
    setError("");
    try {
      const client = ledgerClient(deployment);
      await requireDeployment(client, deployment);
      const next = await readLedger(deployment, client);
      if (current === request.current) {
        setSnapshot(next);
        setLoadedAt(new Date());
      }
      return next;
    } catch (e) {
      if (current === request.current)
        setError(
          koreanError(
            e,
            "원장 기록을 불러오지 못했습니다. 지정 RPC 연결을 확인하고 원장 다시 읽기를 누르세요.",
          ),
        );
      return undefined;
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [deployment]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return {
    configured: !!deployment,
    snapshot,
    loadedAt,
    loading,
    error: !deployment && configFailed ? DEPLOYMENT_ERROR.institution : error,
    reload,
  };
}
