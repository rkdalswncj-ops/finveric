// 원장 v5 ABI. contracts/src/FundLedger.sol과 같아야 한다. tests/core.test.ts가 Foundry 산출물과 대조한다.
import { parseAbi } from "viem";

export const ledgerAbi = parseAbi([
  "struct ProductVersion { bytes32 documentHash; uint8 riskGrade; bool complex; bool derivative; uint64 registeredAt; }",
  "struct Diagnosis { uint256 ruleHash; uint256 commitment; uint8 profile; uint8 limit; bool elderly; uint64 recordedAt; }",
  "struct Sale { uint256 customerRef; bytes32 productId; bytes32 recordingHash; uint256 amount; uint32 productVersion; uint32 attempt; uint32 explanationSeconds; bool suitable; bool protectedSale; bool higherRiskConfirmed; bool approved; uint8 status; uint64 subscribedAt; uint64 confirmedAt; uint64 withdrawnAt; uint64 settledAt; }",
  "function FIELD() view returns (uint256)",
  "function ledgerVersion() view returns (uint256)",
  "function verifier() view returns (address)",
  "function seller() view returns (address)",
  "function approver() view returns (address)",
  "function customer() view returns (address)",
  "function infrastructure() view returns (address)",
  "function coolingPeriod() view returns (uint64)",
  "function rules(uint256 ruleHash) view returns (bool registered, uint32 version, uint64 registeredAt)",
  "function ruleCount() view returns (uint32)",
  "function latestProductVersion(bytes32 productId) view returns (uint32)",
  "function attemptCount(uint256 customerRef) view returns (uint32)",
  "function getSale(uint256 saleId) view returns (Sale)",
  "function getDiagnosis(uint256 customerRef, uint32 attempt) view returns (Diagnosis)",
  "function getProduct(bytes32 productId, uint32 version) view returns (ProductVersion)",
  "function registerRule(uint256 ruleHash, uint32 version, string document)",
  "function registerProduct(bytes32 productId, string document, uint8 riskGrade, bool complex, bool derivative)",
  "function recordDiagnosis(uint256 customerRef, uint32 attempt, uint256 ruleHash, uint256 commitment, uint8 profile, uint8 limit, bool elderly, uint256[8] proof)",
  "function subscribe(uint256 saleId, uint256 customerRef, bytes32 productId, uint32 productVersion, uint32 attempt, uint32 explanationSeconds, bool higherRiskConfirmed, bytes32 recordingHash, uint256 amount, bytes approval)",
  "function confirm(uint256 saleId)",
  "function withdraw(uint256 saleId)",
  "function recordSettlement(uint256 saleId)",
  "event RuleRegistered(uint256 indexed ruleHash, uint32 version, string document)",
  "event ProductRegistered(bytes32 indexed productId, uint32 version, bytes32 documentHash, uint8 riskGrade, bool complex, bool derivative, string document)",
  "event DiagnosisRecorded(uint256 indexed customerRef, uint32 indexed attempt, uint256 ruleHash, uint256 commitment, uint8 profile, uint8 limit, bool elderly)",
  "event SaleSubscribed(uint256 indexed saleId, uint256 indexed customerRef, bytes32 productId, uint32 productVersion, uint32 attempt, bool suitable, bool protectedSale, uint256 amount, uint32 explanationSeconds)",
  "event HigherRiskConfirmed(uint256 indexed saleId)",
  "event ManagerApproved(uint256 indexed saleId, uint32 attempt)",
  "event RecordingAttached(uint256 indexed saleId, bytes32 recordingHash)",
  "event EnrollmentConfirmed(uint256 indexed saleId, uint256 indexed customerRef)",
  "event SaleWithdrawn(uint256 indexed saleId)",
  "event SettlementRecorded(uint256 indexed saleId, uint256 amount)",
  "error Unauthorized()",
  "error InvalidVersion()",
  "error InvalidState()",
  "error InvalidProof()",
  "error InvalidAttempt()",
  "error MissingRecords()",
  "error TooEarly()",
]);

export const verifierAbi = parseAbi([
  "function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[9] signals) view returns (bool)",
]);

/** 원장 오류 이름과 화면에 보여 줄 이유. */
export const LEDGER_ERRORS = {
  Unauthorized: "권한이 없는 계정이거나 승인 서명이 맞지 않아요.",
  InvalidVersion: "등록하지 않았거나 최신이 아닌 기준·상품 버전이에요.",
  InvalidState: "현재 단계에서 할 수 없는 요청이에요.",
  InvalidProof: "진단 증명이 공개 기록과 맞지 않아요.",
  InvalidAttempt:
    "진단 회차가 맞지 않아요. 이미 기록한 회차는 다시 쓸 수 없어요.",
  MissingRecords: "필수 확인 기록이 빠졌어요.",
  TooEarly: "숙려기간이 아직 지나지 않았어요.",
} as const;
export type LedgerError = keyof typeof LEDGER_ERRORS;
