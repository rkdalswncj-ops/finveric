// 판매 채널: 신청(초안), 중단, 적합성·설명·청약, 숙려 뒤 최종 확인, 철회.
import {
  DEMO_AMOUNT,
  isProtectedSale,
  isSuitable,
  productDisplayName,
  recordingHash,
  type MockRecording,
  type Product,
} from "../../../../packages/core/src/index.ts";
import type {
  OpenSaleRequest,
  SaleView,
  SubscribeRequest,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";
import type { StoredSale } from "../repositories/sales.ts";
import {
  readAttemptCount,
  readDiagnosis,
  readLatestProductVersion,
  readSale,
} from "../gateways/ledger.ts";
import { randomField } from "../gateways/proofs.ts";
import { customerRef } from "./customers.ts";
import { latestProduct, storedProduct } from "./products.ts";
import { publicSale } from "./records.ts";
import { note, send } from "./transactions.ts";

/** 원장에 청약 기록이 없고 중단하지 않은 신청인지 확인한다. */
export async function ensureDraft(svc: FundService, record: StoredSale) {
  if (record.abandonedAt)
    throw new Error("중단한 신청이에요. 새로 신청해 주세요.");
  if ((await readSale(svc, record.id)).status !== 0)
    throw new Error("이미 청약한 신청이에요.");
}

/** 고객과 상품의 최신 버전으로 신청(초안)을 만든다. 원장 거래는 없다. */
export async function open(
  svc: FundService,
  { productId, customerNo }: OpenSaleRequest,
): Promise<SaleView> {
  const product = await latestProduct(svc, productId);
  const record: StoredSale = {
    id: randomField(),
    customerRef: customerRef(svc, customerNo),
    productId: product.id,
    productVersion: product.version,
    amount: DEMO_AMOUNT,
    createdAt: new Date().toISOString(),
    traces: [],
  };
  svc.repository.add(record);
  return publicSale(svc, record);
}

/** 청약 전 신청을 중단한다. 진단 회차는 원장에 그대로 남는다. */
export async function abandon(
  svc: FundService,
  record: StoredSale,
): Promise<void> {
  if (record.abandonedAt) return;
  await ensureDraft(svc, record);
  record.abandonedAt = new Date().toISOString();
  note(
    svc,
    { source: "판매 채널", action: "가입 중단", status: "confirmed" },
    record,
  );
}

/** 모의 녹취록. 실제 녹취 대신 시연 문장을 만든다. 고객 번호는 넣지 않는다. */
function mockRecording(record: StoredSale, product: Product): MockRecording {
  const { document } = product;
  return {
    name: `recording-${record.id.slice(0, 12)}.txt`,
    text: [
      "[모의 녹취록 · 시연용]",
      `일시: ${new Date().toISOString()}`,
      `판매 ID: ${record.id}`,
      `고객 가명 ID: ${record.customerRef}`,
      `상품: ${productDisplayName(document)} v${product.version}`,
      `판매 직원: ${document.seller} 판매 채널`,
      `직원: 이 상품의 위험등급은 ${document.riskGrade}등급입니다. 최대 손실은 ${document.maxLoss}입니다.`,
      `직원: ${document.cards[0]?.text ?? ""}`,
      "직원: 청약 뒤 숙려기간이 지나야 최종 확인할 수 있습니다. 그전에 철회할 수 있습니다.",
      "고객: 설명을 듣고 이해했습니다. 녹취에 동의합니다.",
    ].join("\n"),
  };
}

/**
 * 청약. 최신 회차와 상품 최신 버전으로 적합성을 계산하고 필요한 확인 기록을 고객 키로 보낸다.
 * 원장이 같은 조건을 다시 검사한다.
 */
export async function subscribe(
  svc: FundService,
  record: StoredSale,
  request: SubscribeRequest,
): Promise<void> {
  if ((await readSale(svc, record.id)).status !== 0) return;
  await ensureDraft(svc, record);
  if (
    (await readLatestProductVersion(svc, record.productId)) !==
    record.productVersion
  )
    throw new Error(
      "상품 설명서가 새 버전으로 바뀌었어요. 새로 신청해 주세요.",
    );
  const product = storedProduct(svc, record.productId, record.productVersion);
  const attempt = await readAttemptCount(svc, record.customerRef);
  if (attempt === 0) throw new Error("투자성향 진단을 먼저 해 주세요.");
  const diagnosis = await readDiagnosis(svc, record.customerRef, attempt);
  const suitable = isSuitable(product.document.riskGrade, diagnosis.limit);
  const protectedSale = isProtectedSale(product.document, diagnosis, suitable);
  if (!suitable && !request.higherRiskConfirmed)
    throw new Error(
      "투자성향에 맞지 않는 상품이에요. 고객이 원하면 부적합 사실을 알리고 추가 위험 확인을 받아 주세요.",
    );
  if (attempt >= 3 && record.approval?.attempt !== attempt)
    throw new Error(
      `관리자 승인이 필요해요. ${attempt}회차 진단이라 소비자보호 담당이 회차 이력을 보고 승인해야 해요.`,
    );
  if (protectedSale && !request.recordingConsent)
    throw new Error(
      "녹취 대상 상품이에요. 녹취에 동의하지 않으면 가입할 수 없어요.",
    );
  const recording = protectedSale ? mockRecording(record, product) : undefined;
  record.explanationSeconds = request.explanationSeconds;
  record.recording = recording;
  svc.repository.save();
  await send(
    svc,
    "customer",
    "subscribe",
    [
      BigInt(record.id),
      BigInt(record.customerRef),
      record.productId,
      record.productVersion,
      attempt,
      request.explanationSeconds,
      !suitable,
      recording ? recordingHash(recording.text) : `0x${"0".repeat(64)}`,
      BigInt(record.amount),
      attempt >= 3 ? record.approval!.signature : "0x",
    ],
    {
      event: "SaleSubscribed",
      match: (log) =>
        log.eventName === "SaleSubscribed" &&
        log.args.saleId === BigInt(record.id),
      sale: record,
    },
  );
}

/** 최종 확인. 녹취·숙려 대상이면 원장이 최소 경과 시간 전의 확인을 거절한다(TooEarly). */
export async function confirm(svc: FundService, record: StoredSale) {
  const state = await readSale(svc, record.id);
  if (state.status === 2) return;
  if (state.status !== 1)
    throw new Error("청약한 신청만 최종 확인할 수 있어요.");
  await send(svc, "customer", "confirm", [BigInt(record.id)], {
    event: "EnrollmentConfirmed",
    match: (log) =>
      log.eventName === "EnrollmentConfirmed" &&
      log.args.saleId === BigInt(record.id),
    sale: record,
  });
}

/** 숙려기간 중 철회. */
export async function withdraw(svc: FundService, record: StoredSale) {
  const state = await readSale(svc, record.id);
  if (state.status === 3) return;
  if (state.status !== 1)
    throw new Error("최종 확인 전의 청약만 철회할 수 있어요.");
  await send(svc, "customer", "withdraw", [BigInt(record.id)], {
    event: "SaleWithdrawn",
    match: (log) =>
      log.eventName === "SaleWithdrawn" &&
      log.args.saleId === BigInt(record.id),
    sale: record,
  });
}
