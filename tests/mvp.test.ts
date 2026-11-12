import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  http,
  keccak256,
  parseEventLogs,
  type Hex,
} from "viem";
import { groth16 } from "snarkjs";
import { poseidon10 } from "poseidon-lite";
import { environment } from "../scripts/environment.ts";
import { proofKeyHash } from "../scripts/artifacts.ts";
// @ts-expect-error Portable JavaScript binary resolver.
import { foundryBinary } from "../scripts/foundry.mjs";
import { FundService } from "../apps/api/src/service.ts";
import { RedisStore } from "../apps/api/src/repositories/store.ts";
import { fakeUpstash } from "./fake-upstash.ts";
import { createApp } from "../apps/api/src/app.ts";
import {
  verifyEvidence,
  verifyPreparedDiagnosis,
} from "../packages/core/src/verify.ts";
import {
  ledgerAbi,
  verifierAbi,
  RULE_HASH,
  PRODUCTS,
  diagnosisCommitment,
  field,
  type Deployment,
  type Answers,
  type PreparedProof,
} from "../packages/core/src/index.ts";

const [balanced, bond, innovation] = PRODUCTS;
const readPreparedProof = (value: unknown): PreparedProof =>
  JSON.parse(JSON.stringify(value), (_key, item: unknown) =>
    typeof item === "string" ? BigInt(item) : item,
  );

