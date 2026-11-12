import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { randomBytes, createHash } from "node:crypto";

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
mkdirSync("circuits/build", { recursive: true });
const sourceHash = createHash("sha256")
  .update(readFileSync("circuits/suitability.circom"))
  .digest("hex");
const manifest = "circuits/build/manifest.json";
if (
  existsSync(manifest) &&
  JSON.parse(readFileSync(manifest)).sourceHash === sourceHash &&
  existsSync("contracts/src/Groth16Verifier.sol") &&
  existsSync("circuits/build/suitability.zkey") &&
  existsSync("circuits/build/suitability_js/suitability.wasm") &&
  existsSync("circuits/build/verification_key.json")
) {
  console.log(
    "기존 시연용 증명 키를 사용합니다. 키를 바꾸면 컨트랙트를 다시 배포해야 합니다.",
  );
  process.exit(0);
}
console.log("Circom 2.2.3 회로를 컴파일합니다.");
run("circom2", [
  "circuits/suitability.circom",
  "--r1cs",
  "--wasm",
  "--sym",
  "-l",
  "node_modules",
  "-o",
  "circuits/build",
]);
const p = "circuits/build/";
// This is a local, single-operator DEMO ceremony. Never use these parameters for production.
run("snarkjs", ["powersoftau", "new", "bn128", "11", p + "pot0.ptau"]);
run("snarkjs", [
  "powersoftau",
  "contribute",
  p + "pot0.ptau",
  p + "pot1.ptau",
  "--name=FINVERIC demo",
  "-e=" + randomBytes(64).toString("hex"),
]);
run("snarkjs", [
  "powersoftau",
  "prepare",
  "phase2",
  p + "pot1.ptau",
  p + "pot-final.ptau",
]);
run("snarkjs", [
  "groth16",
  "setup",
  p + "suitability.r1cs",
  p + "pot-final.ptau",
  p + "initial.zkey",
]);
run("snarkjs", [
  "zkey",
  "contribute",
  p + "initial.zkey",
  p + "suitability.zkey",
  "--name=FINVERIC demo phase2",
  "-e=" + randomBytes(64).toString("hex"),
]);
run("snarkjs", [
  "zkey",
  "verify",
  p + "suitability.r1cs",
  p + "pot-final.ptau",
  p + "suitability.zkey",
]);
run("snarkjs", [
  "zkey",
  "export",
  "verificationkey",
  p + "suitability.zkey",
  p + "verification_key.json",
]);
run("snarkjs", [
  "zkey",
  "export",
  "solidityverifier",
  p + "suitability.zkey",
  "contracts/src/Groth16Verifier.sol",
]);
writeFileSync(
  manifest,
  JSON.stringify(
    {
      sourceHash,
      setup: "single-operator-demo-only",
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
for (const name of ["pot0.ptau", "pot1.ptau", "initial.zkey"]) rmSync(p + name);
console.log("실제 Groth16 증명과 Solidity Verifier를 준비했습니다.");
