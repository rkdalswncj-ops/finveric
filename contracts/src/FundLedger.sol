// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[8] calldata signals
    ) external view returns (bool);
}

/// @notice Fictional fund demo. Roles use separate test keys. No funds are transferred.
contract FundLedger {
    uint256 public constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 public constant RULE_V3 = keccak256(
        "FINVERIC_RULE_V3:profile=1+[sum>=2]+[sum>=3];higher-risk-if-profile<registered-product-minimum;self-directed-confirmation"
    );
    uint8 private constant MAX_PROFILE = 3;
    bytes32 private constant REVIEW_PURPOSE = keccak256("FINVERIC_V3_REVIEW");
    uint256 private constant MAX_CANONICAL_S =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    address public immutable manager;
    address public immutable seller;
    address public immutable compliance;
    address public immutable customer;
    address public immutable infrastructure;
    IVerifier public immutable verifier;

    struct Sale {
        bytes32 productId;
        bytes32 documentHash;
        bytes32 ruleHash;
        uint32 attempts;
        bool explained;
        bool signed;
        bool reviewed;
        bool finalized;
        uint8 purchaseState;
        uint256 amount;
        uint256 nav;
        uint256 units;
        uint256 pricedAt;
        bytes32 signatureHash;
        bool higherRiskConfirmed;
    }

    struct Attempt {
        uint256 commitment;
        bool recorded;
        uint8 profile;
    }

    struct DiagnosisProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[8] signals;
    }

    mapping(bytes32 => bytes32) public documents;
    mapping(bytes32 => uint8) public minimumProfiles;
    mapping(bytes32 => bool) public rules;
    mapping(uint256 => bool) private registeredDocumentFields;
    mapping(uint256 => Sale) private sales;
    mapping(uint256 => mapping(uint32 => Attempt)) private attempts;

    event ProductRegistered(bytes32 indexed productId, bytes32 documentHash);
    event RuleRegistered(bytes32 indexed ruleHash);
    event SaleOpened(uint256 indexed saleId, bytes32 productId, bytes32 documentHash, bytes32 ruleHash);
    event AnswersCommitted(uint256 indexed saleId, uint32 indexed attempt, uint256 commitment);
    event DiagnosisRecorded(
        uint256 indexed saleId, uint32 indexed attempt, uint256 commitment, uint8 profile
    );
    event ExplanationConfirmed(uint256 indexed saleId, uint32 attempt, bytes32 documentHash);
    event HigherRiskConfirmed(uint256 indexed saleId, uint32 attempt);
    event ReviewApproved(uint256 indexed saleId, uint32 attempt);
    event EnrollmentAuthorized(uint256 indexed saleId, uint32 attempt, address customer);
    event ConditionsVerified(uint256 indexed saleId, uint32 attempt);
    event MockPurchaseUpdated(
        uint256 indexed saleId, uint8 state, uint256 amount, uint256 nav, uint256 units, uint256 pricedAt
    );

    error Unauthorized();
    error InvalidVersion();
    error InvalidState();
    error InvalidProof();
    error MissingRecords();

    constructor(
        address verifier_,
        address manager_,
        address seller_,
        address compliance_,
        address customer_,
        address infrastructure_
    ) {
        require(verifier_.code.length > 0, "Verifier missing");
        address[5] memory roles = [manager_, seller_, compliance_, customer_, infrastructure_];
        for (uint256 i; i < roles.length; i++) {
            require(roles[i] != address(0), "Zero role");
            for (uint256 j; j < i; j++) {
                require(roles[i] != roles[j], "Roles must differ");
            }
        }
        verifier = IVerifier(verifier_);
        manager = manager_;
        seller = seller_;
        compliance = compliance_;
        customer = customer_;
        infrastructure = infrastructure_;
    }

    modifier only(address actor) {
        if (msg.sender != actor) revert Unauthorized();
        _;
    }

    function registerProduct(bytes32 productId, bytes32 documentHash, uint8 minimumProfile)
        external
        only(manager)
    {
        // Proofs bind the document's field element, so each product needs a distinct one.
        uint256 documentField = uint256(documentHash) % FIELD;
        if (
            productId == bytes32(0) || documentHash == bytes32(0) || documents[productId] != bytes32(0)
                || minimumProfile == 0 || minimumProfile > MAX_PROFILE
                || registeredDocumentFields[documentField]
        ) revert InvalidVersion();
        documents[productId] = documentHash;
        minimumProfiles[productId] = minimumProfile;
        registeredDocumentFields[documentField] = true;
        emit ProductRegistered(productId, documentHash);
    }

    function registerRule(bytes32 ruleHash) external only(seller) {
        if (ruleHash != RULE_V3 || rules[ruleHash]) revert InvalidVersion();
        rules[ruleHash] = true;
        emit RuleRegistered(ruleHash);
    }

    function completeEnrollment(
        uint256 saleId,
        bytes32 productId,
        bytes32 documentHash,
        bytes32 ruleHash,
        DiagnosisProof[] calldata proofs,
        bool explanationAccepted,
        bool higherRiskAccepted,
        bytes calldata reviewSignature
    ) external only(customer) {
        Sale storage s = sales[saleId];
        if (
            saleId == 0 || saleId >= FIELD || s.productId != bytes32(0) || proofs.length == 0
                || proofs.length > 10
        ) {
            revert InvalidState();
        }
        if (documents[productId] != documentHash || documentHash == bytes32(0) || !rules[ruleHash]) {
            revert InvalidVersion();
        }
        if (!explanationAccepted) revert MissingRecords();

        uint32 finalAttempt = uint32(proofs.length);
        s.productId = productId;
        s.documentHash = documentHash;
        s.ruleHash = ruleHash;
        s.attempts = finalAttempt;
        emit SaleOpened(saleId, productId, documentHash, ruleHash);
        for (uint256 i = 0; i < proofs.length; ++i) {
            _recordDiagnosis(saleId, uint32(i + 1), documentHash, ruleHash, proofs[i]);
        }

        s.explained = true;
        emit ExplanationConfirmed(saleId, finalAttempt, documentHash);
        if (proofs[finalAttempt - 1].signals[0] < minimumProfiles[productId]) {
            if (!higherRiskAccepted) revert MissingRecords();
            s.higherRiskConfirmed = true;
            emit HigherRiskConfirmed(saleId, finalAttempt);
        }
        if (finalAttempt >= 3) {
            _checkReview(saleId, productId, documentHash, ruleHash, proofs, reviewSignature);
            s.reviewed = true;
            emit ReviewApproved(saleId, finalAttempt);
        }
        s.signed = true;
        emit EnrollmentAuthorized(saleId, finalAttempt, msg.sender);
        s.finalized = true;
        emit ConditionsVerified(saleId, finalAttempt);
    }

    function _recordDiagnosis(
        uint256 saleId,
        uint32 attempt,
        bytes32 documentHash,
        bytes32 ruleHash,
        DiagnosisProof calldata proof
    ) private {
        uint256[8] calldata signals = proof.signals;
        uint256 commitment = signals[1];
        if (
            signals[0] == 0 || signals[0] > MAX_PROFILE || commitment == 0 || commitment >= FIELD
                || signals[2] != block.chainid || signals[3] != uint256(uint160(address(this)))
                || signals[4] != saleId || signals[5] != attempt || signals[6] != uint256(ruleHash) % FIELD
                || signals[7] != uint256(documentHash) % FIELD
        ) revert InvalidProof();
        if (!verifier.verifyProof(proof.a, proof.b, proof.c, signals)) revert InvalidProof();
        uint8 profile = uint8(signals[0]);
        attempts[saleId][attempt] = Attempt(commitment, true, profile);
        emit AnswersCommitted(saleId, attempt, commitment);
        emit DiagnosisRecorded(saleId, attempt, commitment, profile);
    }

    function _checkReview(
        uint256 saleId,
        bytes32 productId,
        bytes32 documentHash,
        bytes32 ruleHash,
        DiagnosisProof[] calldata proofs,
        bytes calldata reviewSignature
    ) private view {
        if (reviewSignature.length != 65) revert MissingRecords();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(reviewSignature.offset)
            s := calldataload(add(reviewSignature.offset, 32))
            v := byte(0, calldataload(add(reviewSignature.offset, 64)))
        }
        if ((v != 27 && v != 28) || uint256(s) > MAX_CANONICAL_S) revert Unauthorized();
        bytes32 review = keccak256(
            abi.encode(
                REVIEW_PURPOSE,
                block.chainid,
                address(this),
                saleId,
                productId,
                documentHash,
                ruleHash,
                keccak256(abi.encode(proofs))
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", review));
        if (ecrecover(digest, v, r, s) != compliance) revert Unauthorized();
    }

    function requestMockPurchase(uint256 saleId) external only(seller) {
        Sale storage s = sales[saleId];
        if (!s.finalized || s.purchaseState != 0) revert InvalidState();
        s.purchaseState = 1;
        emit MockPurchaseUpdated(saleId, 1, 0, 0, 0, 0);
    }

    function awaitMockPurchase(uint256 saleId) external only(infrastructure) {
        Sale storage s = sales[saleId];
        if (s.purchaseState != 1) revert InvalidState();
        s.purchaseState = 2;
        emit MockPurchaseUpdated(saleId, 2, 0, 0, 0, 0);
    }

    function recordMockPurchase(uint256 saleId, uint256 amount, uint256 nav, uint256 pricedAt)
        external
        only(infrastructure)
    {
        Sale storage s = sales[saleId];
        if (
            s.purchaseState != 2 || amount != 1_050_000 || nav != 1_050 || pricedAt == 0
                || pricedAt > block.timestamp
        ) revert InvalidState();
        s.amount = amount;
        s.nav = nav;
        s.units = amount * 1_000 / nav;
        s.pricedAt = pricedAt;
        s.purchaseState = 3;
        emit MockPurchaseUpdated(saleId, 3, amount, nav, s.units, pricedAt);
    }

    function getSale(uint256 saleId) external view returns (Sale memory) {
        return sales[saleId];
    }

    function getAttempt(uint256 saleId, uint32 attempt) external view returns (Attempt memory) {
        return attempts[saleId][attempt];
    }
}
