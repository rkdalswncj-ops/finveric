import { useEffect, useState } from "react";
import type { Deployment } from "../../core/src/index.ts";

/**
 * 공개 검증 설정. 배포에서는 사이트 루트의 /deployment.json 하나를 모든 페이지가 함께 읽는다.
 * 페이지는 /client/, /auditor/, /channel/ 아래에서 실행되므로 상대 경로가 아닌 루트 경로를 쓴다.
 */
export function useDeployment(onError: (message: string) => void) {
  const [deployment, setDeployment] = useState<Deployment>();
  useEffect(() => {
    fetch("/deployment.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDeployment)
      .catch(() =>
        onError("검증 설정을 불러오지 못했어요. 잠시 후 다시 접속해 주세요."),
      );
  }, [onError]);
  return deployment;
}
