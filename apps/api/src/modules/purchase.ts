// 기존 펀드 업무 인프라: 모의 매입.
// 가입이 확정된 건만 요청 → 결과 대기 → 결과 반영 순서로 원장에 남긴다. 실제 자금은 움직이지 않는다.
import type { FundService } from "../service.ts";
import type { StoredSale } from "../repositories/sales.ts";
import { readBlockTime, readSale } from "../gateways/ledger.ts";
import { send } from "./transactions.ts";

export async function purchase(svc: FundService, record: StoredSale) {
  const id = BigInt(record.id);
  const state = await readSale(svc, record.id);
  if (!state.finalized)
    throw new Error("가입을 완료한 뒤 매입 시연을 진행해 주세요.");
  if (state.purchaseState === 3) return;
  if (state.purchaseState === 0)
    await send(
      svc,
      "seller",
      "requestMockPurchase",
      [id],
      "MockPurchaseUpdated",
      record,
    );
  if ((await readSale(svc, record.id)).purchaseState === 1)
    await send(
      svc,
      "infrastructure",
      "awaitMockPurchase",
      [id],
      "MockPurchaseUpdated",
      record,
    );
  // 105만원, 1,000좌당 기준가격 1,050원. 매입 좌수는 100만좌다.
  await send(
    svc,
    "infrastructure",
    "recordMockPurchase",
    [id, 1_050_000n, 1_050n, await readBlockTime(svc)],
    "MockPurchaseUpdated",
    record,
  );
}
