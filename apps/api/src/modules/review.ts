// 관리자 승인: 3회차 이상 진단한 고객의 청약 전에 소비자보호 담당이 회차 이력을 보고 서명한다.
// 서명은 원장 거래 없이 보관하고, 고객의 청약 거래에 함께 담는다. 원장이 승인자 키로 확인한다.
import { approvalDigest } from "@finveric/core";
import { CodedError } from "../errors.ts";
import type { FundService } from "../service.ts";
import type { StoredSale } from "../repositories/sales.ts";
import { readAttemptCount, signApproval } from "../gateways/ledger.ts";
import { ensureDraft } from "./enrollment.ts";
import { note } from "./transactions.ts";

export async function approve(svc: FundService, record: StoredSale) {
  await ensureDraft(svc, record);
  const attempt = await readAttemptCount(svc, record.customerRef);
  if (attempt < 3) throw new CodedError("APPROVAL_NOT_NEEDED");
  if (record.approval?.attempt === attempt) return;
  record.approval = {
    attempt,
    signature: await signApproval(
      svc,
      approvalDigest(svc.dep, record.id, record.customerRef, attempt),
    ),
  };
  note(
    svc,
    {
      source: "approver",
      action: "관리자 승인 서명",
      status: "confirmed",
      detail: { attempt },
    },
    record,
  );
}
