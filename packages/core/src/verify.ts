import {
  createPublicClient,
  http,
  keccak256,
  decodeFunctionData,
  getAbiItem,
  parseEventLogs,
  recoverMessageAddress,
  type Hex,
  type PublicClient,
} from "viem";
import { anvil, sepolia } from "viem/chains";
import { poseidon10 } from "poseidon-lite/poseidon10";
import {
  ledgerAbi,
  ledgerAbiV3,
  ledgerAbiV2,
  legacyLedgerAbi,
  verifierAbi,
  FIELD,
  PRODUCTS,
  MIN_PROFILE,
  classifyProfile,
  diagnosisCommitment,
  deploymentRuleHash,
  hashObject,
  field,
  signatureMessage,
  legacySignatureMessage,
  reviewDigest,
  type Deployment,
  type EvidenceReceipt,
  type OriginalBundle,
  type Check,
  type ChainSale,
  type PreparedProof,
  type Product,
} from "./index.ts";

function publicClient(dep: Deployment) {
  return createPublicClient({
    chain: dep.chainId === 11155111 ? sepolia : anvil,
    transport: http(dep.rpcUrl, { timeout: 15_000, retryCount: 1 }),
  });
}

export async function requireDeployment(
  client: Pick<PublicClient, "getChainId" | "getCode">,
  dep: Deployment,
) {
  const [chainId, ledgerCode, verifierCode] = await Promise.all([
    client.getChainId(),
    client.getCode({ address: dep.ledger }),
    client.getCode({ address: dep.verifier }),
  ]);
  if (chainId !== dep.chainId)
    throw new Error("지정 RPC의 네트워크가 다릅니다.");
  if (
    !ledgerCode ||
    !verifierCode ||
    keccak256(ledgerCode) !== dep.ledgerCodeHash ||
    keccak256(verifierCode) !== dep.verifierCodeHash
  )
    throw new Error("컨트랙트 코드가 고정한 배포 설정과 다릅니다.");
}

function matchesSignals(
  dep: Deployment,
  id: string,
  round: number,
  commitment: bigint,
  signals: PreparedProof["signals"],
  ruleHash: Hex,
  documentHash: Hex,
) {
  return (
    signals[1] === commitment &&
    signals[2] === BigInt(dep.chainId) &&
    signals[3] === BigInt(dep.ledger) &&
    signals[4] === BigInt(id) &&
    signals[5] === BigInt(round) &&
    signals[6] === BigInt(field(ruleHash)) &&
    signals[7] === BigInt(field(documentHash))
  );
}

export async function verifyPreparedDiagnosis(
  dep: Deployment,
  id: string,
  round: number,
  expectedCommitment: string,
  proof: PreparedProof,
  product?: Product,
): Promise<number> {
  const { a, b, c, signals } = proof;
  const selected =
    product ?? (dep.ledgerVersion === 3 ? PRODUCTS[0] : undefined);
  if (
    !selected ||
    (dep.ledgerVersion === 4
      ? dep.ruleVersion !== 3
      : dep.ledgerVersion !== 3 || dep.ruleVersion !== 2) ||
    signals[0] < 1n ||
    signals[0] > 3n ||
    !matchesSignals(
      dep,
      id,
      round,
      BigInt(expectedCommitment),
      signals,
      deploymentRuleHash(dep),
      selected.documentHash,
    )
  )
    throw new Error("진단 증명이 이번 가입 신청과 일치하지 않아요.");
  const client = publicClient(dep);
  await requireDeployment(client, dep);
  if (
    !(await client.readContract({
      address: dep.verifier,
      abi: verifierAbi,
      functionName: "verifyProof",
      args: [a, b, c, signals],
    }))
  )
    throw new Error("투자성향 증명을 확인하지 못했어요.");
  return Number(signals[0]);
}

async function readEnrollment(
  client: Pick<PublicClient, "getTransaction" | "getTransactionReceipt">,
  dep: Deployment,
  hash: Hex,
) {
  const [tx, mined] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }),
  ]);
  const decoded = decodeFunctionData({ abi: ledgerAbi, data: tx.input });
  if (decoded.functionName !== "completeEnrollment") return;
  return {
    tx,
    mined,
    args: decoded.args,
    events: parseEventLogs({
      abi: ledgerAbi,
      logs: mined.logs.filter(
        (log) => log.address.toLowerCase() === dep.ledger.toLowerCase(),
      ),
    }),
  };
}

