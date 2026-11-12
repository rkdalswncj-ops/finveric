// 판매 채널: 가입 신청, 투자성향 진단, 최종 확인과 가입 거래, 가입 중단.
import { randomUUID } from "node:crypto";
import { encodeFunctionData, type Hex } from "viem";
import {
  ledgerAbi,
  PRODUCT_ID,
  FIELD,
  RULE_HASH,
  classifyProfile,
  diagnosisCommitment,
  type Diagnosis,
  type PreparedProof,
  type Trace,
} from "../../../../packages/core/src/index.ts";
import type {
  AbandonResponse,
  ConfirmRequest,
  DiagnoseRequest,
  DiagnoseView,
  OpenSaleResponse,
  SaleView,
} from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";
import type { StoredSale, StoredTrace } from "../repositories/sales.ts";
import {
  broadcast,
  getReceipt,
  signTransaction,
  waitForReceipt,
} from "../gateways/ledger.ts";
import {
  prove,
  randomField,
  solidityProof,
  validateAnswers,
} from "../gateways/proofs.ts";
import { isRegistered, requireProduct } from "./products.ts";
import { enrollmentTrace, publicSale } from "./records.ts";
import { reconcile, recordEnrollmentReceipt } from "./transactions.ts";

/** 가입 거래를 보내기 전의 임시 신청인지 확인한다. */
export function ensureDraft(record: StoredSale) {
  const enrollment = enrollmentTrace(record);
  if (enrollment?.status === "pending")
    throw new Error("가입 요청을 처리하고 있어요. 거래 결과를 확인해 주세요.");
  if (enrollment?.status === "confirmed")
    throw new Error("이미 완료한 가입 신청이에요.");
}

/** 확인한 진단 회차의 증명을 원장 호출 형식으로 바꾼다. */
export async function preparedProof(
  diagnosis: Diagnosis,
): Promise<PreparedProof> {
  if (!diagnosis.confirmed || !diagnosis.proof || !diagnosis.publicSignals)
    throw new Error("진단 결과를 먼저 확인해 주세요.");
  const [a, b, c, signals] = await solidityProof(
    diagnosis.proof,
    diagnosis.publicSignals,
  );
  return { a, b, c, signals };
}

/** 서명한 가입 거래의 영수증을 기다린다. 영수증이 없으면 같은 거래를 다시 보낸다. */
async function settleEnrollment(
  svc: FundService,
  record: StoredSale,
  trace: StoredTrace,
): Promise<SaleView> {
  const { txHash, rawTransaction } = trace;
  if (!txHash || !rawTransaction)
    throw new Error("제출한 가입 거래를 찾을 수 없어요.");
  let receipt = await getReceipt(svc, txHash).catch(() => undefined);
  if (!receipt) {
    // A retry broadcasts the exact same signed transaction with the same hash and nonce.
    await broadcast(svc, rawTransaction).catch(() => undefined);
    receipt = await waitForReceipt(svc, txHash, {
      checkReplacement: false,
    }).catch(() => undefined);
  }
  if (!receipt)
    throw new Error(
      "가입 거래를 확인하고 있어요. 같은 신청에서 다시 확인해 주세요.",
    );
  recordEnrollmentReceipt(svc, record, trace, receipt);
  svc.repository.save();
  if (trace.status !== "confirmed")
    throw new Error(
      "가입 거래가 실패했어요. 온체인 처리 기록을 확인해 주세요.",
    );
  return publicSale(svc, record);
}

/** 새 판매 ID로 임시 가입 신청을 만든다. 상품과 진단 규칙이 원장에 등록되어 있어야 한다. */
export async function open(
  svc: FundService,
  productId: Hex = PRODUCT_ID,
): Promise<OpenSaleResponse> {
  const product = requireProduct(productId);
  if (!(await isRegistered(svc, product)))
    throw new Error(
      "관리자 화면에서 이 상품과 진단 규칙 v3를 먼저 등록하세요.",
    );
  const record: StoredSale = {
    id: randomField(),
    productId: product.id,
    amount: 1_050_000,
    createdAt: new Date().toISOString(),
    attempts: [],
    traces: [],
  };
  svc.repository.add(record);
  return { id: record.id };
}

