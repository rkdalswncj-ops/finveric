// 관리자 승인: 세 번째 진단부터 판매사 관리자가 모든 회차를 검토하고 서명한다.
// 서명은 원장 거래 없이 보관하고, 고객의 가입 확정 거래에 함께 담는다.
import { reviewDigest } from "../../../../packages/core/src/index.ts";
import type { FundService } from "../service.ts";
import type { StoredSale } from "../repositories/sales.ts";
import { ensureDraft, preparedProof } from "./enrollment.ts";
import { requireProduct } from "./products.ts";

export async function review(svc: FundService, record: StoredSale) {
  ensureDraft(record);
  if (record.attempts.length < 3)
    throw new Error("세 번째 진단부터 검토할 수 있어요.");
  if (record.reviewSignature) return;
  const proofs = await Promise.all(
    record.attempts.map((attempt) => preparedProof(attempt)),
  );
  record.reviewSignature = await svc.env.accounts.compliance.signMessage({
    message: {
      raw: reviewDigest(
        svc.dep,
        record.id,
        proofs,
        requireProduct(record.productId),
      ),
    },
  });
  svc.repository.save();
}
