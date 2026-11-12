// 감독기관 보고서. 브라우저가 지정 RPC에서 읽은 원장과 판매 건별 독립 검증 결과를 모은다.
import {
  computeSignals,
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  type Deployment,
  type Signal,
} from "../../../../packages/core/src/index.ts";
import type { LedgerSnapshot } from "../../../../packages/core/src/ledger.ts";
import {
  OUTCOME_LABELS,
  verifySale,
  type SaleVerification,
  type VerifyOutcome,
} from "../../../../packages/core/src/verify.ts";
import {
  customerRefs,
  productName,
  saleProduct,
  saleSignals,
  STATUS_LABELS,
} from "./format.ts";

export const REPORT_FORMAT = "finveric-audit-report-v5";
export type ReportScope =
  { kind: "confirmed" } | { kind: "sale"; saleId: string };

export type ReportSale = {
  saleId: string;
  customerRef: string;
  product: string;
  productId: string;
  productVersion: number;
  riskGrade?: number;
  attempt: number;
  suitable: boolean;
  protectedSale: boolean;
  amount: string;
  explanationSeconds: number;
  status: string;
  subscribedAt?: string;
  confirmedAt?: string;
  outcome: VerifyOutcome;
  outcomeLabel: string;
  checks: { name: string; ok: boolean; detail: string }[];
  references: SaleVerification["references"];
  /** 이 판매 건과 그 고객에게 난 위험 신호 종류. */
  signals: string[];
};

export type AuditReport = {
  format: typeof REPORT_FORMAT;
  generatedAt: string;
  generatedBy: string;
  source: {
    chainId: number;
    rpcUrl: string;
    ledger: string;
    verifier: string;
    ledgerVersion: number;
    deploymentBlock: string;
    latestBlock: string;
    ledgerCodeHash: string;
    verifierCodeHash: string;
    sellerApi: false;
  };
  scope: ReportScope;
  summary: {
    rules: number;
    productVersions: number;
    diagnoses: number;
    customers: number;
    sales: Record<"subscribed" | "confirmed" | "withdrawn", number>;
    verified: Record<VerifyOutcome, number>;
    signals: Record<string, number>;
  };
  rules: {
    version: number;
    hash: string;
    hashMatches: boolean;
    registeredAt: string;
    txHash: string;
    block: string;
  }[];
  products: {
    id: string;
    name: string;
    version: number;
    riskGrade: number;
    complex: boolean;
    derivative: boolean;
    documentHash: string;
    matches: boolean;
    registeredAt: string;
    txHash: string;
    block: string;
  }[];
  sales: ReportSale[];
  signals: (Signal & { label: string })[];
};

const iso = (seconds?: number) =>
  seconds ? new Date(seconds * 1000).toISOString() : undefined;

