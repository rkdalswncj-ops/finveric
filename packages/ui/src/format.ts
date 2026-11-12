// 화면 표기 형식. 판정이나 업무 규칙은 넣지 않는다.
import type { Deployment } from "../../core/src/index.ts";

/** 긴 해시와 ID를 앞 10자·뒤 6자로 줄인다. */
export const short = (value?: string) =>
  value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "—";

/** 원 단위 금액. */
export const won = (amount: number | string) =>
  `${Number(amount).toLocaleString("ko-KR")}원`;

/**
 * 블록 시각(초), ISO 시각, Date를 한국 시간으로 쓴다. 모든 페이지가 이 형식 하나를 쓴다.
 * 예: "2026. 11. 13. 15:04:05". 연도를 넣고 24시간제로 쓴다.
 */
export function dateTime(value?: number | string | Date) {
  if (value === undefined || value === "" || value === 0) return "—";
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

/** 연결한 네트워크 이름. */
export const networkName = (deployment?: Pick<Deployment, "chainId">) =>
  !deployment
    ? "원장 설정 대기"
    : deployment.chainId === 11155111
      ? "Sepolia 테스트넷"
      : "Anvil 테스트 원장";
