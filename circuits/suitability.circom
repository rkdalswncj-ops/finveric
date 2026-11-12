pragma circom 2.2.3;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// v5 범용 진단 회로. 진단 기준은 비공개 입력이고 ruleHash로 묶는다.
// 공개 신호 순서: profile, limit, elderly, commitment, chainId, ledger, customerRef, attempt, ruleHash.
// 기준 필드 배열과 해시 순서는 packages/core/src/rules.ts의 ruleFields()·ruleHash()와 같다.

// x가 1..n 중 하나인지 검사한다.
template OneOf(n) {
    signal input in;
    signal product[n];
    product[0] <== in - 1;
    for (var k = 1; k < n; k++) product[k] <== product[k - 1] * (in - 1 - k);
    product[n - 1] === 0;
}

template Suitability() {
    var Q = 10;
    var O = 5;

    // 비공개 입력: 답변, 임의값, 진단 기준 값.
    signal input answers[Q];
    signal input salt;
    signal input optionCount[Q];
    signal input score[Q][O];
    signal input cap[Q][O];
    signal input elderly[Q][O];
    signal input threshold[4];
    signal input matrix[5];
    signal input textHash;

    // 공개 입력. 이 선언 순서가 공개 신호 순서다.
    signal input commitment;
    signal input chainId;
    signal input ledger;
    signal input customerRef;
    signal input attempt;
    signal input ruleHash;

    signal output profile;
    signal output limit;
    signal output elderlyOut;

    // 1. 문항마다 선택지 수(1..5)와 답변 범위를 검사하고 고른 선택지를 one-hot으로 고른다.
    component countRange[Q];
    component pick[Q][O];
    component inRange[Q];
    component scoreBits[Q];
    component capRange[Q];
    signal picked[Q][O][3];
    signal selectedScore[Q];
    signal selectedCap[Q];
    signal selectedElderly[Q];
    var total = 0;
    for (var q = 0; q < Q; q++) {
        countRange[q] = OneOf(5);
        countRange[q].in <== optionCount[q];

        var hits = 0;
        var s = 0;
        var c = 0;
        var e = 0;
        for (var o = 0; o < O; o++) {
            pick[q][o] = IsEqual();
            pick[q][o].in[0] <== answers[q];
            pick[q][o].in[1] <== o;
            hits += pick[q][o].out;
            picked[q][o][0] <== pick[q][o].out * score[q][o];
            picked[q][o][1] <== pick[q][o].out * cap[q][o];
            picked[q][o][2] <== pick[q][o].out * elderly[q][o];
            s += picked[q][o][0];
            c += picked[q][o][1];
            e += picked[q][o][2];
        }
        // 답변은 0..4 중 정확히 하나다.
        hits === 1;
        // 답변 < 선택지 수. 두 값 모두 3비트 안이다.
        inRange[q] = LessThan(3);
        inRange[q].in[0] <== answers[q];
        inRange[q].in[1] <== optionCount[q];
        inRange[q].out === 1;

        selectedScore[q] <== s;
        selectedCap[q] <== c;
        selectedElderly[q] <== e;
        scoreBits[q] = Num2Bits(4);
        scoreBits[q].in <== selectedScore[q];
        capRange[q] = OneOf(6);
        capRange[q].in <== selectedCap[q];
        selectedElderly[q] * (selectedElderly[q] - 1) === 0;
        total += selectedScore[q];
    }

    // 2. 점수 합계와 등급 구간으로 투자성향(1..5)을 계산한다. 합계는 최대 150이다.
    component thresholdBits[4];
    component reached[4];
    var level = 1;
    for (var k = 0; k < 4; k++) {
        thresholdBits[k] = Num2Bits(8);
        thresholdBits[k].in <== threshold[k];
        reached[k] = GreaterEqThan(9);
        reached[k].in[0] <== total;
        reached[k].in[1] <== threshold[k];
        level += reached[k].out;
    }
    profile <== level;

    // 3. 투자성향의 적합성 기준값과 고른 선택지의 추출 조건 중 가장 보수적인 값(큰 등급)을 고른다.
    component isProfile[5];
    signal matrixTerm[5];
    var base = 0;
    for (var k = 0; k < 5; k++) {
        isProfile[k] = IsEqual();
        isProfile[k].in[0] <== profile;
        isProfile[k].in[1] <== k + 1;
        matrixTerm[k] <== isProfile[k].out * matrix[k];
        base += matrixTerm[k];
    }
    signal baseLimit;
    baseLimit <== base;
    component baseRange = OneOf(6);
    baseRange.in <== baseLimit;

    signal running[Q + 1];
    signal raise[Q];
    component below[Q];
    running[0] <== baseLimit;
    for (var q = 0; q < Q; q++) {
        below[q] = LessThan(3);
        below[q].in[0] <== running[q];
        below[q].in[1] <== selectedCap[q];
        raise[q] <== below[q].out * (selectedCap[q] - running[q]);
        running[q + 1] <== running[q] + raise[q];
    }
    limit <== running[Q];

    // 4. 고른 선택지 중 하나라도 고령 표시가 있으면 1이다.
    signal anyElderly[Q + 1];
    anyElderly[0] <== 0;
    for (var q = 0; q < Q; q++) {
        anyElderly[q + 1] <== anyElderly[q] + selectedElderly[q] - anyElderly[q] * selectedElderly[q];
    }
    elderlyOut <== anyElderly[Q];

    // 5. 기준 값 176개가 공개 기준 해시와 같아야 한다.
    component chunk[11];
    for (var q = 0; q < Q; q++) {
        chunk[q] = Poseidon(16);
        chunk[q].inputs[0] <== optionCount[q];
        for (var o = 0; o < O; o++) {
            chunk[q].inputs[1 + o * 3] <== score[q][o];
            chunk[q].inputs[2 + o * 3] <== cap[q][o];
            chunk[q].inputs[3 + o * 3] <== elderly[q][o];
        }
    }
    chunk[10] = Poseidon(16);
    for (var k = 0; k < 4; k++) chunk[10].inputs[k] <== threshold[k];
    for (var k = 0; k < 5; k++) chunk[10].inputs[4 + k] <== matrix[k];
    chunk[10].inputs[9] <== textHash;
    for (var k = 10; k < 16; k++) chunk[10].inputs[k] <== 0;
    component rule = Poseidon(11);
    for (var k = 0; k < 11; k++) rule.inputs[k] <== chunk[k].out;
    ruleHash === rule.out;

    // 6. 답변 커밋먼트를 원장·고객 가명 ID·회차·기준에 묶는다.
    component hash = Poseidon(16);
    for (var q = 0; q < Q; q++) hash.inputs[q] <== answers[q];
    hash.inputs[10] <== salt;
    hash.inputs[11] <== chainId;
    hash.inputs[12] <== ledger;
    hash.inputs[13] <== customerRef;
    hash.inputs[14] <== attempt;
    hash.inputs[15] <== ruleHash;
    commitment === hash.out;
}

component main { public [commitment, chainId, ledger, customerRef, attempt, ruleHash] } = Suitability();
