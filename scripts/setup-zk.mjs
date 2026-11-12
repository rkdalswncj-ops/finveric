// 시연용 증명 키와 Solidity Verifier를 만든다.
// 키 위치: FINVERIC_ZK_DIR(기본 circuits/build). Verifier: contracts/src/Groth16Verifier.sol.
// 회로가 같으면 기존 키를 다시 쓴다. 회로가 바뀌면 키를 새로 만든다. 그 뒤 원장을 새 주소에 배포해야 한다.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
};
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const dir = resolve(process.env.FINVERIC_ZK_DIR ?? "circuits/build");
const at = (name) => join(dir, name);
mkdirSync(dir, { recursive: true });
const source = "circuits/suitability.circom";
const sourceHash = sha256(source);
const manifestPath = at("manifest.json");
const verifier = "contracts/src/Groth16Verifier.sol";
const zkey = at("suitability.zkey");
const wasm = at("suitability_js/suitability.wasm");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : undefined;

const exportVerifier = () => {
  run("snarkjs", ["zkey", "export", "solidityverifier", zkey, verifier]);
  return sha256(verifier);
};

if (
  manifest?.sourceHash === sourceHash &&
  existsSync(zkey) &&
  existsSync(wasm) &&
  existsSync(at("verification_key.json"))
) {
  // 키는 그대로 쓴다. Verifier가 없거나 다른 키에서 만든 것이면 같은 키로 다시 만든다.
  // 키를 새로 만들면 이미 배포한 원장과 맞지 않는다.
  if (!existsSync(verifier) || sha256(verifier) !== manifest.verifierHash) {
    const verifierHash = exportVerifier();
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, verifierHash }, null, 2),
    );
  }
  console.log(
    `기존 시연용 증명 키를 사용합니다(${dir}). 키를 바꾸면 컨트랙트를 다시 배포해야 합니다.`,
  );
  process.exit(0);
}

console.log("Circom 2.2.3 회로를 컴파일합니다.");
// --O2는 선형 제약을 없애 제약 수를 줄인다(Poseidon 때문에 약 3배 차이).
run("circom2", [
  source,
  "--O2",
  "--r1cs",
  "--wasm",
  "--sym",
  "-l",
  "node_modules",
  "-o",
  dir,
]);
const info = spawnSync("snarkjs", ["r1cs", "info", at("suitability.r1cs")], {
  encoding: "utf8",
});
const count = (label) =>
  Number(
    new RegExp(`# of ${label}: (\\d+)`).exec(info.stdout + info.stderr)?.[1],
  );
const constraints = count("Constraints");
const publicSize = count("Public Inputs") + count("Outputs");
if (info.status !== 0 || !Number.isInteger(constraints))
  throw new Error("회로 제약 수를 읽지 못했습니다.");
// Groth16 도메인은 제약 수 + 공개 신호 수 + 1 이상이어야 한다. 최소 2^14를 쓴다.
let power = 14;
while (2 ** power < constraints + publicSize + 1) power++;
console.log(
  `제약 ${constraints}개 · 공개 신호 ${publicSize}개 · ptau 2^${power}`,
);

// 단일 운영자의 시연용 ceremony다. 운영에 쓰지 않는다.
// phase 1(ptau)은 회로와 무관하다. 같은 크기의 ptau가 있으면 다시 쓴다.
const ptau = at("pot-final.ptau");
if (!(existsSync(ptau) && manifest?.power === power)) {
  run("snarkjs", [
    "powersoftau",
    "new",
    "bn128",
    String(power),
    at("pot0.ptau"),
  ]);
  run("snarkjs", [
    "powersoftau",
    "contribute",
    at("pot0.ptau"),
    at("pot1.ptau"),
    "--name=FINVERIC demo",
    "-e=" + randomBytes(64).toString("hex"),
  ]);
  run("snarkjs", ["powersoftau", "prepare", "phase2", at("pot1.ptau"), ptau]);
}
run("snarkjs", [
  "groth16",
  "setup",
  at("suitability.r1cs"),
  ptau,
  at("initial.zkey"),
]);
run("snarkjs", [
  "zkey",
  "contribute",
  at("initial.zkey"),
  zkey,
  "--name=FINVERIC demo phase2",
  "-e=" + randomBytes(64).toString("hex"),
]);
run("snarkjs", ["zkey", "verify", at("suitability.r1cs"), ptau, zkey]);
run("snarkjs", [
  "zkey",
  "export",
  "verificationkey",
  zkey,
  at("verification_key.json"),
]);
const verifierHash = exportVerifier();
writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      sourceHash,
      verifierHash,
      constraints,
      power,
      setup: "single-operator-demo-only",
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
for (const name of ["pot0.ptau", "pot1.ptau", "initial.zkey"])
  rmSync(at(name), { force: true });
console.log("실제 Groth16 증명과 Solidity Verifier를 준비했습니다.");
