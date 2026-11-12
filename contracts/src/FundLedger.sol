// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[9] calldata signals
    ) external view returns (bool);
}

/// @notice 판매 기록 원장 v5. 진단 기준과 상품 버전을 등록하고, 진단 회차·청약·최종 확인을 단계마다 기록한다.
/// 기록을 고치거나 지우는 함수는 없다. 시연용이다. 자금은 움직이지 않는다.
contract FundLedger {
    uint256 public constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ledgerVersion = 5;
    string private constant APPROVAL_DOMAIN = "FINVERIC_APPROVAL_V5";
    uint256 private constant MAX_CANONICAL_S =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    IVerifier public immutable verifier;
    address public immutable seller;
    address public immutable approver;
    address public immutable customer;
    address public immutable infrastructure;
    /// @notice 녹취·숙려 대상의 청약 뒤 최종 확인까지 최소 경과 시간(초).
    uint64 public immutable coolingPeriod;

    enum Status {
        None,
        Subscribed,
        Confirmed,
        Withdrawn
    }

    struct Rule {
        bool registered;
        uint32 version;
        uint64 registeredAt;
    }

    struct ProductVersion {
        bytes32 documentHash;
        uint8 riskGrade;
        bool complex;
        bool derivative;
        uint64 registeredAt;
    }

    struct Diagnosis {
        uint256 ruleHash;
        uint256 commitment;
        uint8 profile;
        uint8 limit;
        bool elderly;
        uint64 recordedAt;
    }

    struct Sale {
        uint256 customerRef;
        bytes32 productId;
        bytes32 recordingHash;
        uint256 amount;
        uint32 productVersion;
        uint32 attempt;
        uint32 explanationSeconds;
        bool suitable;
        bool protectedSale;
        bool higherRiskConfirmed;
        bool approved;
        Status status;
        uint64 subscribedAt;
        uint64 confirmedAt;
        uint64 withdrawnAt;
        uint64 settledAt;
    }

    mapping(uint256 => Rule) public rules;
    uint32 public ruleCount;
    mapping(bytes32 => uint32) public latestProductVersion;
    mapping(bytes32 => mapping(uint32 => ProductVersion)) private products;
    mapping(uint256 => uint32) public attemptCount;
    mapping(uint256 => mapping(uint32 => Diagnosis)) private diagnoses;
    mapping(uint256 => Sale) private sales;

    event RuleRegistered(uint256 indexed ruleHash, uint32 version, string document);
    event ProductRegistered(
        bytes32 indexed productId,
        uint32 version,
        bytes32 documentHash,
        uint8 riskGrade,
        bool complex,
        bool derivative,
        string document
    );
    event DiagnosisRecorded(
        uint256 indexed customerRef,
        uint32 indexed attempt,
        uint256 ruleHash,
        uint256 commitment,
        uint8 profile,
        uint8 limit,
        bool elderly
    );
    event SaleSubscribed(
        uint256 indexed saleId,
        uint256 indexed customerRef,
        bytes32 productId,
        uint32 productVersion,
        uint32 attempt,
        bool suitable,
        bool protectedSale,
        uint256 amount,
        uint32 explanationSeconds
    );
    event HigherRiskConfirmed(uint256 indexed saleId);
    event ManagerApproved(uint256 indexed saleId, uint32 attempt);
    event RecordingAttached(uint256 indexed saleId, bytes32 recordingHash);
    event EnrollmentConfirmed(uint256 indexed saleId, uint256 indexed customerRef);
    event SaleWithdrawn(uint256 indexed saleId);
    event SettlementRecorded(uint256 indexed saleId, uint256 amount);

    error Unauthorized();
    error InvalidVersion();
    error InvalidState();
    error InvalidProof();
    error InvalidAttempt();
    error MissingRecords();
    error TooEarly();

    constructor(
        address verifier_,
        address seller_,
        address approver_,
        address customer_,
        address infrastructure_,
        uint64 coolingPeriod_
    ) {
        require(verifier_.code.length > 0, "Verifier missing");
        address[4] memory roles = [seller_, approver_, customer_, infrastructure_];
        for (uint256 i; i < roles.length; i++) {
            require(roles[i] != address(0), "Zero role");
            for (uint256 j; j < i; j++) {
                require(roles[i] != roles[j], "Roles must differ");
            }
        }
        verifier = IVerifier(verifier_);
        seller = seller_;
        approver = approver_;
        customer = customer_;
        infrastructure = infrastructure_;
        coolingPeriod = coolingPeriod_;
    }

    modifier only(address actor) {
        if (msg.sender != actor) revert Unauthorized();
        _;
    }

    // ── 0. 기준 등록 (판매사 키) ─────────────────────────────────

    /// @notice 진단 기준을 다음 버전으로 등록한다. 감독기관은 원문으로 기준 해시를 다시 계산한다.
    function registerRule(uint256 ruleHash, uint32 version, string calldata document) external only(seller) {
        if (
            ruleHash == 0 || ruleHash >= FIELD || rules[ruleHash].registered || version != ruleCount + 1
                || bytes(document).length == 0
        ) revert InvalidVersion();
        rules[ruleHash] = Rule(true, version, uint64(block.timestamp));
        ruleCount = version;
        emit RuleRegistered(ruleHash, version, document);
    }

    /// @notice 상품 설명서를 다음 버전으로 등록한다. 지문은 원장이 원문에서 계산한다.
    function registerProduct(
        bytes32 productId,
        string calldata document,
        uint8 riskGrade,
        bool complex,
        bool derivative
    ) external only(seller) {
        if (productId == bytes32(0) || bytes(document).length == 0 || riskGrade == 0 || riskGrade > 6) {
            revert InvalidVersion();
        }
        uint32 version = latestProductVersion[productId] + 1;
        bytes32 documentHash = keccak256(bytes(document));
        products[productId][version] =
            ProductVersion(documentHash, riskGrade, complex, derivative, uint64(block.timestamp));
        latestProductVersion[productId] = version;
        emit ProductRegistered(productId, version, documentHash, riskGrade, complex, derivative, document);
    }

    // ── 1. 진단 회차 (판매사 키) ─────────────────────────────────

    /// @notice 진단 한 회차를 기록한다. 회차는 고객 가명 ID마다 1부터 차례로 원장이 정한다.
    /// @param proof Groth16 증명 [a0, a1, b00, b01, b10, b11, c0, c1].
    function recordDiagnosis(
        uint256 customerRef,
        uint32 attempt,
        uint256 ruleHash,
        uint256 commitment,
        uint8 profile,
        uint8 limit,
        bool elderly,
        uint256[8] calldata proof
    ) external only(seller) {
        if (attempt != attemptCount[customerRef] + 1) revert InvalidAttempt();
        if (!rules[ruleHash].registered) revert InvalidVersion();
        if (
            customerRef == 0 || customerRef >= FIELD || commitment == 0 || commitment >= FIELD || profile == 0
                || profile > 5 || limit == 0 || limit > 6
        ) revert InvalidProof();
        uint256[9] memory signals = [
            uint256(profile),
            limit,
            elderly ? 1 : 0,
            commitment,
            block.chainid,
            uint256(uint160(address(this))),
            customerRef,
            attempt,
            ruleHash
        ];
        if (!verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                signals
            )) revert InvalidProof();
        attemptCount[customerRef] = attempt;
        diagnoses[customerRef][attempt] =
            Diagnosis(ruleHash, commitment, profile, limit, elderly, uint64(block.timestamp));
        emit DiagnosisRecorded(customerRef, attempt, ruleHash, commitment, profile, limit, elderly);
    }

    // ── 2. 적합성·설명·청약 (고객 키) ────────────────────────────

    /// @notice 청약. 최신 회차, 최신 상품 버전, 적합성과 필요한 확인 기록을 검사한다.
    /// @param approval 회차가 3 이상이면 승인자의 EIP-191 서명(65바이트). 아니면 무시한다.
    function subscribe(
        uint256 saleId,
        uint256 customerRef,
        bytes32 productId,
        uint32 productVersion,
        uint32 attempt,
        uint32 explanationSeconds,
        bool higherRiskConfirmed,
        bytes32 recordingHash,
        uint256 amount,
        bytes calldata approval
    ) external only(customer) {
        Sale storage s = sales[saleId];
        if (saleId == 0 || saleId >= FIELD || s.status != Status.None || amount == 0) revert InvalidState();
        if (productVersion == 0 || productVersion != latestProductVersion[productId]) {
            revert InvalidVersion();
        }
        if (attempt == 0 || attempt != attemptCount[customerRef]) revert InvalidAttempt();
        if (explanationSeconds == 0) revert MissingRecords();

        ProductVersion storage product = products[productId][productVersion];
        Diagnosis storage diagnosis = diagnoses[customerRef][attempt];
        bool suitable = product.riskGrade >= diagnosis.limit;
        bool protectedSale = product.complex || (product.derivative && (diagnosis.elderly || !suitable));
        if (!suitable && !higherRiskConfirmed) revert MissingRecords();
        if (protectedSale && recordingHash == bytes32(0)) revert MissingRecords();
        bool approvalRequired = attempt >= 3;
        if (approvalRequired) _checkApproval(saleId, customerRef, attempt, approval);

        s.customerRef = customerRef;
        s.productId = productId;
        s.productVersion = productVersion;
        s.attempt = attempt;
        s.explanationSeconds = explanationSeconds;
        s.suitable = suitable;
        s.protectedSale = protectedSale;
        s.higherRiskConfirmed = !suitable;
        s.approved = approvalRequired;
        if (protectedSale) s.recordingHash = recordingHash;
        s.amount = amount;
        s.status = Status.Subscribed;
        s.subscribedAt = uint64(block.timestamp);

        emit SaleSubscribed(
            saleId,
            customerRef,
            productId,
            productVersion,
            attempt,
            suitable,
            protectedSale,
            amount,
            explanationSeconds
        );
        if (!suitable) emit HigherRiskConfirmed(saleId);
        if (approvalRequired) emit ManagerApproved(saleId, attempt);
        if (protectedSale) emit RecordingAttached(saleId, recordingHash);
    }

    function _checkApproval(uint256 saleId, uint256 customerRef, uint32 attempt, bytes calldata approval)
        private
        view
    {
        if (approval.length != 65) revert MissingRecords();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(approval.offset)
            s := calldataload(add(approval.offset, 32))
            v := byte(0, calldataload(add(approval.offset, 64)))
        }
        if ((v != 27 && v != 28) || uint256(s) > MAX_CANONICAL_S) revert Unauthorized();
        bytes32 approvalHash = keccak256(
            abi.encode(APPROVAL_DOMAIN, block.chainid, address(this), saleId, customerRef, attempt)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", approvalHash));
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != approver) revert Unauthorized();
    }

    // ── 3·4. 숙려와 최종 확인, 철회 (고객 키) ─────────────────────

    /// @notice 최종 확인. 녹취·숙려 대상이면 청약 뒤 최소 경과 시간이 지나야 한다.
    function confirm(uint256 saleId) external only(customer) {
        Sale storage s = sales[saleId];
        if (s.status != Status.Subscribed) revert InvalidState();
        if (s.protectedSale && block.timestamp < uint256(s.subscribedAt) + coolingPeriod) revert TooEarly();
        s.status = Status.Confirmed;
        s.confirmedAt = uint64(block.timestamp);
        emit EnrollmentConfirmed(saleId, s.customerRef);
    }

    function withdraw(uint256 saleId) external only(customer) {
        Sale storage s = sales[saleId];
        if (s.status != Status.Subscribed) revert InvalidState();
        s.status = Status.Withdrawn;
        s.withdrawnAt = uint64(block.timestamp);
        emit SaleWithdrawn(saleId);
    }

    // ── 5. 모의 결제 (인프라 키) ─────────────────────────────────

    function recordSettlement(uint256 saleId) external only(infrastructure) {
        Sale storage s = sales[saleId];
        if (s.status != Status.Confirmed || s.settledAt != 0) revert InvalidState();
        s.settledAt = uint64(block.timestamp);
        emit SettlementRecorded(saleId, s.amount);
    }

    // ── 조회 ─────────────────────────────────────────────────────

    function getSale(uint256 saleId) external view returns (Sale memory) {
        return sales[saleId];
    }

    function getDiagnosis(uint256 customerRef, uint32 attempt) external view returns (Diagnosis memory) {
        return diagnoses[customerRef][attempt];
    }

    function getProduct(bytes32 productId, uint32 version) external view returns (ProductVersion memory) {
        return products[productId][version];
    }
}
