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
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

// 단계·권한 검사는 stub을 쓴다. 실제 Groth16 Verifier 경로는 npm test가 검사한다.
contract StubVerifier is IVerifier {
    bool public valid = true;
    uint256[9] public last;

    function setValid(bool value) external {
        valid = value;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[9] calldata signals
    ) external view returns (bool) {
        // 원장이 넘긴 공개 신호 순서를 검사한다: profile, limit, elderly, commitment, chainId, ledger, customerRef, attempt, ruleHash.
        StubVerifier self = StubVerifier(address(this));
        return valid && signals[4] == block.chainid && signals[5] == uint256(uint160(msg.sender))
            && signals[0] == self.expectedProfile() && signals[6] == self.expectedCustomer()
            && signals[7] == self.expectedAttempt();
    }

    uint256 public expectedProfile;
    uint256 public expectedCustomer;
    uint256 public expectedAttempt;

    function expect(uint256 profile, uint256 customerRef, uint256 attempt) external {
        expectedProfile = profile;
        expectedCustomer = customerRef;
        expectedAttempt = attempt;
    }
}

contract FundLedgerTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant SELLER = address(12);
    address constant CUSTOMER = address(14);
    address constant INFRA = address(15);
    uint256 constant APPROVER_KEY = 12345;
    uint64 constant COOLING = 60;
    uint256 constant CURVE_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141;
    uint256 constant RULE = 1111;
    uint256 constant RULE_2 = 2222;
    uint256 constant ALICE = 101;
    uint256 constant BOB = 202;
    bytes32 constant ELS = keccak256("ELS-DEMO-001");
    bytes32 constant FUND = keccak256("FUND-DEMO-002");
    bytes32 constant DLS = keccak256("DLS-DEMO-004");
    bytes32 constant RECORDING = keccak256("recording");
    uint256 constant AMOUNT = 10_000_000;
    StubVerifier verifier;
    FundLedger ledger;
    uint256[8] proof;

    function setUp() public {
        verifier = new StubVerifier();
        ledger = new FundLedger(address(verifier), SELLER, vm.addr(APPROVER_KEY), CUSTOMER, INFRA, COOLING);
        vm.prank(SELLER);
        ledger.registerRule(RULE, 1, "rule-v1");
        vm.prank(SELLER);
        ledger.registerProduct(ELS, "els-v1", 1, true, true);
        vm.prank(SELLER);
        ledger.registerProduct(FUND, "fund-v1", 3, false, false);
        // 고난도가 아닌 파생결합증권(예: DLS). 고령·부적합 고객에게만 녹취·숙려 대상이다.
        vm.prank(SELLER);
        ledger.registerProduct(DLS, "dls-v1", 4, false, true);
    }

    // ── 도우미 ───────────────────────────────────────────────

    function diagnose(uint256 customerRef, uint32 attempt, uint8 profile, uint8 limit, bool elderly)
        internal
    {
        verifier.expect(profile, customerRef, attempt);
        vm.prank(SELLER);
        ledger.recordDiagnosis(customerRef, attempt, RULE, 500 + attempt, profile, limit, elderly, proof);
    }

    function subscribeAs(
        uint256 saleId,
        uint256 customerRef,
        bytes32 productId,
        uint32 attempt,
        bool higherRisk,
        bytes32 recording,
        bytes memory approval
    ) internal {
        vm.prank(CUSTOMER);
        ledger.subscribe(
            saleId, customerRef, productId, 1, attempt, 90, higherRisk, recording, AMOUNT, approval
        );
    }

    function signApproval(uint256 key, uint256 saleId, uint256 customerRef, uint32 attempt)
        internal
        returns (bytes memory)
    {
        bytes32 hash = keccak256(
            abi.encode("FINVERIC_APPROVAL_V5", block.chainid, address(ledger), saleId, customerRef, attempt)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function status(uint256 saleId) internal view returns (FundLedger.Status) {
        return ledger.getSale(saleId).status;
    }

    // ── 권한 ─────────────────────────────────────────────────

    function testRolesCannotActForEachOther() public {
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(CUSTOMER);
        ledger.registerRule(RULE_2, 2, "rule-v2");
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(CUSTOMER);
        ledger.registerProduct(ELS, "els-v2", 1, true, true);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(CUSTOMER);
        ledger.recordDiagnosis(ALICE, 1, RULE, 1, 3, 3, false, proof);

        diagnose(ALICE, 1, 3, 3, false);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(SELLER);
        ledger.subscribe(1, ALICE, FUND, 1, 1, 90, false, bytes32(0), AMOUNT, "");
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(SELLER);
        ledger.confirm(1);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(INFRA);
        ledger.withdraw(1);
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        vm.expectRevert(FundLedger.Unauthorized.selector);
        vm.prank(CUSTOMER);
        ledger.recordSettlement(1);
        require(ledger.ruleCount() == 1 && ledger.latestProductVersion(ELS) == 1);
        require(ledger.ledgerVersion() == 5 && ledger.coolingPeriod() == COOLING);
    }

    function testConstructorRejectsSharedOrMissingRoles() public {
        try new FundLedger(address(verifier), SELLER, SELLER, CUSTOMER, INFRA, COOLING) {
            revert("shared role accepted");
        } catch {}
        try new FundLedger(address(verifier), SELLER, address(0), CUSTOMER, INFRA, COOLING) {
            revert("zero role accepted");
        } catch {}
        try new FundLedger(address(77), SELLER, address(13), CUSTOMER, INFRA, COOLING) {
            revert("missing verifier accepted");
        } catch {}
    }

    // ── 기준과 상품 버전 ─────────────────────────────────────

    function testRulesRegisterInOrderOnce() public {
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerRule(RULE, 2, "same hash");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerRule(RULE_2, 3, "skipped version");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerRule(0, 2, "zero");
        uint256 field = ledger.FIELD();
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerRule(field, 2, "outside field");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerRule(RULE_2, 2, "");

        vm.recordLogs();
        vm.prank(SELLER);
        ledger.registerRule(RULE_2, 2, "rule-v2");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 1 && logs[0].topics[0] == FundLedger.RuleRegistered.selector);
        require(logs[0].topics[1] == bytes32(RULE_2));
        (uint32 version, string memory document) = abi.decode(logs[0].data, (uint32, string));
        require(version == 2 && keccak256(bytes(document)) == keccak256("rule-v2"));
        (bool registered, uint32 stored,) = ledger.rules(RULE_2);
        (, uint32 first,) = ledger.rules(RULE);
        require(registered && stored == 2 && first == 1 && ledger.ruleCount() == 2);
    }

    function testProductVersionsAppendAndKeepHistory() public {
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerProduct(ELS, "els-v2", 0, true, true);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerProduct(ELS, "els-v2", 7, true, true);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerProduct(bytes32(0), "x", 3, false, false);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.registerProduct(ELS, "", 1, true, true);

        vm.recordLogs();
        vm.prank(SELLER);
        ledger.registerProduct(ELS, "els-v2", 2, true, true);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 1 && logs[0].topics[0] == FundLedger.ProductRegistered.selector);
        (uint32 version, bytes32 documentHash, uint8 grade,,,) =
            abi.decode(logs[0].data, (uint32, bytes32, uint8, bool, bool, string));
        require(version == 2 && documentHash == keccak256("els-v2") && grade == 2);
        require(ledger.latestProductVersion(ELS) == 2);
        FundLedger.ProductVersion memory first = ledger.getProduct(ELS, 1);
        require(first.documentHash == keccak256("els-v1") && first.riskGrade == 1 && first.complex);
        require(ledger.getProduct(ELS, 2).riskGrade == 2);
    }

    // ── 진단 회차 ────────────────────────────────────────────

    function testAttemptsAreSequentialPerCustomer() public {
        diagnose(ALICE, 1, 3, 3, false);
        vm.expectRevert(FundLedger.InvalidAttempt.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 3, RULE, 7, 3, 3, false, proof);
        diagnose(ALICE, 2, 4, 2, false);
        // 다른 고객은 1회차부터 센다.
        vm.expectRevert(FundLedger.InvalidAttempt.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(BOB, 2, RULE, 7, 3, 3, false, proof);
        diagnose(BOB, 1, 1, 6, true);
        require(ledger.attemptCount(ALICE) == 2 && ledger.attemptCount(BOB) == 1);
        FundLedger.Diagnosis memory stored = ledger.getDiagnosis(ALICE, 2);
        require(
            stored.ruleHash == RULE && stored.commitment == 502 && stored.profile == 4 && stored.limit == 2
        );
        require(ledger.getDiagnosis(BOB, 1).elderly && stored.recordedAt == block.timestamp);
    }

    function testRecordedAttemptCannotBeRewritten() public {
        diagnose(ALICE, 1, 3, 3, false);
        diagnose(ALICE, 2, 4, 2, false);
        // 사후 변경 시도: 2회차를 더 낮은 성향으로 다시 쓴다. 증명이 맞아도 회차 검사가 먼저 거절한다.
        verifier.expect(2, ALICE, 2);
        vm.expectRevert(FundLedger.InvalidAttempt.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 2, RULE, 999, 2, 5, false, proof);
        vm.expectRevert(FundLedger.InvalidAttempt.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 1, RULE, 999, 2, 5, false, proof);
        FundLedger.Diagnosis memory stored = ledger.getDiagnosis(ALICE, 2);
        require(stored.commitment == 502 && stored.profile == 4 && stored.limit == 2);
        require(ledger.attemptCount(ALICE) == 2);
    }

    function testDiagnosisNeedsRegisteredRuleAndValidSignals() public {
        verifier.expect(3, ALICE, 1);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 1, RULE_2, 5, 3, 3, false, proof);
        uint256 field = ledger.FIELD();
        uint8[2][4] memory badRanges = [[0, 3], [6, 3], [3, 0], [3, 7]];
        for (uint256 i; i < badRanges.length; i++) {
            vm.expectRevert(FundLedger.InvalidProof.selector);
            vm.prank(SELLER);
            ledger.recordDiagnosis(ALICE, 1, RULE, 5, badRanges[i][0], badRanges[i][1], false, proof);
        }
        vm.expectRevert(FundLedger.InvalidProof.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 1, RULE, 0, 3, 3, false, proof);
        vm.expectRevert(FundLedger.InvalidProof.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 1, RULE, field, 3, 3, false, proof);
        // 공개 신호가 증명과 다르면(다른 고객 가명 ID·회차·성향) Verifier가 거절한다.
        vm.expectRevert(FundLedger.InvalidProof.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 1, RULE, 5, 4, 3, false, proof);
        verifier.setValid(false);
        vm.expectRevert(FundLedger.InvalidProof.selector);
        vm.prank(SELLER);
        ledger.recordDiagnosis(ALICE, 1, RULE, 5, 3, 3, false, proof);
        require(ledger.attemptCount(ALICE) == 0);
    }

    // ── 청약 ─────────────────────────────────────────────────

    function testSuitableSaleSubscribesAndConfirmsWithoutCooling() public {
        diagnose(ALICE, 1, 3, 3, false);
        vm.recordLogs();
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 1 && logs[0].topics[0] == FundLedger.SaleSubscribed.selector);
        require(logs[0].topics[1] == bytes32(uint256(1)) && logs[0].topics[2] == bytes32(ALICE));
        FundLedger.Sale memory sale = ledger.getSale(1);
        require(sale.suitable && !sale.protectedSale && !sale.higherRiskConfirmed && !sale.approved);
        require(sale.attempt == 1 && sale.amount == AMOUNT && sale.explanationSeconds == 90);
        require(sale.status == FundLedger.Status.Subscribed && sale.recordingHash == bytes32(0));
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        require(status(1) == FundLedger.Status.Confirmed);
    }

    function testUnsuitableSaleNeedsHigherRiskConfirmation() public {
        diagnose(ALICE, 1, 3, 3, false);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        subscribeAs(1, ALICE, ELS, 1, false, RECORDING, "");
        vm.recordLogs();
        subscribeAs(1, ALICE, ELS, 1, true, RECORDING, "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 3);
        require(logs[1].topics[0] == FundLedger.HigherRiskConfirmed.selector);
        require(logs[2].topics[0] == FundLedger.RecordingAttached.selector);
        FundLedger.Sale memory sale = ledger.getSale(1);
        require(!sale.suitable && sale.higherRiskConfirmed && sale.protectedSale);
    }

    function testProtectedSaleNeedsRecordingAndCoolingPeriod() public {
        diagnose(ALICE, 1, 5, 1, false);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        subscribeAs(1, ALICE, ELS, 1, false, bytes32(0), "");
        subscribeAs(1, ALICE, ELS, 1, false, RECORDING, "");
        FundLedger.Sale memory sale = ledger.getSale(1);
        require(sale.suitable && sale.protectedSale && sale.recordingHash == RECORDING);

        vm.expectRevert(FundLedger.TooEarly.selector);
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        vm.warp(block.timestamp + COOLING - 1);
        vm.expectRevert(FundLedger.TooEarly.selector);
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        vm.warp(block.timestamp + 1);
        vm.recordLogs();
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(
            logs[0].topics[0] == FundLedger.EnrollmentConfirmed.selector
                && logs[0].topics[2] == bytes32(ALICE)
        );
        require(status(1) == FundLedger.Status.Confirmed && ledger.getSale(1).confirmedAt == block.timestamp);
    }

    function testDerivativeIsProtectedOnlyForElderlyOrUnsuitable() public {
        diagnose(ALICE, 1, 4, 2, false);
        subscribeAs(1, ALICE, DLS, 1, false, bytes32(0), "");
        require(!ledger.getSale(1).protectedSale);

        diagnose(BOB, 1, 4, 2, true);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        subscribeAs(2, BOB, DLS, 1, false, bytes32(0), "");
        subscribeAs(2, BOB, DLS, 1, false, RECORDING, "");
        require(ledger.getSale(2).protectedSale && ledger.getSale(2).suitable);

        uint256 carol = 303;
        diagnose(carol, 1, 2, 5, false);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        subscribeAs(3, carol, DLS, 1, true, bytes32(0), "");
        subscribeAs(3, carol, DLS, 1, true, RECORDING, "");
        require(ledger.getSale(3).protectedSale && !ledger.getSale(3).suitable);
    }

    function testThirdAttemptNeedsApproverSignature() public {
        diagnose(ALICE, 1, 3, 3, false);
        diagnose(ALICE, 2, 4, 2, false);
        diagnose(ALICE, 3, 5, 2, false);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        subscribeAs(1, ALICE, FUND, 3, false, bytes32(0), "");
        vm.expectRevert(FundLedger.Unauthorized.selector);
        subscribeAs(1, ALICE, FUND, 3, false, bytes32(0), signApproval(12346, 1, ALICE, 3));
        // 승인은 판매 ID, 고객 가명 ID, 회차에 묶인다.
        vm.expectRevert(FundLedger.Unauthorized.selector);
        subscribeAs(1, ALICE, FUND, 3, false, bytes32(0), signApproval(APPROVER_KEY, 2, ALICE, 3));
        vm.expectRevert(FundLedger.Unauthorized.selector);
        subscribeAs(1, ALICE, FUND, 3, false, bytes32(0), signApproval(APPROVER_KEY, 1, ALICE, 2));

        bytes memory signature = signApproval(APPROVER_KEY, 1, ALICE, 3);
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
        subscribeAs(1, ALICE, FUND, 3, false, bytes32(0), highS);

        vm.recordLogs();
        subscribeAs(1, ALICE, FUND, 3, false, bytes32(0), signature);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs.length == 2 && logs[1].topics[0] == FundLedger.ManagerApproved.selector);
        require(abi.decode(logs[1].data, (uint32)) == 3 && ledger.getSale(1).approved);
    }

    function testSubscribeUsesLatestAttemptAndProductVersion() public {
        vm.expectRevert(FundLedger.InvalidAttempt.selector);
        subscribeAs(1, ALICE, FUND, 0, false, bytes32(0), "");
        diagnose(ALICE, 1, 4, 2, false);
        diagnose(ALICE, 2, 3, 3, false);
        // 더 유리한 이전 회차(1회차)를 골라 쓸 수 없다.
        vm.expectRevert(FundLedger.InvalidAttempt.selector);
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
        vm.prank(SELLER);
        ledger.registerProduct(FUND, "fund-v2", 3, false, false);
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        subscribeAs(1, ALICE, FUND, 2, false, bytes32(0), "");
        vm.expectRevert(FundLedger.InvalidVersion.selector);
        subscribeAs(1, ALICE, keccak256("unknown"), 2, false, bytes32(0), "");
        vm.prank(CUSTOMER);
        ledger.subscribe(1, ALICE, FUND, 2, 2, 90, false, bytes32(0), AMOUNT, "");
        require(ledger.getSale(1).productVersion == 2 && ledger.getSale(1).attempt == 2);
    }

    function testSubscribeNeedsExplanationNewSaleIdAndAmount() public {
        diagnose(ALICE, 1, 3, 3, false);
        vm.expectRevert(FundLedger.MissingRecords.selector);
        vm.prank(CUSTOMER);
        ledger.subscribe(1, ALICE, FUND, 1, 1, 0, false, bytes32(0), AMOUNT, "");
        vm.expectRevert(FundLedger.InvalidState.selector);
        subscribeAs(0, ALICE, FUND, 1, false, bytes32(0), "");
        uint256 field = ledger.FIELD();
        vm.expectRevert(FundLedger.InvalidState.selector);
        subscribeAs(field, ALICE, FUND, 1, false, bytes32(0), "");
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(CUSTOMER);
        ledger.subscribe(1, ALICE, FUND, 1, 1, 90, false, bytes32(0), 0, "");
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
        vm.expectRevert(FundLedger.InvalidState.selector);
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
    }

    // ── 철회·모의 결제·변경 불가 ─────────────────────────────

    function testWithdrawEndsSubscriptionOnly() public {
        diagnose(ALICE, 1, 3, 3, false);
        subscribeAs(1, ALICE, ELS, 1, true, RECORDING, "");
        vm.recordLogs();
        vm.prank(CUSTOMER);
        ledger.withdraw(1);
        require(vm.getRecordedLogs()[0].topics[0] == FundLedger.SaleWithdrawn.selector);
        require(status(1) == FundLedger.Status.Withdrawn && ledger.getSale(1).withdrawnAt == block.timestamp);
        vm.warp(block.timestamp + COOLING);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(CUSTOMER);
        ledger.withdraw(1);

        subscribeAs(2, ALICE, FUND, 1, false, bytes32(0), "");
        vm.prank(CUSTOMER);
        ledger.confirm(2);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(CUSTOMER);
        ledger.withdraw(2);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(CUSTOMER);
        ledger.confirm(2);
    }

    function testSettlementOnlyAfterConfirmationOnce() public {
        diagnose(ALICE, 1, 3, 3, false);
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(INFRA);
        ledger.recordSettlement(1);
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(INFRA);
        ledger.recordSettlement(1);
        vm.prank(CUSTOMER);
        ledger.confirm(1);
        vm.recordLogs();
        vm.prank(INFRA);
        ledger.recordSettlement(1);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        require(logs[0].topics[0] == FundLedger.SettlementRecorded.selector);
        require(
            abi.decode(logs[0].data, (uint256)) == AMOUNT && ledger.getSale(1).settledAt == block.timestamp
        );
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(INFRA);
        ledger.recordSettlement(1);
    }

    function testRecordedSaleAndDiagnosesNeverChange() public {
        diagnose(ALICE, 1, 3, 3, false);
        subscribeAs(1, ALICE, FUND, 1, false, bytes32(0), "");
        FundLedger.Sale memory before = ledger.getSale(1);
        // 새 회차, 새 상품 버전, 새 기준은 기존 기록을 바꾸지 않는다.
        diagnose(ALICE, 2, 1, 6, true);
        vm.prank(SELLER);
        ledger.registerProduct(FUND, "fund-v2", 6, false, false);
        vm.prank(SELLER);
        ledger.registerRule(RULE_2, 2, "rule-v2");
        vm.expectRevert(FundLedger.InvalidState.selector);
        vm.prank(CUSTOMER);
        ledger.subscribe(1, ALICE, FUND, 2, 2, 90, false, bytes32(0), AMOUNT, "");
        FundLedger.Sale memory current = ledger.getSale(1);
        require(keccak256(abi.encode(before)) == keccak256(abi.encode(current)));
        FundLedger.Diagnosis memory first = ledger.getDiagnosis(ALICE, 1);
        require(first.profile == 3 && first.limit == 3 && first.commitment == 501 && !first.elderly);
        FundLedger.ProductVersion memory v1 = ledger.getProduct(FUND, 1);
        require(v1.riskGrade == 3 && v1.documentHash == keccak256("fund-v1"));
    }
}
