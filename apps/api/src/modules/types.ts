import type { Hex, TransactionSerializedEIP1559 } from "viem";
import type { SaleRecord, Trace } from "../../../../packages/core/src/index.ts";

// 서버 안에서만 쓰는 저장 형식. API 요청·응답 형식은 packages/core/src/api.ts에 있다.

/** 서버만 보관하는 처리 기록. 서명한 가입 거래 원문은 공개하지 않는다. */
export type StoredTrace = Trace & {
  rawTransaction?: TransactionSerializedEIP1559;
};

/** 서버가 보관하는 판매 건. 답변·임의값·준법 서명을 포함한다. */
export type StoredSale = Omit<SaleRecord, "traces"> & {
  productId: Hex;
  traces: StoredTrace[];
  reviewSignature?: Hex;
};
