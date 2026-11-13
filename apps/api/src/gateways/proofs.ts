// 외부 연동: Groth16 증명 생성(snarkjs). 증명 키는 FINVERIC_ZK_DIR(기본 circuits/build)에서 읽는다.
import { groth16 } from "snarkjs";
import { randomBytes } from "node:crypto";
import {
  FIELD,
  PUBLIC_SIGNALS,
  proofInput,
  solidityProof,
  type DiagnosisContext,
  type Groth16Proof,
  type RuleDocument,
} from "@finveric/core";
import { ZK_FILES, zkPath } from "../../../../scripts/root.ts";

/** 1 이상 FIELD 미만의 임의값(10진 문자열). */
export const randomField = () =>
  (
    (BigInt(`0x${randomBytes(32).toString("hex")}`) % (FIELD - 1n)) +
    1n
  ).toString();

/** 진단 한 회차의 증명을 만든다. 공개 신호는 이름으로 돌려준다. */
export async function prove(
  rule: RuleDocument,
  answers: readonly number[],
  salt: string,
  context: DiagnosisContext,
) {
  const started = Date.now();
  const { proof, publicSignals } = await groth16.fullProve(
    proofInput(rule, answers, salt, context),
    zkPath(ZK_FILES.wasm),
    zkPath(ZK_FILES.zkey),
    undefined,
    undefined,
    { singleThread: true },
  );
  const signals = Object.fromEntries(
    PUBLIC_SIGNALS.map((name, i) => [name, BigInt(publicSignals[i])]),
  ) as Record<(typeof PUBLIC_SIGNALS)[number], bigint>;
  return {
    proof: solidityProof(proof as Groth16Proof),
    publicSignals,
    signals,
    ms: Date.now() - started,
  };
}