/** 진단 한 회차를 기록하고 Groth16 증명을 만든다. 원장 거래는 보내지 않는다. */
export async function diagnose(
  svc: FundService,
  id: string,
  { loss, experience, salt }: DiagnoseRequest,
): Promise<DiagnoseView> {
  const answers = { loss, experience };
  validateAnswers(answers);
  if (!/^[1-9][0-9]{0,76}$/.test(salt) || BigInt(salt) >= FIELD)
    throw new Error("진단에 사용할 임의값을 확인해 주세요.");
  const record = svc.repository.find(id);
  const product = requireProduct(record.productId);
  ensureDraft(record);
  const previous = record.attempts.find((attempt) => attempt.salt === salt);
  if (previous) {
    if (
      previous !== record.attempts.at(-1) ||
      previous.answers.loss !== loss ||
      previous.answers.experience !== experience
    )
      throw new Error("이전 진단의 임의값이에요. 새 진단을 시작해 주세요.");
    return {
      ...(await publicSale(svc, record)),
      preparedProof: await preparedProof(previous),
    };
  }
  const round = record.attempts.length + 1;
  if (round > 10)
    throw new Error("시연은 가입 신청당 최대 10회 진단할 수 있어요.");
  const commitment = diagnosisCommitment(answers, salt, {
    chainId: svc.dep.chainId,
    ledger: svc.dep.ledger,
    id,
    round,
    documentHash: product.documentHash,
  }).toString();
  const trace: Trace = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source: "Groth16 · BN254",
    action: "증명 생성",
    status: "pending",
  };
  svc.repository.addTrace(trace, record);
  try {
    const result = await prove(
      answers,
      salt,
      commitment,
      svc.dep,
      id,
      round,
      product.documentHash,
    );
    const profile = classifyProfile(answers);
    if (BigInt(result.publicSignals[0]) !== BigInt(profile))
      throw new Error("진단 결과가 일치하지 않아요.");
    const diagnosis: Diagnosis = {
      round,
      answers,
      salt,
      commitment,
      profile,
      proof: result.proof,
      publicSignals: result.publicSignals,
      confirmed: true,
    };
    const prepared = await preparedProof(diagnosis);
    record.attempts.push(diagnosis);
    delete record.reviewSignature;
    trace.status = "confirmed";
    trace.detail = {
      publicSignals: result.publicSignals,
      protocol: "groth16",
      curve: "bn128",
    };
    svc.repository.save();
    return { ...(await publicSale(svc, record)), preparedProof: prepared };
  } catch {
    trace.status = "failed";
    svc.repository.save();
    throw new Error("진단 증명을 만들지 못했어요. 다시 시도해 주세요.");
  }
}

/**
 * 고객의 최종 확인. 모든 회차의 증명, 설명 확인, 필요한 추가 위험 확인과 준법 서명을
 * 테스트 고객 키로 서명한 거래 한 건에 담아 보낸다.
 */
export async function confirm(
  svc: FundService,
  id: string,
  confirmation: ConfirmRequest,
): Promise<SaleView> {
  const record = svc.repository.find(id);
  const product = requireProduct(record.productId);
  const last = record.attempts.at(-1);
  if (!last?.confirmed || last.profile === undefined)
    throw new Error("진단 기록을 먼저 확인하세요.");
  if (
    confirmation.round !== last.round ||
    confirmation.commitment !== last.commitment ||
    confirmation.profile !== last.profile
  )
    throw new Error(
      "확인한 답변 또는 진단 결과가 현재 신청과 달라요. 진단 결과를 다시 확인해 주세요.",
    );
  if (confirmation.explanationAccepted !== true)
    throw new Error("상품 설명과 원금 손실 가능성을 확인해 주세요.");
  const higherRisk = last.profile < product.minimumProfile;
  if (higherRisk && !confirmation.higherRiskAccepted)
    throw new Error(
      "투자성향보다 위험이 높은 상품의 추가 안내를 확인해 주세요.",
    );
  if (last.round >= 3 && !record.reviewSignature)
    throw new Error("세 번째 진단부터는 준법 담당자의 검토가 필요해요.");
  await reconcile(svc);
  const existing = enrollmentTrace(record);
  if (existing?.status === "confirmed") return publicSale(svc, record);
  if (existing?.status === "pending")
    return settleEnrollment(svc, record, existing);
  if (
    svc.repository
      .all()
      .some((sale) => enrollmentTrace(sale)?.status === "pending")
  )
    throw new Error(
      "다른 가입 거래를 확인하고 있어요. 잠시 후 다시 시도해 주세요.",
    );
  const proofs = await Promise.all(
    record.attempts.map((attempt) => preparedProof(attempt)),
  );
  const data = encodeFunctionData({
    abi: ledgerAbi,
    functionName: "completeEnrollment",
    args: [
      BigInt(id),
      product.id,
      product.documentHash,
      RULE_HASH,
      proofs,
      true,
      higherRisk,
      record.reviewSignature ?? "0x",
    ],
  });
  const { rawTransaction, txHash } = await signTransaction(
    svc,
    "customer",
    data,
    5_000_000n,
  );
  const trace: StoredTrace = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source: "customer",
    action: "completeEnrollment",
    status: "pending",
    rawTransaction,
    txHash,
  };
  svc.repository.addTrace(trace, record);
  return settleEnrollment(svc, record, trace);
}

/** 가입을 중단하고 임시 기록을 폐기한다. 원장에는 아무것도 남지 않는다. */
export async function abandon(
  svc: FundService,
  record: StoredSale,
): Promise<AbandonResponse> {
  await reconcile(svc);
  ensureDraft(record);
  svc.repository.remove(record);
  return { id: record.id, abandoned: true };
}
