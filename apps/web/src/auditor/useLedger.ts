// 감독기관 화면의 원장 읽기. 판매사 API 없이 지정 RPC에서 원장 v5 이벤트를 읽는다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Deployment } from "@finveric/core";
import {
  LedgerRangeError,
  ledgerReadCode,
  type LedgerSnapshot,
} from "@finveric/core/ledger";
import {
  createLedgerVerificationReader,
  LedgerDeploymentError,
  needsLedgerConfiguration,
  type LedgerVerification,
} from "@finveric/core/verify";
import type { useDeploymentConfig } from "../shared/deployment.ts";
import { ledgerNotice } from "./format.ts";

type LedgerLoadCode =
  "V00" | "V08" | "V09" | NonNullable<ReturnType<typeof ledgerReadCode>>;
type LedgerLoadFailure = {
  ok: false;
  code: LedgerLoadCode;
  message: string;
  needsConfiguration: boolean;
};

export type LedgerReloadResult =
  ({ ok: true } & LedgerVerification) | LedgerLoadFailure;

const ledgerLoadFailure = (
  code: LedgerLoadCode,
  error?: unknown,
): LedgerLoadFailure => {
  let message = "원장 기록을 불러오지 못했습니다. 지정 RPC 연결을 확인하세요.";
  if (code === "V00")
    message = "검증 설정을 불러오지 못했습니다. 설정을 다시 불러오세요.";
  else if (code === "V08")
    message =
      "RPC의 네트워크나 컨트랙트가 검증 설정과 다릅니다. 검증 설정을 확인하세요.";
  else if (code === "V07")
    message =
      "원장 조회 횟수 한도에 도달했습니다. 검증 설정의 RPC와 시작 블록을 확인하세요.";
  else if (error instanceof LedgerRangeError)
    message =
      error.reason === "beforeDeployment"
        ? "지정 RPC가 원장 배포 블록에 도달하지 않았습니다. RPC 상태를 확인하세요."
        : "원장 조회 범위를 초과했습니다. 검증 설정의 시작 블록을 확인하세요.";
  return {
    ok: false,
    code,
    message,
    needsConfiguration: code === "V00" || needsLedgerConfiguration(error),
  };
};

export type Ledger = {
  /** 검증 설정(/deployment.json)을 읽었는지. */
  configured: boolean;
  snapshot?: LedgerSnapshot;
  /** 마지막으로 읽기에 성공한 시각. */
  loadedAt?: Date;
  loading: boolean;
  error: string;
  needsConfiguration: boolean;
  reloadConfiguration: () => void;
  /** 진행 중이면 같은 읽기를 기다린다. 실패하면 이번 오류를 돌려준다. */
  reload: () => Promise<LedgerReloadResult>;
};

/**
 * 배포 설정의 RPC로 원장을 읽는다. 먼저 체인 ID와 원장·Verifier 코드가 배포 설정과 같은지 확인한다.
 * 모든 화면이 같은 결과를 쓴다. 분쟁 조회와 보고서는 대조 직전에 다시 읽는다.
 */
export function useLedger({
  deployment,
  failed: configFailed,
  retry: reloadConfiguration,
}: ReturnType<typeof useDeploymentConfig>): Ledger {
  const [loaded, setLoaded] = useState<{
    deployment: Deployment;
    snapshot: LedgerSnapshot;
    loadedAt: Date;
  }>();
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<LedgerLoadFailure>();
  const source = useRef<{
    deployment: Deployment;
    read: ReturnType<typeof createLedgerVerificationReader>;
  }>(undefined);
  const inFlight = useRef<{
    deployment: Deployment;
    read: Promise<LedgerReloadResult>;
  }>(undefined);
  const reload = useCallback((): Promise<LedgerReloadResult> => {
    if (!deployment) return Promise.resolve(ledgerLoadFailure("V00"));
    if (inFlight.current?.deployment === deployment)
      return inFlight.current.read;

    setLoading(true);
    setFailure(undefined);
    const read = Promise.resolve().then(
      async (): Promise<LedgerReloadResult> => {
        try {
          if (source.current?.deployment !== deployment)
            source.current = {
              deployment,
              read: createLedgerVerificationReader(deployment),
            };
          const next = await source.current.read();
          if (inFlight.current?.read === read)
            setLoaded({
              deployment,
              snapshot: next.snapshot,
              loadedAt: new Date(),
            });
          return { ok: true, ...next };
        } catch (e) {
          const fallback = e instanceof LedgerDeploymentError ? "V08" : "V09";
          const failure = ledgerLoadFailure(ledgerReadCode(e) ?? fallback, e);
          if (inFlight.current?.read === read) setFailure(failure);
          return failure;
        } finally {
          if (inFlight.current?.read === read) {
            inFlight.current = undefined;
            setLoading(false);
          }
        }
      },
    );
    inFlight.current = { deployment, read };
    return read;
  }, [deployment]);
  useEffect(() => {
    if (deployment) void reload();
  }, [deployment, reload]);
  const current = loaded?.deployment === deployment ? loaded : undefined;
  const problem = deployment
    ? failure
    : configFailed
      ? ledgerLoadFailure("V00")
      : undefined;
  return {
    configured: !!deployment,
    snapshot: current?.snapshot,
    loadedAt: current?.loadedAt,
    loading: deployment ? loading : !configFailed,
    error: problem ? ledgerNotice(problem.message, problem.code) : "",
    needsConfiguration: problem?.needsConfiguration ?? false,
    reloadConfiguration,
    reload,
  };
}
