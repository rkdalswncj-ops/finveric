import { useEffect, useState } from "react";
import type { Deployment } from "../../core/src/index.ts";

/** 검증 설정을 읽지 못했을 때의 문장. 고객 화면(해요체)과 기관 화면(합니다체)이 다르다. */
export const DEPLOYMENT_ERROR = {
  customer: "검증 설정을 불러오지 못했어요. 잠시 후 다시 접속해 주세요.",
  institution:
    "검증 설정을 불러오지 못했습니다. 연결을 확인하고 화면을 새로 고치세요.",
} as const;

/**
 * 공개 검증 설정. 배포에서는 사이트 루트의 /deployment.json 하나를 모든 페이지가 함께 읽는다.
 * 페이지는 /client/, /auditor/, /channel/ 아래에서 실행되므로 상대 경로가 아닌 루트 경로를 쓴다.
 * `onError`는 바뀌지 않는 함수여야 한다(useCallback 또는 setState). 바뀌면 다시 읽는다.
 */
export function useDeployment(
  onError: (message: string) => void,
  message: string = DEPLOYMENT_ERROR.customer,
) {
  const [deployment, setDeployment] = useState<Deployment>();
  useEffect(() => {
    fetch("/deployment.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDeployment)
      .catch(() => onError(message));
  }, [onError, message]);
  return deployment;
}
