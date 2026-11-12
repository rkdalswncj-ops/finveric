// 운용사·판매사: 상품·설명서 버전과 진단 규칙 등록.
import type { Hex } from "viem";
import {
  ledgerAbi,
  PRODUCTS,
  RULE_HASH,
  type Product,
} from "../../../../packages/core/src/index.ts";
import type { RegisterResponse } from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";
import { send } from "./ledger.ts";

export function requireProduct(id: Hex): Product {
  const product = PRODUCTS.find((entry) => entry.id === id.toLowerCase());
  if (!product) throw new Error("가입할 수 있는 펀드를 선택해 주세요.");
  return product;
}

/** 원장에 등록된 상품의 설명서 지문과 기준 투자성향. 등록 전이면 기준 투자성향이 0이다. */
export async function productRegistration(svc: FundService, productId: Hex) {
  const call = {
    address: svc.dep.ledger,
    abi: ledgerAbi,
    args: [productId],
  } as const;
  const [documentHash, minimumProfile] = await Promise.all([
    svc.client.readContract({ ...call, functionName: "documents" }),
    svc.client.readContract({ ...call, functionName: "minimumProfiles" }),
  ]);
  return { documentHash, minimumProfile };
}

/**
 * 운용사가 세 상품의 설명서를, 판매사가 진단 규칙 v3을 원장에 등록한다.
 * 이미 같은 값이 있으면 거래를 보내지 않는다. 다른 값이 있으면 거절한다.
 */
export async function register(svc: FundService): Promise<RegisterResponse> {
  const registrations = await Promise.all(
    PRODUCTS.map((product) => productRegistration(svc, product.id)),
  );
  for (const [index, product] of PRODUCTS.entries()) {
    const { documentHash, minimumProfile } = registrations[index];
    if (minimumProfile === 0) {
      await send(
        svc,
        "manager",
        "registerProduct",
        [product.id, product.documentHash, product.minimumProfile],
        "ProductRegistered",
      );
    } else if (
      documentHash !== product.documentHash ||
      minimumProfile !== product.minimumProfile
    ) {
      throw new Error("이미 등록한 상품의 설명서나 위험 기준이 달라요.");
    }
  }
  const rule = await svc.client.readContract({
    address: svc.dep.ledger,
    abi: ledgerAbi,
    functionName: "rules",
    args: [RULE_HASH],
  });
  if (!rule)
    await send(svc, "seller", "registerRule", [RULE_HASH], "RuleRegistered");
  return { documentHash: PRODUCTS[0].documentHash, ruleHash: RULE_HASH };
}
