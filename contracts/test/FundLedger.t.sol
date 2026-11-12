// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {FundLedger, IVerifier} from "../src/FundLedger.sol";

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address) external;
    function expectRevert(bytes4) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

// Stage-control tests use a stub. Node integration tests deploy the generated Groth16 verifier.
contract StageVerifier is IVerifier {
    bool public valid = true;

    function setValid(bool value) external {
        valid = value;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[8] calldata
    ) external view returns (bool) {
        return valid;
    }
}

contract FundLedgerTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant MANAGER = address(11);
    address constant SELLER = address(12);
    address constant CUSTOMER = address(14);
    address constant INFRA = address(15);
    uint256 constant COMPLIANCE_KEY = 12345;
    uint256 constant CURVE_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141;
    bytes32 constant PRODUCT = keccak256("FUND-DEMO-001:Ce:v1");
    bytes32 constant DOCUMENT = keccak256("document-v1");
    bytes32 constant BOND_PRODUCT = keccak256("FUND-DEMO-002:Ce:v1");
    bytes32 constant BOND_DOCUMENT = keccak256("bond-document-v1");
    StageVerifier verifier;
    FundLedger ledger;
    bytes32 rule;

    function setUp() public {
        verifier = new StageVerifier();
        ledger = new FundLedger(address(verifier), MANAGER, SELLER, vm.addr(COMPLIANCE_KEY), CUSTOMER, INFRA);
        rule = ledger.RULE_V3();
        vm.prank(MANAGER);
        ledger.registerProduct(PRODUCT, DOCUMENT, 3);
        vm.prank(MANAGER);
        ledger.registerProduct(BOND_PRODUCT, BOND_DOCUMENT, 1);
        vm.prank(SELLER);
        ledger.registerRule(rule);
    }

    function diagnoses(uint256 saleId, uint32 count, uint8 finalProfile)
        internal
        view
        returns (FundLedger.DiagnosisProof[] memory proofs)
    {
        proofs = new FundLedger.DiagnosisProof[](count);
        for (uint256 i = 0; i < count; ++i) {
            uint256 profile = i + 1 == count ? finalProfile : i % 3 + 1;
            proofs[i].signals = [
                profile,
                101 + i,
                block.chainid,
                uint256(uint160(address(ledger))),
                saleId,
                i + 1,
                uint256(rule) % ledger.FIELD(),
                uint256(DOCUMENT) % ledger.FIELD()
            ];
        }
    }

    function complete(
        FundLedger.DiagnosisProof[] memory proofs,
        bool explanationAccepted,
        bool higherRiskAccepted,
        bytes memory reviewSignature
    ) internal {
        vm.prank(CUSTOMER);
        ledger.completeEnrollment(
            1, PRODUCT, DOCUMENT, rule, proofs, explanationAccepted, higherRiskAccepted, reviewSignature
        );
    }

    function signReview(uint256 privateKey, uint256 saleId, FundLedger.DiagnosisProof[] memory proofs)
        internal
        returns (bytes memory)
    {
        bytes32 review = keccak256(
            abi.encode(
                keccak256("FINVERIC_V3_REVIEW"),
                block.chainid,
                address(ledger),
                saleId,
                PRODUCT,
                DOCUMENT,
                rule,
                keccak256(abi.encode(proofs))
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", review));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function requireNoEnrollment() internal view {
        require(ledger.getSale(1).productId == bytes32(0));
        require(!ledger.getAttempt(1, 1).recorded);
    }

    function testOneTransactionRecordsMatchedEnrollment() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        vm.recordLogs();
        complete(proofs, true, false, "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 6);
        require(logs[0].topics[0] == FundLedger.SaleOpened.selector);
        require(logs[1].topics[0] == FundLedger.AnswersCommitted.selector);
        require(logs[2].topics[0] == FundLedger.DiagnosisRecorded.selector);
        require(logs[3].topics[0] == FundLedger.ExplanationConfirmed.selector);
        require(logs[4].topics[0] == FundLedger.EnrollmentAuthorized.selector);
        require(logs[5].topics[0] == FundLedger.ConditionsVerified.selector);
        (uint32 attempt, address signer) = abi.decode(logs[4].data, (uint32, address));
        require(attempt == 1 && signer == CUSTOMER && logs[4].topics[1] == bytes32(uint256(1)));

        FundLedger.Sale memory sale = ledger.getSale(1);
        require(sale.attempts == 1 && sale.finalized && sale.explained && sale.signed);
        require(!sale.reviewed && !sale.higherRiskConfirmed && sale.signatureHash == bytes32(0));
        FundLedger.Attempt memory stored = ledger.getAttempt(1, 1);
        require(stored.recorded && stored.profile == 3 && stored.commitment == 101);
    }

    function testHigherRiskEnrollmentNeedsSeparateConsent() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 1);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();

        vm.recordLogs();
        complete(proofs, true, true, "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 7 && logs[4].topics[0] == FundLedger.HigherRiskConfirmed.selector);
        FundLedger.Sale memory sale = ledger.getSale(1);
        require(sale.finalized && sale.higherRiskConfirmed);
    }

    function testConsentDependsOnSelectedProductMinimumProfile() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 1);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();

        proofs[0].signals[7] = uint256(BOND_DOCUMENT) % ledger.FIELD();
        vm.prank(CUSTOMER);
        ledger.completeEnrollment(1, BOND_PRODUCT, BOND_DOCUMENT, rule, proofs, true, false, "");
        FundLedger.Sale memory sale = ledger.getSale(1);
        require(sale.finalized && sale.productId == BOND_PRODUCT && !sale.higherRiskConfirmed);
        require(ledger.minimumProfiles(PRODUCT) == 3 && ledger.minimumProfiles(BOND_PRODUCT) == 1);
    }

    function testExplanationConsentIsRequired() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        complete(proofs, false, false, "");
        requireNoEnrollment();
    }

    function testThreeRoundsRequireReviewAndPreserveAllProfiles() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 3, 3);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();

        bytes memory signature = signReview(COMPLIANCE_KEY, 1, proofs);
        vm.recordLogs();
        complete(proofs, true, false, signature);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 11 && logs[8].topics[0] == FundLedger.ReviewApproved.selector);
        FundLedger.Sale memory sale = ledger.getSale(1);
        require(sale.attempts == 3 && sale.finalized && sale.reviewed);
        require(
            ledger.getAttempt(1, 1).profile == 1 && ledger.getAttempt(1, 2).profile == 2
                && ledger.getAttempt(1, 3).profile == 3
        );
    }

    function testReviewCannotBypassHigherRiskConsent() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 3, 2);
        bytes memory signature = signReview(COMPLIANCE_KEY, 1, proofs);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        complete(proofs, true, false, signature);
        requireNoEnrollment();
        complete(proofs, true, true, signature);
        require(ledger.getSale(1).finalized);
    }

    function testReviewBindsSaleAndOrderedProofs() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 3, 3);
        bytes memory wrongSale = signReview(COMPLIANCE_KEY, 2, proofs);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        complete(proofs, true, false, wrongSale);

        bytes memory signature = signReview(COMPLIANCE_KEY, 1, proofs);
        proofs[1].signals[1] += 1;
        vm.expectRevert(FundLedger.Unauthorized.selector);
        complete(proofs, true, false, signature);
        requireNoEnrollment();
    }

    function testReviewRequiresComplianceSignerAndCanonicalSignature() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 3, 3);
        bytes memory wrongSigner = signReview(12346, 1, proofs);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        complete(proofs, true, false, wrongSigner);

        bytes memory signature = signReview(COMPLIANCE_KEY, 1, proofs);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        bytes memory highS =
            abi.encodePacked(r, bytes32(CURVE_ORDER - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(FundLedger.Unauthorized.selector);
        complete(proofs, true, false, highS);
        requireNoEnrollment();
    }

    function testInvalidCryptographicProofRejected() public {
        verifier.setValid(false);
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();
    }

    function testInvalidProfileAndCommitmentRejected() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 0);
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, true, "");
        proofs[0].signals[0] = 4;
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, true, "");
        proofs[0].signals[0] = 3;
        proofs[0].signals[1] = 0;
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();
    }

    function testProofsCannotReuseSaleChainOrLedger() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(2, 1, 3);
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, false, "");
        proofs[0].signals[4] = 1;
        proofs[0].signals[2] = block.chainid + 1;
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, false, "");
        proofs[0].signals[2] = block.chainid;
        proofs[0].signals[3] = uint256(uint160(address(ledger))) + 1;
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();
    }

    function testDocumentAndProofCannotBeReusedAcrossProducts() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(CUSTOMER);
        ledger.completeEnrollment(1, BOND_PRODUCT, DOCUMENT, rule, proofs, true, false, "");

        vm.expectRevert(FundLedger.InvalidProof.selector);
        vm.prank(CUSTOMER);
        ledger.completeEnrollment(1, BOND_PRODUCT, BOND_DOCUMENT, rule, proofs, true, false, "");
        requireNoEnrollment();
    }

    function testInvalidLaterRoundRollsBackEarlierRounds() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 2, 3);
        proofs[1].signals[5] = 1;
        vm.expectRevert(FundLedger.InvalidProof.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();
        proofs[1].signals[5] = 2;
        complete(proofs, true, false, "");
        require(ledger.getSale(1).attempts == 2 && ledger.getAttempt(1, 1).recorded);
    }

    function testInvalidAttemptCountsRejected() public {
        FundLedger.DiagnosisProof[] memory proofs = new FundLedger.DiagnosisProof[](0);
        vm.expectRevert(FundLedger.InvalidState.selector);
        complete(proofs, true, false, "");
        proofs = new FundLedger.DiagnosisProof[](11);
        vm.expectRevert(FundLedger.InvalidState.selector);
        complete(proofs, true, false, "");
        requireNoEnrollment();
    }

    function testUnregisteredVersionsRejected() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        bytes32 oldRule = keccak256(
            "FINVERIC_RULE_V2:profile=1+[sum>=2]+[sum>=3];higher-risk-if-profile<3;self-directed-confirmation"
        );
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(CUSTOMER);
        ledger.completeEnrollment(1, PRODUCT, keccak256("other-document"), rule, proofs, true, false, "");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(CUSTOMER);
        ledger.completeEnrollment(1, PRODUCT, DOCUMENT, oldRule, proofs, true, false, "");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerRule(oldRule);
    }

    function testProductMinimumProfileMustBeValidAndCannotChange() public {
        bytes32 anotherProduct = keccak256("another-product");
        bytes32 anotherDocument = keccak256("another-document");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(MANAGER);
        ledger.registerProduct(anotherProduct, anotherDocument, 0);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(MANAGER);
        ledger.registerProduct(anotherProduct, anotherDocument, 4);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(MANAGER);
        ledger.registerProduct(PRODUCT, anotherDocument, 1);
        require(ledger.documents(PRODUCT) == DOCUMENT && ledger.minimumProfiles(PRODUCT) == 3);
    }

    function testProductDocumentsCannotShareAProofField() public {
        uint256 modulus = ledger.FIELD();
        uint256 reduced = uint256(DOCUMENT) % modulus;
        bytes32 equivalentDocument = bytes32(uint256(DOCUMENT) == reduced ? reduced + modulus : reduced);
        bytes32 anotherProduct = keccak256("another-product");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(MANAGER);
        ledger.registerProduct(anotherProduct, equivalentDocument, 1);
        require(ledger.documents(anotherProduct) == bytes32(0) && ledger.minimumProfiles(anotherProduct) == 0);
    }

    function testRolesCannotActForEachOther() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(SELLER);
        ledger.completeEnrollment(1, PRODUCT, DOCUMENT, rule, proofs, true, false, "");
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(SELLER);
        ledger.registerProduct(keccak256("p2"), DOCUMENT, 3);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(MANAGER);
        ledger.registerRule(rule);
    }

    function testDuplicateCompletionAndPurchaseRejected() public {
        FundLedger.DiagnosisProof[] memory proofs = diagnoses(1, 1, 3);
        complete(proofs, true, false, "");
        vm.expectRevert(FundLedger.InvalidState.selector);
        complete(proofs, true, false, "");
        vm.prank(SELLER);
        ledger.requestMockPurchase(1);
        vm.prank(INFRA);
        ledger.awaitMockPurchase(1);
        vm.prank(INFRA);
        ledger.recordMockPurchase(1, 1_050_000, 1_050, block.timestamp);
        require(ledger.getSale(1).units == 1_000_000);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(INFRA);
        ledger.recordMockPurchase(1, 1_050_000, 1_050, block.timestamp);
    }

    function testNoPurchaseBeforeFinalization() public {
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(SELLER);
        ledger.requestMockPurchase(1);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(INFRA);
        ledger.recordMockPurchase(1, 1_050_000, 1_050, block.timestamp);
    }
}
