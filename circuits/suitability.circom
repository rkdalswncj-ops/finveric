pragma circom 2.2.3;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Public order: profile, commitment, chainId, ledger, saleId, attempt, rule, document.
template Suitability() {
    signal input loss;
    signal input experience;
    signal input salt;
    signal input commitment;
    signal input chainId;
    signal input ledger;
    signal input saleId;
    signal input attempt;
    signal input rule;
    signal input document;
    signal output profile;

    signal lossProduct;
    signal experienceProduct;
    lossProduct <== loss * (loss - 1);
    lossProduct * (loss - 2) === 0;
    experienceProduct <== experience * (experience - 1);
    experienceProduct * (experience - 2) === 0;
    component balanced = GreaterEqThan(3);
    balanced.in[0] <== loss + experience;
    balanced.in[1] <== 2;
    component active = GreaterEqThan(3);
    active.in[0] <== loss + experience;
    active.in[1] <== 3;
    profile <== 1 + balanced.out + active.out;

    component hash = Poseidon(10);
    hash.inputs[0] <== loss;
    hash.inputs[1] <== experience;
    hash.inputs[2] <== 0;
    hash.inputs[3] <== salt;
    hash.inputs[4] <== chainId;
    hash.inputs[5] <== ledger;
    hash.inputs[6] <== saleId;
    hash.inputs[7] <== attempt;
    hash.inputs[8] <== rule;
    hash.inputs[9] <== document;
    commitment === hash.out;
}

component main { public [commitment, chainId, ledger, saleId, attempt, rule, document] } = Suitability();
