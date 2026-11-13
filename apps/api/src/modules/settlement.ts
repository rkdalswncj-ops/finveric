// 기존 업무 인프라: 확정한 가입의 모의 결제 기록. 실제 자금은 움직이지 않는다.
import { CodedError } from "../errors.ts";
import type { FundService } from "../service.ts";
import type { StoredSale } from "../repositories/sales.ts";
import { readSale } from "../gateways/ledger.ts";
import { send } from "./transactions.ts";

export async function settle(svc: FundService, record: StoredSale) {
  const state = await readSale(svc, record.id);
  if (state.settledAt > 0n) return;
  if (state.status !== 2)
    throw new CodedError(
      "최종 확인한 가입만 결제를 기록할 수 있습니다. 판매 건을 다시 읽어 현재 상태를 확인하세요.",
      "wrong_state",
    );
  await send(svc, "infrastructure", "recordSettlement", [BigInt(record.id)], {
    event: "SettlementRecorded",
    match: (log) =>
      log.eventName === "SettlementRecorded" &&
      log.args.saleId === BigInt(record.id),
    sale: record,
  });
}
