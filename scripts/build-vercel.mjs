// Vercel Build Output API v3 형식으로 웹과 API 함수를 만든다.
// 웹 빌드(npm run build) 뒤에 실행한다. 결과는 .vercel/output이다.
// https://vercel.com/docs/build-output-api
import { build } from "esbuild";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const fail = (message) => {
  console.error(`Vercel 빌드 중단: ${message}`);
  process.exit(1);
};
const network =
  process.env.NETWORK ?? (process.env.VERCEL ? "sepolia" : "local");
const chainIds = { local: 31337, sepolia: 11155111 };
if (!(network in chainIds)) fail("NETWORK는 local 또는 sepolia여야 합니다.");

// 배포할 때 쓴 증명 키와 설정. deploy/<network>는 Git에 커밋한 배포본이다.
// 없으면 로컬 실행 파일을 쓴다. 로컬 확인용이다. 증명 키는 FINVERIC_ZK_DIR(기본 circuits/build)에서 읽는다.
const release = `deploy/${network}`;
const zk = process.env.FINVERIC_ZK_DIR ?? "circuits/build";
const source = existsSync(`${release}/deployment.json`)
  ? {
      deployment: `${release}/deployment.json`,
      zkey: `${release}/suitability.zkey`,
      wasm: `${release}/suitability.wasm`,
    }
  : {
      deployment: `.local/deployment-${network}.json`,
      zkey: join(zk, "suitability.zkey"),
      wasm: join(zk, "suitability_js/suitability.wasm"),
    };
for (const file of Object.values(source))
  if (!existsSync(file))
    fail(
      `${file}이 없습니다. 원장을 배포한 뒤 npm run release:${network}를 실행하세요.`,
    );

const deployment = JSON.parse(readFileSync(source.deployment, "utf8"));
const keyHash = createHash("sha256")
  .update(readFileSync(source.zkey))
  .digest("hex");
if (deployment.proofKeyHash !== keyHash)
  fail("증명 키가 배포한 Verifier와 다릅니다. 배포 때 쓴 키를 사용하세요.");
if (deployment.chainId !== chainIds[network])
  fail(`배포 설정의 체인 ID가 ${network}와 다릅니다.`);
if (deployment.ledgerVersion !== 5)
  fail("판매 기록 원장 v5 배포 설정이 필요합니다.");

// 웹 빌드(apps/web/dist)를 그대로 사이트 루트에 둔다.
// 진입 화면은 /, 판매사 콘솔은 /client/, 감독기관·고객 검증은 /auditor/다.
// 검증 설정은 모든 페이지가 함께 쓰도록 사이트 루트에 둔다.
const web = "apps/web/dist";
for (const page of [
  `${web}/index.html`,
  `${web}/client/index.html`,
  `${web}/auditor/index.html`,
])
  if (!existsSync(page))
    fail(`${page}가 없습니다. npm run build를 먼저 실행하세요.`);

const out = ".vercel/output";
rmSync(out, { recursive: true, force: true });
cpSync(web, `${out}/static`, { recursive: true });
writeFileSync(
  `${out}/static/deployment.json`,
  JSON.stringify(deployment, null, 2) + "\n",
);

const func = `${out}/functions/api.func`;
await build({
  entryPoints: ["apps/api/src/vercel.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: `${func}/index.js`,
  legalComments: "none",
  logLevel: "warning",
  // 번들에 넣은 증명 키와 배포 설정을 함수 디렉터리 기준으로 읽는다.
  banner: { js: "process.env.FINVERIC_ROOT ||= __dirname;" },
  footer: {
    js: "const __handler = module.exports.default; module.exports = __handler; module.exports.default = __handler;",
  },
});
const copy = (from, to) => {
  mkdirSync(dirname(`${func}/${to}`), { recursive: true });
  cpSync(from, `${func}/${to}`);
};
copy(source.zkey, "circuits/build/suitability.zkey");
copy(source.wasm, "circuits/build/suitability_js/suitability.wasm");
copy(source.deployment, `.local/deployment-${network}.json`);
// 저장소 루트의 "type": "module"이 번들(CommonJS)에 적용되지 않게 한다.
writeFileSync(`${func}/package.json`, '{ "type": "commonjs" }\n');
writeFileSync(
  `${func}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      // Hobby 플랜의 최대 실행 시간이다. Sepolia 영수증 대기를 포함한다.
      maxDuration: 300,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/$", dest: "/index.html" },
        { src: "^/api(?:/(.*))?$", dest: "/api?__path=$1" },
        { handle: "filesystem" },
        { src: "^/client(?:/.*)?$", dest: "/client/index.html" },
        { src: "^/auditor(?:/.*)?$", dest: "/auditor/index.html" },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Vercel 빌드 완료: ${out} · ${network} · 원장 ${deployment.ledger}`,
);
