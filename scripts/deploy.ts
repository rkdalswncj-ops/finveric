// 원장 v5 배포. 증명 키(FINVERIC_ZK_DIR, 기본 circuits/build)에 맞는 Verifier와 원장을 배포한다.
// 결과: .local/deployment-<network>.json, apps/web/public/deployment.json.
// 이전 버전 원장의 배포 설정은 .local/deployment-<network>-v<버전>.json으로 보존한다. 화면은 v5만 검증한다.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEther,
  type Address,
} from "viem";
import { COOLING_PERIOD, environment, roles } from "./environment.ts";
import { json, type Deployment } from "@finveric/core";
import { proofKeyHash } from "./artifacts.ts";

const env = environment(process.argv[2]);
const client = createPublicClient({
  chain: env.chain,
  transport: http(env.rpcUrl),
});
if ((await client.getChainId()) !== env.chain.id)
  throw new Error("설정한 네트워크와 RPC의 chainId가 다릅니다.");
const wallet = createWalletClient({
  account: env.accounts.deployer,
  chain: env.chain,
  transport: http(env.rpcUrl),
});
if (
  env.network === "sepolia" &&
  (await client.getBalance({ address: wallet.account.address })) <
    parseEther("0.025")
) {
  throw new Error(
    `Sepolia 테스트 ETH가 부족합니다. ${wallet.account.address}에 약 0.03 Sepolia ETH를 충전하세요.`,
  );
}
const artifact = (name: string) =>
  JSON.parse(readFileSync(`out/${name}.sol/${name}.json`, "utf8"));
async function deploy(
  name: string,
  args: unknown[] = [],
): Promise<{ address: Address; block: bigint }> {
  const compiled = artifact(name);
  const hash = await wallet.deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode.object,
    args,
  });
  console.log(`${name} 거래: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 180_000,
  });
  if (receipt.status !== "success" || !receipt.contractAddress)
    throw new Error(`${name} 배포 실패`);
  return { address: receipt.contractAddress, block: receipt.blockNumber };
}
const deploymentPath = `.local/deployment-${env.network}.json`;
const previous: (Deployment & { ruleVersion?: number }) | undefined =
  existsSync(deploymentPath)
    ? JSON.parse(readFileSync(deploymentPath, "utf8"))
    : undefined;
const keyHash = proofKeyHash();
const priorVerifierCode =
  previous &&
  previous.proofKeyHash === keyHash &&
  previous.chainId === env.chain.id
    ? await client.getCode({ address: previous.verifier })
    : undefined;
const verifierAddress =
  previous &&
  priorVerifierCode &&
  keccak256(priorVerifierCode) === previous.verifierCodeHash
    ? previous.verifier
    : (await deploy("Groth16Verifier")).address;
const ledger = await deploy("FundLedger", [
  verifierAddress,
  env.accounts.seller.address,
  env.accounts.approver.address,
  env.accounts.customer.address,
  env.accounts.infrastructure.address,
  BigInt(COOLING_PERIOD),
]);
if (env.network === "sepolia") {
  // 판매사(등록·진단)가 거래를 가장 많이 보낸다.
  for (const role of roles.slice(1)) {
    const hash = await wallet.sendTransaction({
      to: env.accounts[role].address,
      value: parseEther(role === "seller" ? "0.006" : "0.003"),
    });
    const receipt = await client.waitForTransactionReceipt({
      hash,
      timeout: 180_000,
    });
    if (receipt.status !== "success")
      throw new Error(`${role} 테스트 ETH 충전 실패`);
  }
}
const publicRpc =
  env.network === "local"
    ? "http://127.0.0.1:8545"
    : (process.env.PUBLIC_RPC_URL ??
      "https://ethereum-sepolia-rpc.publicnode.com");
const rpc = new URL(publicRpc);
if (rpc.username || rpc.password || rpc.search)
  throw new Error("PUBLIC_RPC_URL에는 비공개 인증 정보를 넣을 수 없습니다.");
const result: Deployment = {
  ledgerVersion: 5,
  proofKeyHash: keyHash,
  chainId: env.chain.id as Deployment["chainId"],
  ledger: ledger.address,
  verifier: verifierAddress,
  blockNumber: ledger.block.toString(),
  rpcUrl: publicRpc,
  coolingPeriod: COOLING_PERIOD,
  roles: Object.fromEntries(
    roles.map((r) => [r, env.accounts[r].address]),
  ) as Deployment["roles"],
  verifierCodeHash: keccak256(
    (await client.getCode({ address: verifierAddress }))!,
  ),
  ledgerCodeHash: keccak256(
    (await client.getCode({ address: ledger.address }))!,
  ),
};
mkdirSync(".local", { recursive: true, mode: 0o700 });
mkdirSync("apps/web/public", { recursive: true });
// 이전 버전 원장의 기록은 그 주소에 남는다. 설정 파일만 보존한다.
const previousVersion = previous?.ledgerVersion ?? previous?.ruleVersion ?? 1;
const legacyPath = `.local/deployment-${env.network}-v${previousVersion}.json`;
if (previous && previousVersion !== 5 && !existsSync(legacyPath))
  copyFileSync(deploymentPath, legacyPath);
writeFileSync(deploymentPath, json(result));
writeFileSync("apps/web/public/deployment.json", json(result));
console.log(
  `배포 완료: 원장 v5 ${ledger.address} · 숙려 ${COOLING_PERIOD}초. 공개 검증 설정을 apps/web/public/deployment.json에 기록했습니다.`,
);
