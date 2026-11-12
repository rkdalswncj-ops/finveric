import {
  profileName,
  saleProduct,
  type Sale,
} from "../../../../packages/ui/src/sale.ts";

export type SignalKind = "repeat" | "rise" | "unsuitable";
export type Signal = { kind: SignalKind; sale: Sale; detail: string };

export const signalLabels: Record<SignalKind, string> = {
  repeat: "재진단 반복",
  rise: "결과 상승 뒤 청약",
  unsuitable: "부적합 가입",
};

/** 같은 판매 건에서 진단을 이 횟수 이상 하면 재진단 반복 신호를 낸다(시연용 가정). */
export const REPEAT_THRESHOLD = 3;

/**
 * 판매 기록으로 위험 신호를 계산한다. 원장 v4는 판매 건마다 회차를 센다.
 * 짧은 설명 확인과 짧은 간격 재진단은 원장 v5의 기록이 있어야 계산할 수 있다.
 */
export function riskSignals(sales: Sale[]): Signal[] {
  const signals: Signal[] = [];
  for (const sale of sales) {
    const profiles = sale.attempts.map((attempt) => attempt.profile);
    const last = profiles.at(-1);
    const previous = profiles.at(-2);
    const minimum = saleProduct(sale)?.minimumProfile;
    if (sale.attempts.length >= REPEAT_THRESHOLD)
      signals.push({
        kind: "repeat",
        sale,
        detail: `진단 ${sale.attempts.length}회`,
      });
    if (last !== undefined && previous !== undefined && last > previous)
      signals.push({
        kind: "rise",
        sale,
        detail: `${profileName(previous)} → ${profileName(last)}`,
      });
    if (
      sale.state.finalized &&
      last !== undefined &&
      minimum !== undefined &&
      last < minimum
    )
      signals.push({
        kind: "unsuitable",
        sale,
        detail: `${profileName(last)} 고객 · 상품 기준 ${profileName(minimum)}`,
      });
  }
  return signals;
}

/** 관리자 승인을 기다리는 판매 건. */
export const awaitingApproval = (sale: Sale) =>
  sale.state.attempts >= REPEAT_THRESHOLD &&
  !sale.state.reviewed &&
  !sale.state.finalized;