/** The caller supplies its installed deployment, never a chain/address/RPC from an evidence file. */
export async function verifyEvidence(
  dep: Deployment,
  id: string,
  receipt?: EvidenceReceipt,
  original?: OriginalBundle,
) {
  const evidenceVersion = dep.ledgerVersion ?? dep.ruleVersion ?? 1;
  const legacy = evidenceVersion === 1;
  const v4 = evidenceVersion === 4;
  const atomicLedger = v4 || evidenceVersion === 3;
  const ruleHash = deploymentRuleHash(dep);
  const abi = v4
    ? ledgerAbi
    : atomicLedger
      ? ledgerAbiV3
      : legacy
        ? legacyLedgerAbi
        : ledgerAbiV2;
  if (!/^[1-9][0-9]{0,76}$/.test(id) || BigInt(id) >= FIELD)
    throw new Error("판매 ID 형식을 확인하세요.");
  if (
    receipt &&
    (receipt.format !== `finveric-receipt-v${evidenceVersion}` ||
      receipt.saleId !== id ||
      receipt.chainId !== dep.chainId ||
      receipt.ledger.toLowerCase() !== dep.ledger.toLowerCase())
  )
    throw new Error(
      "영수증의 판매 ID 또는 원장이 지정한 검증 기준과 다릅니다.",
    );
  if (
    original &&
    (original.format !== `finveric-original-v${evidenceVersion}` ||
      original.saleId !== id ||
      !Array.isArray(original.attempts))
  )
    throw new Error("고객 원본 형식과 판매 ID를 확인하세요.");
  const client = publicClient(dep);
  await requireDeployment(client, dep);
  const state = await client.readContract({
    address: dep.ledger,
    abi,
    functionName: "getSale",
    args: [BigInt(id)],
  });
  if (state.productId === "0x" + "0".repeat(64))
    throw new Error("지정 원장에 없는 판매 ID입니다.");
  const product = v4
    ? PRODUCTS.find(({ id }) => id === state.productId)
    : PRODUCTS[0];
  if (!product)
    throw new Error("등록된 시연 상품에서 이 가입의 상품을 찾을 수 없어요.");
  if (state.attempts > 100)
    throw new Error("지원하는 진단 이력 크기를 초과했습니다.");
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });
  const [document, rule, minimumProfile] = await Promise.all([
    client.readContract({
      address: dep.ledger,
      abi: ledgerAbi,
      functionName: "documents",
      args: [product.id],
    }),
    client.readContract({
      address: dep.ledger,
      abi: ledgerAbi,
      functionName: "rules",
      args: [ruleHash],
    }),
    v4
      ? client.readContract({
          address: dep.ledger,
          abi: ledgerAbi,
          functionName: "minimumProfiles",
          args: [product.id],
        })
      : MIN_PROFILE,
  ]);
  const productVersionOk =
    state.productId === product.id &&
    state.documentHash === product.documentHash &&
    state.ruleHash === ruleHash &&
    document === product.documentHash &&
    minimumProfile === product.minimumProfile &&
    rule &&
    (!receipt ||
      (receipt.productId === state.productId &&
        receipt.documentHash === state.documentHash &&
        receipt.ruleHash === state.ruleHash));
  check(
    "상품·문서·규칙 버전",
    productVersionOk,
    `상품 ${product.document.product} · ${product.document.class} · 설명서 ${product.document.version} · 진단 규칙 v${dep.ruleVersion ?? 1}`,
  );

  const latest = await client.getBlockNumber();
  if (latest - BigInt(dep.blockNumber) > 200_000n)
    throw new Error(
      "조회 범위를 초과했습니다. 검증 배포의 시작 블록을 확인하세요.",
    );
  const diagnosisEvent = getAbiItem({ abi, name: "DiagnosisRecorded" });
  const higherRiskEvent = getAbiItem({
    abi: ledgerAbi,
    name: "HigherRiskConfirmed",
  });
  const signatureEvent = getAbiItem({
    abi: ledgerAbiV2,
    name: "MockSignatureConfirmed",
  });
  const completionEvent = getAbiItem({
    abi: ledgerAbi,
    name: "ConditionsVerified",
  });
  const diagnoses = [];
  const higherRiskConfirmations = [];
  const signatures = [];
  const completions = [];
  for (let from = BigInt(dep.blockNumber); from <= latest; from += 2000n) {
    const to = from + 1999n < latest ? from + 1999n : latest;
    const filter = {
      address: dep.ledger,
      args: { saleId: BigInt(id) },
      fromBlock: from,
      toBlock: to,
      strict: true,
    } as const;
    const [diagnosisLogs, higherRiskLogs, signatureLogs, completionLogs] =
      await Promise.all([
        client.getLogs({ ...filter, event: diagnosisEvent }),
        legacy ? [] : client.getLogs({ ...filter, event: higherRiskEvent }),
        !atomicLedger && state.signed
          ? client.getLogs({ ...filter, event: signatureEvent })
          : [],
        client.getLogs({ ...filter, event: completionEvent }),
      ]);
    diagnoses.push(...diagnosisLogs);
    higherRiskConfirmations.push(...higherRiskLogs);
    signatures.push(...signatureLogs);
    completions.push(...completionLogs);
  }
  const completion =
    completions.length === 1 && completions[0].args.attempt === state.attempts
      ? completions[0]
      : undefined;
  const atomic =
    atomicLedger && state.finalized && completion
      ? await readEnrollment(client, dep, completion.transactionHash)
      : undefined;
  const atomicEnvelopeOk =
    !!atomic &&
    !!completion &&
    atomic.mined.status === "success" &&
    atomic.tx.hash === completion.transactionHash &&
    atomic.mined.transactionHash === completion.transactionHash &&
    atomic.mined.blockHash === completion.blockHash &&
    atomic.tx.to?.toLowerCase() === dep.ledger.toLowerCase() &&
    atomic.tx.from.toLowerCase() === dep.roles.customer.toLowerCase() &&
    atomic.mined.to?.toLowerCase() === dep.ledger.toLowerCase() &&
    atomic.mined.from.toLowerCase() === atomic.tx.from.toLowerCase() &&
    atomic.args[0] === BigInt(id) &&
    atomic.args[1] === state.productId &&
    atomic.args[2] === state.documentHash &&
    atomic.args[3] === state.ruleHash &&
    atomic.args[4].length === state.attempts &&
    atomic.events.some(
      (event) =>
        event.eventName === "SaleOpened" &&
        event.args.saleId === BigInt(id) &&
        event.args.productId === state.productId &&
        event.args.documentHash === state.documentHash &&
        event.args.ruleHash === state.ruleHash,
    );
  let proofsOk = diagnoses.length === state.attempts && state.attempts > 0;
  let originalsOk =
    !!original &&
    original.attempts.length === state.attempts &&
    hashObject(original.document) === state.documentHash;
  const references: {
    round: number;
    profile?: number;
    legacyPassed?: boolean;
    txHash: Hex;
    block: string;
  }[] = [];
  const procedureReferences: {
    kind: "higher-risk" | "signature" | "completion";
    txHash: Hex;
    block: string;
  }[] = [];
  let finalDiagnosis: { commitment: bigint; profile: number } | undefined;
  for (let round = 1; round <= state.attempts; round++) {
    const attempt = await client.readContract({
      address: dep.ledger,
      abi,
      functionName: "getAttempt",
      args: [BigInt(id), round],
    });
    const signal =
      "profile" in attempt ? attempt.profile : Number(attempt.passed);
    if (round === state.attempts && attempt.recorded)
      finalDiagnosis = { commitment: attempt.commitment, profile: signal };
    const log = diagnoses.find((l) => l.args.attempt === round);
    if (!log || !attempt.recorded) {
      proofsOk = false;
      originalsOk = false;
      continue;
    }
    let proof: PreparedProof | undefined;
    if (atomicLedger) {
      if (
        atomicEnvelopeOk &&
        atomic &&
        atomic.tx.hash === log.transactionHash &&
        atomic.mined.blockHash === log.blockHash &&
        atomic.events.some(
          (event) =>
            event.eventName === "AnswersCommitted" &&
            event.args.saleId === BigInt(id) &&
            event.args.attempt === round &&
            event.args.commitment === attempt.commitment,
        ) &&
        atomic.events.some(
          (event) =>
            event.eventName === "DiagnosisRecorded" &&
            event.args.saleId === BigInt(id) &&
            event.args.attempt === round &&
            event.args.commitment === attempt.commitment &&
            event.args.profile === signal,
        )
      )
        proof = atomic.args[4][round - 1];
    } else {
      const [tx, mined] = await Promise.all([
        client.getTransaction({ hash: log.transactionHash }),
        client.getTransactionReceipt({ hash: log.transactionHash }),
      ]);
      const decoded = decodeFunctionData({ abi: ledgerAbiV2, data: tx.input });
      if (
        decoded.functionName === "recordDiagnosis" &&
        mined.status === "success" &&
        tx.to?.toLowerCase() === dep.ledger.toLowerCase() &&
        mined.blockHash === log.blockHash
      ) {
        const [saleId, attemptNo, a, b, c, signals] = decoded.args;
        if (saleId === BigInt(id) && attemptNo === round)
          proof = { a, b, c, signals };
      }
    }
    const valid =
      !!proof &&
      proof.signals[0] === BigInt(signal) &&
      (legacy || (signal >= 1 && signal <= 3)) &&
      matchesSignals(
        dep,
        id,
        round,
        attempt.commitment,
        proof.signals,
        state.ruleHash,
        state.documentHash,
      ) &&
      (await client.readContract({
        address: dep.verifier,
        abi: verifierAbi,
        functionName: "verifyProof",
        args: [proof.a, proof.b, proof.c, proof.signals],
      })) &&
      log.args.commitment === attempt.commitment &&
      ("profile" in log.args ? log.args.profile : Number(log.args.passed)) ===
        signal;
    proofsOk &&= valid;
    references.push({
      round,
      ...(legacy ? { legacyPassed: signal === 1 } : { profile: signal }),
      txHash: log.transactionHash,
      block: log.blockNumber.toString(),
    });
    if (original) {
      const raw = original.attempts[round - 1];
      const risk =
        legacy && raw?.answers && "risk" in raw.answers
          ? raw.answers.risk
          : undefined;
      if (
        !raw?.answers ||
        raw.round !== round ||
        !/^[0-9]{1,77}$/.test(raw.salt) ||
        BigInt(raw.salt) >= FIELD ||
        ![raw.answers.loss, raw.answers.experience].every(
          (v) => Number.isInteger(v) && v >= 0 && v <= 2,
        ) ||
        (legacy && risk !== 0 && risk !== 1)
      ) {
        originalsOk = false;
        continue;
      }
      const commitment = legacy
        ? poseidon10([
            BigInt(raw.answers.loss),
            BigInt(raw.answers.experience),
            BigInt(risk ?? 0),
            BigInt(raw.salt),
            BigInt(dep.chainId),
            BigInt(dep.ledger),
            BigInt(id),
            BigInt(round),
            BigInt(field(state.ruleHash)),
            BigInt(field(state.documentHash)),
          ])
        : diagnosisCommitment(raw.answers, raw.salt, {
            chainId: dep.chainId,
            ledger: dep.ledger,
            id,
            round,
            ruleHash: state.ruleHash,
            documentHash: state.documentHash,
          });
      originalsOk &&=
        commitment === attempt.commitment &&
        (legacy
          ? Number(classifyProfile(raw.answers) === MIN_PROFILE && risk === 1)
          : classifyProfile(raw.answers)) === signal;
    }
  }
  check(
    "진단 증명·전체 회차",
    proofsOk,
    `${state.attempts}개 회차 · EVM Verifier 재검증 · 거래 영수증·이벤트·상태 대조`,
  );
  check(
    "고객 원본 무결성",
    originalsOk,
    original
      ? "모든 답변·임의값의 Poseidon 커밋먼트와 설명서 지문 대조"
      : "고객 원본 파일을 열면 답변과 문서 변경을 확인할 수 있어요.",
  );
  const higherRiskConfirmed =
    "higherRiskConfirmed" in state && state.higherRiskConfirmed === true;
  let higherRiskOk = true;
  if (!legacy) {
    const required =
      !!finalDiagnosis && finalDiagnosis.profile < minimumProfile;
    const currentConfirmations = higherRiskConfirmations.filter(
      (log) => log.args.attempt === state.attempts,
    );
    let confirmed = false;
    if (required && higherRiskConfirmed && currentConfirmations.length === 1) {
      const [log] = currentConfirmations;
      if (atomicLedger) {
        confirmed =
          atomicEnvelopeOk &&
          !!atomic &&
          atomic.args[6] &&
          atomic.tx.hash === log.transactionHash &&
          atomic.mined.blockHash === log.blockHash &&
          atomic.events.some(
            (event) =>
              event.eventName === "HigherRiskConfirmed" &&
              event.args.saleId === BigInt(id) &&
              event.args.attempt === state.attempts,
          );
      } else {
        const mined = await client.getTransactionReceipt({
          hash: log.transactionHash,
        });
        confirmed =
          mined.status === "success" && mined.blockHash === log.blockHash;
      }
      if (confirmed) {
        procedureReferences.push({
          kind: "higher-risk",
          txHash: log.transactionHash,
          block: log.blockNumber.toString(),
        });
      }
    }
    higherRiskOk =
      !!finalDiagnosis &&
      (required
        ? confirmed
        : !higherRiskConfirmed && currentConfirmations.length === 0);
    check(
      "추가 위험 확인",
      higherRiskOk,
      !finalDiagnosis
        ? "투자성향 진단 기록을 기다리고 있어요."
        : required
          ? confirmed
            ? atomicLedger
              ? "가입 거래에 최종 진단의 추가 위험 확인이 포함돼 있어요."
              : "추가 위험 안내 확인 거래와 최종 진단 회차가 일치해요."
            : "이 펀드에 필요한 추가 위험 안내 확인을 기다리고 있어요."
          : "최종 투자성향에 해당하는 상품이에요. 추가 위험 확인 대상이 아니에요.",
    );
  }
  const atomicAuthorizationOk =
    atomicEnvelopeOk &&
    !!atomic &&
    state.signed &&
    atomic.events.some(
      (event) =>
        event.eventName === "EnrollmentAuthorized" &&
        event.args.saleId === BigInt(id) &&
        event.args.attempt === state.attempts &&
        event.args.customer.toLowerCase() === atomic.tx.from.toLowerCase(),
    );
  let signatureOk = atomicAuthorizationOk;
  if (
    original &&
    (original.format === "finveric-original-v1" ||
      original.format === "finveric-original-v2") &&
    original.signature &&
    original.signatureMessage &&
    finalDiagnosis
  ) {
    const expectedMessage = legacy
      ? legacySignatureMessage(
          dep,
          id,
          state.attempts,
          finalDiagnosis.commitment.toString(),
        )
      : signatureMessage(
          dep,
          id,
          state.attempts,
          finalDiagnosis.commitment.toString(),
          finalDiagnosis.profile,
        );
    try {
      signatureOk =
        original.signatureMessage === expectedMessage &&
        keccak256(original.signature) === state.signatureHash &&
        (
          await recoverMessageAddress({
            message: expectedMessage,
            signature: original.signature,
          })
        ).toLowerCase() === dep.roles.customer.toLowerCase();
    } catch {
      signatureOk = false;
    }
  }
  check(
    atomicLedger ? "고객 거래 서명" : "고객 모의 서명",
    signatureOk,
    atomicLedger
      ? "가입 거래의 발신 계정과 승인 이벤트를 지정한 고객 계정과 대조해요."
      : original
        ? legacy
          ? "가상 고객 키·최종 회차·답변·설명서에 연결한 서명 대조"
          : "테스트 계정과 최종 진단 회차, 설명서, 추가 위험 확인이 서명에 연결돼 있는지 확인해요."
        : "고객 원본 파일이 필요해요. 실제 전자서명은 아니에요.",
  );
  const currentSignatures = signatures.filter(
    (log) =>
      log.args.attempt === state.attempts &&
      log.args.commitment === finalDiagnosis?.commitment &&
      log.args.signatureHash === state.signatureHash,
  );
  if (atomicAuthorizationOk && atomic) {
    procedureReferences.push({
      kind: "signature",
      txHash: atomic.tx.hash,
      block: atomic.mined.blockNumber.toString(),
    });
  } else if (currentSignatures.length === 1) {
    const [log] = currentSignatures;
    const mined = await client.getTransactionReceipt({
      hash: log.transactionHash,
    });
    if (mined.status === "success" && mined.blockHash === log.blockHash) {
      procedureReferences.push({
        kind: "signature",
        txHash: log.transactionHash,
        block: log.blockNumber.toString(),
      });
    }
  }
  const explanationOk =
    state.explained &&
    (!atomicLedger ||
      (atomicEnvelopeOk &&
        !!atomic &&
        atomic.args[5] &&
        atomic.events.some(
          (event) =>
            event.eventName === "ExplanationConfirmed" &&
            event.args.saleId === BigInt(id) &&
            event.args.attempt === state.attempts &&
            event.args.documentHash === state.documentHash,
        )));
  let reviewOk = state.attempts < 3 || state.reviewed;
  if (atomicLedger && state.attempts >= 3) {
    reviewOk =
      reviewOk &&
      atomicEnvelopeOk &&
      !!atomic &&
      atomic.events.some(
        (event) =>
          event.eventName === "ReviewApproved" &&
          event.args.saleId === BigInt(id) &&
          event.args.attempt === state.attempts,
      );
    if (reviewOk && atomic) {
      try {
        reviewOk =
          (
            await recoverMessageAddress({
              message: { raw: reviewDigest(dep, id, atomic.args[4], product) },
              signature: atomic.args[7],
            })
          ).toLowerCase() === dep.roles.compliance.toLowerCase();
      } catch {
        reviewOk = false;
      }
    }
  }
  const signed = atomicLedger ? atomicAuthorizationOk : state.signed;
  const requiredRecordsOk = explanationOk && signed && higherRiskOk && reviewOk;
  check(
    "필수 확인 기록",
    requiredRecordsOk,
    `설명 ${explanationOk ? "확인" : "누락"} · ${atomicLedger ? "거래 서명" : "모의 서명"} ${signed ? "확인" : "누락"} · 관리자 승인 ${state.attempts < 3 ? "대상 아님" : reviewOk ? "완료" : "대기"}`,
  );
  let completed = false;
  if (state.finalized && completion) {
    if (atomicLedger) {
      completed =
        atomicEnvelopeOk &&
        !!atomic &&
        atomic.events.some(
          (event) =>
            event.eventName === "ConditionsVerified" &&
            event.args.saleId === BigInt(id) &&
            event.args.attempt === state.attempts,
        );
    } else {
      const mined = await client.getTransactionReceipt({
        hash: completion.transactionHash,
      });
      completed =
        mined.status === "success" && mined.blockHash === completion.blockHash;
    }
    if (completed) {
      procedureReferences.push({
        kind: "completion",
        txHash: completion.transactionHash,
        block: completion.blockNumber.toString(),
      });
    }
  }
  check(
    "가입 조건 검증 완료",
    completed &&
      proofsOk &&
      (legacy || requiredRecordsOk) &&
      (!v4 || productVersionOk),
    completed
      ? "성공 영수증·완료 이벤트·원장 상태 일치. 실제 매입과는 별도예요."
      : "원장에서 가입 조건 검증이 완료되지 않았어요.",
  );
  if (receipt) {
    if (
      !Array.isArray(receipt.transactions) ||
      receipt.transactions.length > 100
    )
      throw new Error("영수증의 거래 참조 형식을 확인하세요.");
    const unique = new Set(receipt.transactions);
    let referencesOk =
      unique.size === receipt.transactions.length &&
      unique.size > 0 &&
      diagnoses.every((log) => unique.has(log.transactionHash)) &&
      higherRiskConfirmations.every((log) => unique.has(log.transactionHash)) &&
      completions.every((log) => unique.has(log.transactionHash));
    for (const hash of unique) {
      const mined = await client.getTransactionReceipt({ hash });
      const events = parseEventLogs({ abi, logs: mined.logs });
      referencesOk &&=
        mined.status === "success" &&
        events.some(
          (log) =>
            log.address.toLowerCase() === dep.ledger.toLowerCase() &&
            "saleId" in log.args &&
            log.args.saleId === BigInt(id),
        );
    }
    check(
      "검증 영수증 거래 참조",
      referencesOk,
      "파일에 담긴 모든 거래의 성공 영수증과 같은 판매 ID 이벤트 대조",
    );
  }
  return {
    checks,
    references,
    procedureReferences,
    state: { ...state, higherRiskConfirmed } satisfies ChainSale,
    saleId: id,
    verifiedAt: new Date().toISOString(),
    network: dep.chainId,
  };
}