/** 범위 안의 판매 건마다 verifySale을 실행해 보고서를 만든다. 원본 파일은 쓰지 않는다. */
export async function buildReport(
  deployment: Deployment,
  snapshot: LedgerSnapshot,
  scope: ReportScope,
  progress: (done: number, total: number) => void,
): Promise<AuditReport> {
  const targets =
    scope.kind === "sale"
      ? [scope.saleId]
      : snapshot.sales
          .filter((sale) => sale.status === "confirmed")
          .map((sale) => sale.saleId);
  const allSignals = computeSignals(snapshot);
  const scopedSale =
    scope.kind === "sale"
      ? snapshot.sales.find((entry) => entry.saleId === scope.saleId)
      : undefined;
  const scopedSignals =
    scope.kind === "confirmed"
      ? allSignals
      : scopedSale
        ? saleSignals(allSignals, scopedSale)
        : [];
  const verified: Record<VerifyOutcome, number> = {
    match: 0,
    mismatch: 0,
    missing: 0,
  };
  const sales: ReportSale[] = [];
  progress(0, targets.length);
  for (const [index, saleId] of targets.entries()) {
    const result = await verifySale(deployment, saleId, undefined, undefined, {
      snapshot,
    });
    verified[result.outcome]++;
    const sale = result.sale;
    const product = sale && saleProduct(snapshot, sale);
    sales.push({
      saleId,
      customerRef: sale?.customerRef ?? "",
      product: sale
        ? productName(snapshot, sale.productId, sale.productVersion)
        : "",
      productId: sale?.productId ?? "",
      productVersion: sale?.productVersion ?? 0,
      riskGrade: product?.riskGrade,
      attempt: sale?.attempt ?? 0,
      suitable: sale?.suitable ?? false,
      protectedSale: sale?.protectedSale ?? false,
      amount: sale?.amount.toString() ?? "",
      explanationSeconds: sale?.explanationSeconds ?? 0,
      status: sale ? STATUS_LABELS[sale.status] : "기록 없음",
      subscribedAt: iso(sale?.subscribed.at),
      confirmedAt: iso(sale?.confirmed?.at),
      outcome: result.outcome,
      outcomeLabel: OUTCOME_LABELS[result.outcome],
      checks: result.checks,
      references: result.references,
      signals: sale
        ? [
            ...new Set(
              saleSignals(allSignals, sale).map(
                (signal) => SIGNAL_LABELS[signal.kind],
              ),
            ),
          ]
        : [],
    });
    progress(index + 1, targets.length);
  }
  const count = (status: "subscribed" | "confirmed" | "withdrawn") =>
    snapshot.sales.filter((sale) => sale.status === status).length;
  return {
    format: REPORT_FORMAT,
    generatedAt: new Date().toISOString(),
    generatedBy:
      "FINVERIC 감독기관 화면. 이 브라우저가 지정 RPC에서 원장을 읽고 검증했습니다.",
    source: {
      chainId: deployment.chainId,
      rpcUrl: deployment.rpcUrl,
      ledger: deployment.ledger,
      verifier: deployment.verifier,
      ledgerVersion: deployment.ledgerVersion,
      deploymentBlock: deployment.blockNumber,
      latestBlock: snapshot.latestBlock.toString(),
      ledgerCodeHash: deployment.ledgerCodeHash,
      verifierCodeHash: deployment.verifierCodeHash,
      sellerApi: false,
    },
    scope,
    summary: {
      rules: snapshot.rules.length,
      productVersions: snapshot.products.length,
      diagnoses: snapshot.diagnoses.length,
      customers: customerRefs(snapshot).length,
      sales: {
        subscribed: count("subscribed"),
        confirmed: count("confirmed"),
        withdrawn: count("withdrawn"),
      },
      verified,
      signals: Object.fromEntries(
        SIGNAL_KINDS.map((kind) => [
          SIGNAL_LABELS[kind],
          scopedSignals.filter((signal) => signal.kind === kind).length,
        ]),
      ),
    },
    rules: snapshot.rules.map((rule) => ({
      version: rule.version,
      hash: rule.hash,
      hashMatches: rule.hashMatches,
      registeredAt: iso(rule.at) ?? "",
      txHash: rule.txHash,
      block: rule.block.toString(),
    })),
    products: snapshot.products.map((entry) => ({
      id: entry.id,
      name: productName(snapshot, entry.id, entry.version),
      version: entry.version,
      riskGrade: entry.riskGrade,
      complex: entry.complex,
      derivative: entry.derivative,
      documentHash: entry.documentHash,
      matches: entry.matches,
      registeredAt: iso(entry.at) ?? "",
      txHash: entry.txHash,
      block: entry.block.toString(),
    })),
    sales,
    signals: scopedSignals.map((signal) => ({
      ...signal,
      label: SIGNAL_LABELS[signal.kind],
    })),
  };
}

/** 표 계산 프로그램이 수식으로 읽지 않게 첫 글자를 막는다. */
const cell = (value: string | number | boolean | undefined) => {
  const text =
    typeof value === "boolean"
      ? value
        ? "예"
        : "아니요"
      : String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const CSV_COLUMNS = [
  "판매 ID",
  "고객 가명 ID",
  "상품",
  "상품 버전",
  "위험등급",
  "청약 회차",
  "적합",
  "녹취·숙려 대상",
  "설명 확인(초)",
  "금액(원)",
  "상태",
  "청약 시각",
  "확정 시각",
  "대조 결과",
  "확인 필요 항목",
  "위험 신호",
] as const;

/** 판매 건 한 줄씩. Excel이 한글을 읽도록 BOM을 붙인다. */
export function reportCsv(report: AuditReport) {
  const rows = report.sales.map((sale) => [
    sale.saleId,
    sale.customerRef,
    sale.product,
    sale.productVersion,
    sale.riskGrade,
    sale.attempt,
    sale.suitable,
    sale.protectedSale,
    sale.explanationSeconds,
    sale.amount,
    sale.status,
    sale.subscribedAt,
    sale.confirmedAt,
    sale.outcomeLabel,
    sale.checks
      .filter((check) => !check.ok)
      .map((check) => check.name)
      .join("; "),
    sale.signals.join("; "),
  ]);
  return `﻿${[CSV_COLUMNS, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

/** 문자열 파일을 내려받는다. JSON은 packages/ui의 saveFile을 쓴다. */
export function saveText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
