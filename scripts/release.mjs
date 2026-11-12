// 배포한 원장의 공개 설정과 증명 키를 deploy/<network>에 모은다.
// Vercel은 Git 저장소에서 빌드한다. .local과 circuits/build는 Git에 없으므로 이 배포본을 커밋한다.
// 증명 키(zkey)는 증명 생성에 쓰는 공개 파일이다. 개인키나 고객 원본은 넣지 않는다.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const network = process.argv[2];
if (!["local", "sepolia"].includes(network)) {
  console.error("사용법: node scripts/release.mjs <local|sepolia>");
  process.exit(1);
}
const deployment = `.local/deployment-${network}.json`;
// 증명 키 디렉터리. 배포 때 쓴 FINVERIC_ZK_DIR을 같이 지정한다.
const zk = process.env.FINVERIC_ZK_DIR ?? "circuits/build";
const zkey = join(zk, "suitability.zkey");
const wasm = join(zk, "suitability_js/suitability.wasm");
for (const file of [deployment, zkey, wasm])
  if (!existsSync(file)) {
    console.error(`${file}이 없습니다. 원장을 먼저 배포하세요.`);
    process.exit(1);
  }
const config = JSON.parse(readFileSync(deployment, "utf8"));
if (config.ledgerVersion !== 5) {
  console.error("원장 v5 배포 설정이 필요합니다. 원장을 다시 배포하세요.");
  process.exit(1);
}
const hash = createHash("sha256").update(readFileSync(zkey)).digest("hex");
if (config.proofKeyHash !== hash) {
  console.error(
    "현재 증명 키가 배포한 Verifier와 다릅니다. 배포본을 만들지 않습니다.",
  );
  process.exit(1);
}
const target = `deploy/${network}`;
mkdirSync(target, { recursive: true });
cpSync(deployment, `${target}/deployment.json`);
cpSync(zkey, `${target}/suitability.zkey`);
cpSync(wasm, `${target}/suitability.wasm`);
console.log(`${target}에 배포본을 만들었습니다. 원장 ${config.ledger}`);
