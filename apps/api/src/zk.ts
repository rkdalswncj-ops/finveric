import { groth16 } from "snarkjs";
import { randomBytes } from "node:crypto";
import {
  RULE_HASH,
  DOCUMENT_HASH,
  field,
  diagnosisCommitment,
  type Answers,
  type Deployment,
} from "../../../packages/core/src/index.ts";
import { fromRoot } from "../../../scripts/root.ts";

export function commitment(
  answers: Answers,
  salt: string,
  context: {
    chainId: number;
    ledger: string;
    id: string;
    round: number;
    ruleHash?: string;
    documentHash?: string;
  },
) {
  return diagnosisCommitment(answers, salt, context).toString();
}
export const randomField = () =>
  (BigInt(`0x${randomBytes(31).toString("hex")}`) + 1n).toString();
export function validateAnswers(a: Answers) {
  if (
    ![a.loss, a.experience].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 2,
    )
  )
    throw new Error("허용 범위를 벗어난 답변입니다.");
}
export async function prove(
  answers: Answers,
  salt: string,
  committed: string,
  dep: Deployment,
  id: string,
  round: number,
  documentHash: string = DOCUMENT_HASH,
) {
  validateAnswers(answers);
  const input = {
    loss: answers.loss,
    experience: answers.experience,
    salt,
    commitment: committed,
    chainId: dep.chainId,
    ledger: BigInt(dep.ledger).toString(),
    saleId: id,
    attempt: round,
    rule: field(RULE_HASH),
    document: field(documentHash),
  };
  return groth16.fullProve(
    input,
    fromRoot("circuits/build/suitability_js/suitability.wasm"),
    fromRoot("circuits/build/suitability.zkey"),
    undefined,
    undefined,
    { singleThread: true },
  );
}
export async function solidityProof(proof: object, publicSignals: string[]) {
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  return JSON.parse(`[${calldata}]`) as [
    readonly [bigint, bigint],
    readonly [readonly [bigint, bigint], readonly [bigint, bigint]],
    readonly [bigint, bigint],
    readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
  ];
}