test(
  "실제 회로·EVM·API·독립 검증으로 MVP 전체 경로를 검증한다",
  { timeout: 180_000 },
  async (t) => {
    // 새로 받은 저장소에는 .local이 없다.
    mkdirSync(".local", { recursive: true, mode: 0o700 });
    const directory = mkdtempSync(".local/test-");
    const node = spawn(
      foundryBinary("anvil"),
      ["--port", "18545", "--silent"],
      { stdio: "ignore" },
    );
    const env = { ...environment("local"), rpcUrl: "http://127.0.0.1:18545" };
    const client = createPublicClient({
      chain: env.chain,
      transport: http(env.rpcUrl, { timeout: 1000, retryCount: 0 }),
      pollingInterval: 50,
    });
    const wallet = createWalletClient({
      account: env.accounts.deployer,
      chain: env.chain,
      transport: http(env.rpcUrl),
    });
    t.after(() => {
      node.kill("SIGTERM");
      rmSync(directory, { recursive: true, force: true });
    });
    for (let i = 0; i < 100; i++) {
      try {
        await client.getChainId();
        break;
      } catch {
        if (i === 99) throw new Error("테스트 Anvil을 시작할 수 없습니다.");
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    const deploy = async (name: string, args: unknown[] = []) => {
      const artifact = JSON.parse(
        readFileSync(`out/${name}.sol/${name}.json`, "utf8"),
      );
      const hash = await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
        args,
      });
      const mined = await client.waitForTransactionReceipt({ hash });
      assert.equal(mined.status, "success");
      return mined.contractAddress!;
    };
    const verifier = await deploy("Groth16Verifier");
    const roleAddresses = Object.fromEntries(
      Object.entries(env.accounts).map(([r, a]) => [r, a.address]),
    ) as Deployment["roles"];
    const ledger = await deploy("FundLedger", [
      verifier,
      roleAddresses.manager,
      roleAddresses.seller,
      roleAddresses.compliance,
      roleAddresses.customer,
      roleAddresses.infrastructure,
    ]);
    const dep: Deployment = {
      ruleVersion: 3,
      ledgerVersion: 4,
      proofKeyHash: proofKeyHash(),
      chainId: 31337,
      ledger,
      verifier,
      roles: roleAddresses,
      blockNumber: "0",
      rpcUrl: env.rpcUrl,
      ledgerCodeHash: keccak256((await client.getCode({ address: ledger }))!),
      verifierCodeHash: keccak256(
        (await client.getCode({ address: verifier }))!,
      ),
    };
    const service = new FundService({
      env,
      dep,
      file: directory + "/sales.json",
    });
    await service.initialize();
    const app = await createApp(service);
    t.after(() => app.close());
    const request = async (path: string, body?: object) => {
      const response = await app.inject({
        method: body === undefined ? "GET" : "POST",
        url: "/api" + path,
        ...(body === undefined ? {} : { payload: body }),
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const blockNumber = () => client.getBlockNumber({ cacheTime: 0 });
    const reject = async (path: string, status: number, body?: object) => {
      const response = await app.inject({
        method: body === undefined ? "GET" : "POST",
        url: "/api" + path,
        ...(body === undefined ? {} : { payload: body }),
      });
      assert.equal(response.statusCode, status, response.body);
    };
    let salt = 0;
    const diagnose = (saleId: string, answers: Answers) =>
      request(`/sales/${saleId}/diagnose`, {
        ...answers,
        salt: String(++salt),
      });
    const decision = (
      attempt: { round: number; commitment: string; profile: number },
      higherRiskAccepted: boolean,
    ) => ({
      round: attempt.round,
      commitment: attempt.commitment,
      profile: attempt.profile,
      explanationAccepted: true as const,
      higherRiskAccepted,
    });
    await t.test(
      "상품 등록 전 가입과 허용 범위 밖 API 입력을 거절한다",
      async () => {
        await reject("/sales", 409, {});
        await reject("/sales/1/diagnose", 400, {
          loss: 3,
          experience: 1,
          salt: "1",
        });
        await reject("/sales/1/diagnose", 400, { loss: 0, experience: 1 });
      },
    );
    const beforeRegister = await blockNumber();
    await t.test(
      "세 상품과 진단 규칙을 한 번 등록하고 등록값을 재사용한다",
      async () => {
        await request("/register", {});
        assert.equal(await blockNumber(), beforeRegister + 4n);
        for (const product of PRODUCTS) {
          assert.equal(
            await client.readContract({
              address: ledger,
              abi: ledgerAbi,
              functionName: "documents",
              args: [product.id],
            }),
            product.documentHash,
          );
          assert.equal(
            await client.readContract({
              address: ledger,
              abi: ledgerAbi,
              functionName: "minimumProfiles",
              args: [product.id],
            }),
            product.minimumProfile,
          );
        }
        await request("/register", {});
        assert.equal(await blockNumber(), beforeRegister + 4n);
        await reject("/sales", 409, { productId: `0x${"0".repeat(64)}` });
      },
    );
    const registeredAt = await blockNumber();
    const { id } = await request("/sales", {});
    const salePath = `/sales/${id}`;
    let completionHash: Hex;
    let completionBlock: string;
    let accepted: ReturnType<typeof decision>;

    await t.test(
      "세 회차의 로컬 진단과 준법 검토가 거래를 만들지 않는다",
      async () => {
        const answers = { loss: 0, experience: 1 };
        const first = await diagnose(id, answers);
        assert.equal(first.productId, balanced.id);
        const expectedCommitment = diagnosisCommitment(answers, String(salt), {
          chainId: dep.chainId,
          ledger,
          id,
          round: 1,
          documentHash: balanced.documentHash,
        }).toString();
        const proof = readPreparedProof(first.preparedProof);
        assert.equal(
          await verifyPreparedDiagnosis(
            dep,
            id,
            1,
            expectedCommitment,
            proof,
            balanced,
          ),
          1,
        );
        await assert.rejects(() =>
          verifyPreparedDiagnosis(
            dep,
            id,
            2,
            expectedCommitment,
            proof,
            balanced,
          ),
        );
        await assert.rejects(() =>
          verifyPreparedDiagnosis(dep, id, 1, "1", proof, balanced),
        );
        await assert.rejects(() =>
          verifyPreparedDiagnosis(dep, id, 1, expectedCommitment, proof, bond),
        );
        for (const answers of [
          { loss: 1, experience: 2 },
          { loss: 1, experience: 1 },
        ])
          await diagnose(id, answers);
        const sale = await request(salePath);
        assert.deepEqual(
          sale.attempts.map((attempt: { profile: number }) => attempt.profile),
          [1, 3, 2],
        );
        assert.equal(sale.state.finalized, false);
        assert.equal(sale.state.signed, false);
        const rawSale = await service.chainSale(id);
        assert.equal(rawSale.attempts, 0);
        assert.equal(rawSale.finalized, false);
        assert.equal(await blockNumber(), registeredAt);
        await reject(`${salePath}/export/receipt`, 409);
        await reject(`${salePath}/export/original`, 409);

        accepted = decision(sale.attempts.at(-1), true);
        await reject(
          `${salePath}/confirm`,
          409,
          decision(first.attempts[0], true),
        );
        await reject(`${salePath}/confirm`, 409, {
          ...accepted,
          commitment: "1",
        });
        await reject(`${salePath}/confirm`, 409, { ...accepted, profile: 3 });
        await reject(`${salePath}/confirm`, 409, accepted);
        const reviewed = await request(`${salePath}/action/review`, {});
        assert.equal(reviewed.state.reviewed, true);
        assert.equal((await service.chainSale(id)).reviewed, false);
        assert.equal(await blockNumber(), registeredAt);
      },
    );

    await t.test(
      "세 회차 증명과 고객 확인을 한 거래로 확정하고 재요청은 같은 기록을 반환한다",
      async () => {
        const [completed, repeated] = await Promise.all([
          request(`${salePath}/confirm`, accepted),
          request(`${salePath}/confirm`, accepted),
        ]);
        assert.equal(completed.state.finalized, true);
        assert.equal(completed.productId, balanced.id);
        assert.equal(repeated.state.finalized, true);
        assert.equal(completed.state.signed, true);
        assert.equal(completed.state.higherRiskConfirmed, true);
        assert.equal(completed.state.reviewed, true);
        assert.equal(completed.state.purchaseState, 0);
        assert.equal(await blockNumber(), registeredAt + 1n);

        const receipt = await service.receipt(id);
        assert.equal(receipt.transactions.length, 1);
        [completionHash] = receipt.transactions;
        const mined = await client.getTransactionReceipt({
          hash: completionHash,
        });
        completionBlock = mined.blockNumber.toString();
        assert.equal(mined.status, "success");
        const events = parseEventLogs({ abi: ledgerAbi, logs: mined.logs });
        assert.deepEqual(
          events
            .filter((event) => event.eventName === "DiagnosisRecorded")
            .map((event) => event.args.profile),
          [1, 3, 2],
        );
        for (const eventName of [
          "ExplanationConfirmed",
          "HigherRiskConfirmed",
          "ReviewApproved",
          "EnrollmentAuthorized",
          "ConditionsVerified",
        ])
          assert.equal(
            events.filter((event) => event.eventName === eventName).length,
            1,
          );
        const tx = await client.getTransaction({ hash: completionHash });
        assert.equal(
          tx.from.toLowerCase(),
          roleAddresses.customer.toLowerCase(),
        );
        const decoded = decodeFunctionData({ abi: ledgerAbi, data: tx.input });
        if (decoded.functionName !== "completeEnrollment")
          assert.fail("가입 확정 거래가 아닙니다.");
        assert.equal(decoded.args[1], balanced.id);
        assert.equal(decoded.args[2], balanced.documentHash);
        assert.equal(decoded.args[3], RULE_HASH);
        assert.equal(decoded.args[4].length, 3);
        assert.equal(decoded.args[5], true);
        assert.equal(decoded.args[6], true);
        assert.notEqual(decoded.args[7], "0x");
        await reject(`${salePath}/action/abandon`, 409, {});
        assert.equal(await blockNumber(), registeredAt + 1n);
      },
    );

    const original = await service.original(id);
    const receipt = await service.receipt(id);
    await t.test(
      "RPC 독립 검증에서 진단과 고객 확인의 근거가 같은 거래로 표시된다",
      async () => {
        const result = await verifyEvidence(dep, id, receipt, original);
        assert.ok(
          result.checks.every((c) => c.ok),
          JSON.stringify(result.checks),
        );
        assert.deepEqual(
          result.references.map((ref) => ref.profile),
          [1, 3, 2],
        );
        for (const ref of result.references)
          assert.equal(ref.txHash, completionHash);
        assert.deepEqual(
          result.procedureReferences,
          (["higher-risk", "signature", "completion"] as const).map((kind) => ({
            kind,
            txHash: completionHash,
            block: completionBlock,
          })),
        );
        const altered = await verifyEvidence(
          dep,
          id,
          { ...receipt, transactions: [] },
          original,
        );
        assert.equal(
          altered.checks.find((c) => c.name === "검증 영수증 거래 참조")?.ok,
          false,
        );
      },
    );

    await t.test(
      "중단한 진단은 거래를 남기지 않고 새 가입 요청과 구분된다",
      async () => {
        const before = await blockNumber();
        const { id: abandoned } = await request("/sales", {});
        const draft = await diagnose(abandoned, { loss: 0, experience: 0 });
        await request(`/sales/${abandoned}/action/abandon`, {});
        await reject(`/sales/${abandoned}`, 409);
        await reject(
          `/sales/${abandoned}/confirm`,
          409,
          decision(draft.attempts[0], true),
        );
        assert.equal((await service.chainSale(abandoned)).attempts, 0);
        assert.equal(await blockNumber(), before);
        const { id: fresh } = await request("/sales", {});
        assert.notEqual(fresh, abandoned);
        await request(`/sales/${fresh}/action/abandon`, {});
        assert.equal(await blockNumber(), before);
      },
    );

    for (const [product, profile, answers, higherRisk] of [
      [balanced, 1, { loss: 0, experience: 0 }, true],
      [bond, 1, { loss: 0, experience: 0 }, false],
      [innovation, 1, { loss: 0, experience: 0 }, true],
      [innovation, 3, { loss: 2, experience: 2 }, false],
    ] as const) {
      await t.test(
        `${product.document.name} 성향 ${profile} 고객의 필요한 확인과 가입 거래 한 건을 검증한다`,
        async () => {
          const before = await blockNumber();
          const { id: selfDirected } = await request("/sales", {
            productId: product.id,
          });
          const path = `/sales/${selfDirected}`;
          const draft = await diagnose(selfDirected, answers);
          const [attempt] = draft.attempts;
          const data = decision(attempt, higherRisk);
          assert.equal(attempt.profile, profile);
          assert.equal(draft.productId, product.id);
          assert.equal(draft.state.documentHash, product.documentHash);
          await reject(`${path}/confirm`, 400, {});
          await reject(`${path}/confirm`, 400, {
            ...data,
            explanationAccepted: false,
          });
          if (higherRisk)
            await reject(`${path}/confirm`, 409, {
              ...data,
              higherRiskAccepted: false,
            });
          assert.equal((await service.chainSale(selfDirected)).signed, false);
          assert.equal(await blockNumber(), before);

          const completed = await request(`${path}/confirm`, data);
          assert.equal(completed.state.finalized, true);
          assert.equal(completed.productId, product.id);
          assert.equal(completed.state.productId, product.id);
          assert.equal(completed.state.documentHash, product.documentHash);
          assert.equal(completed.state.higherRiskConfirmed, higherRisk);
          assert.equal(await blockNumber(), before + 1n);
          const original = await service.original(selfDirected);
          const receipt = await service.receipt(selfDirected);
          assert.deepEqual(original.document, product.document);
          assert.equal(receipt.productId, product.id);
          assert.equal(receipt.documentHash, product.documentHash);
          assert.equal(receipt.transactions.length, 1);
          const verified = await verifyEvidence(
            dep,
            selfDirected,
            receipt,
            original,
          );
          assert.ok(
            verified.checks.every((c) => c.ok),
            JSON.stringify(verified.checks),
          );
          assert.deepEqual(
            verified.procedureReferences.map((ref) => ref.kind),
            higherRisk
              ? ["higher-risk", "signature", "completion"]
              : ["signature", "completion"],
          );
          assert.ok(
            verified.procedureReferences.every(
              (ref) => ref.txHash === receipt.transactions[0],
            ),
          );
        },
      );
    }

    await t.test(
      "모의 매입은 가입 뒤 별도 요청에서 반영하고 재요청에서 거래를 추가하지 않는다",
      async () => {
        const sale = await request(`${salePath}/action/purchase`, {});
        assert.equal(sale.state.units, "1000000");
        assert.equal(sale.state.purchaseState, 3);
        const before = await blockNumber();
        const repeated = await request(`${salePath}/action/purchase`, {});
        assert.equal(repeated.state.purchaseState, 3);
        assert.equal(await blockNumber(), before);
      },
    );
    await t.test(
      "답변 변경, 다른 상품의 문서·영수증 대체, 다른 원장을 탐지한다",
      async () => {
        const changed = structuredClone(original);
        changed.attempts[0].answers.loss = 2;
        const checked = await verifyEvidence(dep, id, receipt, changed);
        assert.equal(
          checked.checks.find((c) => c.name === "고객 원본 무결성")?.ok,
          false,
        );
        const changedDoc = { ...original, document: bond.document };
        assert.equal(
          (await verifyEvidence(dep, id, receipt, changedDoc)).checks.find(
            (c) => c.name === "고객 원본 무결성",
          )?.ok,
          false,
        );
        const changedReceipt = {
          ...receipt,
          productId: bond.id,
          documentHash: bond.documentHash,
        };
        assert.equal(
          (await verifyEvidence(dep, id, changedReceipt, original)).checks.find(
            (c) => c.name === "상품·문서·규칙 버전",
          )?.ok,
          false,
        );
        await assert.rejects(() =>
          verifyEvidence(
            dep,
            id,
            { ...receipt, ledger: roleAddresses.seller },
            original,
          ),
        );
      },
    );
    await t.test(
      "성향과 공개 입력을 바꾸거나 다른 판매에 실제 증명을 재사용할 수 없다",
      async () => {
        const tx = await client.getTransaction({ hash: completionHash });
        const decoded = decodeFunctionData({ abi: ledgerAbi, data: tx.input });
        if (decoded.functionName !== "completeEnrollment")
          assert.fail("가입 확정 거래가 아닙니다.");
        const { a, b, c, signals } = decoded.args[4][0];
        for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) {
          const modified = [...signals];
          modified[index] = index === 0 ? 3n : modified[index] + 1n;
          assert.equal(
            await client.readContract({
              address: verifier,
              abi: verifierAbi,
              functionName: "verifyProof",
              args: [a, b, c, modified as unknown as typeof signals],
            }),
            false,
          );
        }
        const customer = createWalletClient({
          account: env.accounts.customer,
          chain: env.chain,
          transport: http(env.rpcUrl),
        });
        const { id: another } = await request("/sales", {});
        const hash = await customer.writeContract({
          address: ledger,
          abi: ledgerAbi,
          functionName: "completeEnrollment",
          args: [
            BigInt(another),
            balanced.id,
            balanced.documentHash,
            RULE_HASH,
            [{ a, b, c, signals }],
            true,
            true,
            "0x",
          ],
          gas: 1_500_000n,
        });
        assert.equal(
          (await client.waitForTransactionReceipt({ hash })).status,
          "reverted",
        );
        const untouched = await service.chainSale(another);
        assert.equal(untouched.attempts, 0);
        assert.equal(untouched.finalized, false);
      },
    );
    await t.test(
      "같은 신청 번호의 증명을 다른 상품에 재사용하면 원장이 거절한다",
      async () => {
        const { id: another } = await request("/sales", { productId: bond.id });
        const draft = await diagnose(another, { loss: 0, experience: 0 });
        const proof = readPreparedProof(draft.preparedProof);
        const customer = createWalletClient({
          account: env.accounts.customer,
          chain: env.chain,
          transport: http(env.rpcUrl),
        });
        const hash = await customer.writeContract({
          address: ledger,
          abi: ledgerAbi,
          functionName: "completeEnrollment",
          args: [
            BigInt(another),
            innovation.id,
            innovation.documentHash,
            RULE_HASH,
            [proof],
            true,
            true,
            "0x",
          ],
          gas: 1_500_000n,
        });
        const mined = await client.getTransactionReceipt({ hash });
        assert.equal(mined.status, "reverted");
        assert.equal(mined.logs.length, 0);
        assert.equal((await service.chainSale(another)).attempts, 0);
        assert.equal((await request(`/sales/${another}`)).productId, bond.id);
      },
    );
    await t.test(
      "회로 자체가 범위 밖 선택지와 바꿔치기한 커밋먼트를 거절한다",
      async () => {
        for (const answers of [
          { loss: 3, experience: 1 },
          { loss: 1, experience: 3 },
        ]) {
          const committed = diagnosisCommitment(answers, "123", {
            chainId: 31337,
            ledger,
            id,
            round: 1,
            documentHash: balanced.documentHash,
          }).toString();
          await assert.rejects(() =>
            groth16.fullProve(
              {
                ...answers,
                salt: "123",
                commitment: committed,
                chainId: 31337,
                ledger: BigInt(ledger).toString(),
                saleId: id,
                attempt: 1,
                rule: field(RULE_HASH),
                document: field(balanced.documentHash),
              },
              "circuits/build/suitability_js/suitability.wasm",
              "circuits/build/suitability.zkey",
              undefined,
              undefined,
              { singleThread: true },
            ),
          );
        }
        const raw = original.attempts[0];
        assert.equal(
          poseidon10([
            BigInt(raw.answers.loss),
            BigInt(raw.answers.experience),
            0n,
            BigInt(raw.salt),
            31337n,
            BigInt(ledger),
            BigInt(id),
            1n,
            BigInt(field(RULE_HASH)),
            BigInt(field(balanced.documentHash)),
          ]).toString(),
          service.find(id).attempts[0].commitment,
        );
        await assert.rejects(() =>
          groth16.fullProve(
            {
              ...raw.answers,
              salt: raw.salt,
              commitment: "1",
              chainId: 31337,
              ledger: BigInt(ledger).toString(),
              saleId: id,
              attempt: 1,
              rule: field(RULE_HASH),
              document: field(balanced.documentHash),
            },
            "circuits/build/suitability_js/suitability.wasm",
            "circuits/build/suitability.zkey",
            undefined,
            undefined,
            { singleThread: true },
          ),
        );
      },
    );
    await t.test(
      "공개 조회와 로그에 답변·임의값·총점·개인키가 없다",
      async () => {
        for (const path of ["/sales", "/traces"]) {
          const data = JSON.stringify(await request(path));
          assert.doesNotMatch(data, /"(answers|salt|score|privateKey)"/);
        }
        assert.equal(receipt.format, "finveric-receipt-v4");
        assert.equal(original.format, "finveric-original-v4");
      },
    );
    await t.test(
      "여러 서버 인스턴스가 같은 저장소를 써도 판매 기록을 잃지 않는다",
      async () => {
        const upstash = fakeUpstash();
        const instance = () =>
          new FundService({
            env,
            dep,
            store: new RedisStore({
              url: "https://example.upstash.io",
              token: "test-token",
              key: "finveric:shared-test",
              fetch: upstash.fetch,
            }),
          });
        const [a, b, reader] = [instance(), instance(), instance()];
        await a.initialize();
        const [first, second] = await Promise.all([
          a.exclusive(() => a.open(balanced.id)),
          b.exclusive(() => b.open(bond.id)),
        ]);
        // 다른 인스턴스는 잠금 없이 조회해도 두 기록을 모두 본다.
        const seen = await reader.view(async () =>
          reader.sales.map((sale) => sale.id),
        );
        assert.deepEqual(new Set(seen), new Set([first.id, second.id]));
        // 다른 인스턴스가 만든 신청을 이어서 진단할 수 있다.
        await b.exclusive(() =>
          b.diagnose(first.id, {
            loss: 1,
            experience: 1,
            salt: String(9_000_000 + ++salt),
          }),
        );
        const attempts = await reader.view(
          async () => reader.find(first.id).attempts.length,
        );
        assert.equal(attempts, 1);
        // 조회 중 영수증 대조 결과는 잠금 없이 저장하지 않는다.
        const before = upstash.values.get("finveric:shared-test:sales")?.value;
        await reader.view(() => reader.publicTraces());
        assert.equal(
          upstash.values.get("finveric:shared-test:sales")?.value,
          before,
        );
      },
    );
    await t.test(
      "서버 재시작 뒤 확정 이력을 복구하고 거래를 중복 제출하지 않는다",
      async () => {
        const trace = service
          .find(id)
          .traces.find((item) => item.txHash === completionHash);
        assert.ok(trace);
        trace.status = "pending";
        service.save();
        const before = await blockNumber();
        const recovered = new FundService({ env, dep, file: service.file });
        await recovered.initialize();
        assert.equal(
          (await recovered.confirm(id, accepted)).state.finalized,
          true,
        );
        assert.equal(
          recovered
            .find(id)
            .traces.find((item) => item.txHash === completionHash)?.status,
          "confirmed",
        );
        assert.equal(await blockNumber(), before);
      },
    );
    await t.test(
      "외부 시연의 접근 코드가 없으면 고객 원본을 내려받을 수 없다",
      async () => {
        process.env.DEMO_TOKEN = "test-token-32-characters-minimum-12345";
        const gated = await createApp(service);
        try {
          assert.equal(
            (await gated.inject({ url: `/api/sales/${id}/export/original` }))
              .statusCode,
            401,
          );
          assert.equal(
            (
              await gated.inject({
                url: `/api/sales/${id}/export/original`,
                headers: { authorization: `Bearer ${process.env.DEMO_TOKEN}` },
              })
            ).statusCode,
            200,
          );
        } finally {
          delete process.env.DEMO_TOKEN;
          await gated.close();
        }
      },
    );
  },
);
