// 운용사·판매사: 상품·설명서 버전과 진단 규칙 등록.
import type { Hex } from "viem";
import {
  PRODUCTS,
  RULE_HASH,
  type Product,
} from "../../../../packages/core/src/index.ts";
import type { RegisterResponse } from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";
import { readProduct, readRule } from "../gateways/ledger.ts";
import { send } from "./transactions.ts";

export function requireProduct(id: Hex): Product {
  const product = PRODUCTS.find((entry) => entry.id === id.toLowerCase());
  if (!product) throw new Error("가입할 수 있는 펀드를 선택해 주세요.");
  return product;
}

/** 상품의 설명서와 진단 규칙 v3이 원장에 등록되어 있는지 확인한다. */
export async function isRegistered(svc: FundService, product: Product) {
  const [{ documentHash, minimumProfile }, rule] = await Promise.all([
    readProduct(svc, product.id),
    readRule(svc),
  ]);
  return (
    documentHash === product.documentHash &&
    minimumProfile === product.minimumProfile &&
    rule
  );
}

/**
 * 운용사가 세 상품의 설명서를, 판매사가 진단 규칙 v3을 원장에 등록한다.
 * 이미 같은 값이 있으면 거래를 보내지 않는다. 다른 값이 있으면 거절한다.
 */
export async function register(svc: FundService): Promise<RegisterResponse> {
  const registrations = await Promise.all(
    PRODUCTS.map((product) => readProduct(svc, product.id)),
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
  if (!(await readRule(svc)))
    await send(svc, "seller", "registerRule", [RULE_HASH], "RuleRegistered");
  return { documentHash: PRODUCTS[0].documentHash, ruleHash: RULE_HASH };
}
