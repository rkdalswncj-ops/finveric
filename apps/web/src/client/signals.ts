// 판매사 콘솔의 위험 신호 입력. 판정은 core의 computeSignals를 쓴다.
import { computeSignals, type Signal, type SignalSale } from "@finveric/core";
import type { CustomerDto } from "@finveric/core/api";
import type { Sale } from "../shared/sales.ts";

/**
 * 위험 신호. 고객의 진단 회차와 청약한 판매 건을 core 입력 형식으로 바꿔 계산한다.
 * 판매사 API로는 시연 고객의 회차만 읽는다. 다른 고객의 신호는 감독기관 화면이 원장에서 계산한다.
 */
export function saleSignals(
  customer: CustomerDto | undefined,
  sales: Sale[],
): Signal[] {
  const diagnoses =
    customer?.diagnoses.map((diagnosis) => ({
      customerRef: customer.ref,
      attempt: diagnosis.attempt,
      profile: diagnosis.profile,
      at: diagnosis.at,
    })) ?? [];
  const subscribed = sales.flatMap((sale): SignalSale[] =>
    sale.chain && sale.status !== "draft" && sale.status !== "abandoned"
      ? [
          {
            saleId: sale.id,
            customerRef: sale.customerRef,
            attempt: sale.chain.attempt,
            suitable: sale.chain.suitable,
            status: sale.status,
            explanationSeconds: sale.chain.explanationSeconds,
          },
        ]
      : [],
  );
  return computeSignals({ diagnoses, sales: subscribed });
}
