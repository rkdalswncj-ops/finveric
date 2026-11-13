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

/**
 * 원장 오류 이름과 이유, 다음 행동. 판매사 API의 오류 문장과 판매사 콘솔이 쓴다(합니다체).
 * 고객에게는 `CUSTOMER_LEDGER_ERRORS`를 쓴다.
 */
export const LEDGER_ERRORS = {
  Unauthorized:
    "권한이 없는 계정이거나 승인 서명이 맞지 않습니다. 역할 키와 관리자 승인을 확인하세요.",
  InvalidVersion:
    "등록하지 않았거나 최신이 아닌 기준·상품 버전입니다. 최신 버전으로 다시 신청하세요.",
  InvalidState:
    "현재 단계에서 할 수 없는 요청입니다. 판매 건을 다시 읽어 상태를 확인하세요.",
  InvalidProof:
    "진단 증명이 공개 기록과 맞지 않습니다. 진단을 다시 요청하세요.",
  InvalidAttempt:
    "진단 회차가 맞지 않습니다. 이미 기록한 회차는 바꿀 수 없습니다. 새 회차로 진단하세요.",
  MissingRecords:
    "필수 확인 기록이 빠졌습니다. 설명 시간, 추가 위험 확인, 녹취 동의, 관리자 승인을 확인하세요.",
  TooEarly:
    "숙려기간이 아직 지나지 않았습니다. 숙려기간이 끝난 뒤 다시 요청하세요.",
} as const;
export type LedgerError = keyof typeof LEDGER_ERRORS;

/**
 * 같은 원장 오류를 고객에게 알리는 문장(해요체). 증권사 앱 예시가 쓴다.
 * 원장·서명·증명·거래 같은 말과 판매사 콘솔에서만 할 수 있는 안내를 쓰지 않는다.
 */
export const CUSTOMER_LEDGER_ERRORS: Readonly<Record<LedgerError, string>> = {
  Unauthorized:
    "가입 확인 정보가 맞지 않아요. 계속 안 되면 판매사에 문의해 주세요.",
  InvalidVersion:
    "상품 설명서나 진단 기준이 바뀌었어요. 상품을 다시 골라 새로 가입해 주세요.",
  InvalidState:
    "지금 단계에서는 할 수 없는 요청이에요. 내 가입에서 상태를 확인해 주세요.",
  InvalidProof:
    "진단 결과를 확인하지 못했어요. 투자성향 진단을 다시 해 주세요.",
  InvalidAttempt: "진단 기록이 맞지 않아요. 투자성향 진단을 다시 해 주세요.",
  MissingRecords:
    "필요한 확인이 빠졌어요. 앞 단계의 확인란을 다시 확인해 주세요.",
  TooEarly:
    "숙려기간이 아직 끝나지 않았어요. 남은 시간이 지나면 다시 눌러 주세요.",
};
