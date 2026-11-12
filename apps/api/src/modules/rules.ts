// 판매사 소비자보호 담당: 진단 기준 버전 등록과 조회.
import {
  canonical,
  DEMO_RULE,
  ruleHash,
  validateRule,
  type RuleDocument,
} from "../../../../packages/core/src/index.ts";
import type { RuleEntry } from "../../../../packages/core/src/api.ts";
import type { FundService } from "../service.ts";
import type { StoredRule } from "../repositories/sales.ts";
import { readRule, readRuleCount } from "../gateways/ledger.ts";
import { send } from "./transactions.ts";

/** 등록한 기준을 버전 순서로 준다. 아직 기준이 없으면 시연 기준 v1을 미등록으로 함께 준다. */
export async function listRules(svc: FundService): Promise<RuleEntry[]> {
  const stored = [...svc.repository.rules()].sort(
    (a, b) => a.version - b.version,
  );
  const entries: RuleEntry[] = await Promise.all(
    stored.map(async (rule) => {
      const chain = await readRule(svc, rule.hash);
      return {
        document: rule.document,
        hash: rule.hash,
        version: rule.version,
        registered: chain.registered && chain.version === rule.version,
        txHash: rule.txHash,
      };
    }),
  );
  if ((await readRuleCount(svc)) === 0 && !entries.length)
    entries.push({
      document: DEMO_RULE,
      hash: ruleHash(DEMO_RULE),
      version: 1,
      registered: false,
    });
  return entries;
}

/** 원장의 최신 기준. 진단은 이 기준으로만 한다. */
export async function latestRule(svc: FundService): Promise<StoredRule> {
  const count = await readRuleCount(svc);
  if (count === 0) throw new Error("진단 기준을 먼저 등록하세요.");
  const rule = svc.repository.rules().find((entry) => entry.version === count);
  if (!rule)
    throw new Error(
      "원장의 최신 진단 기준 원문을 판매 기록에서 찾을 수 없어요.",
    );
  const chain = await readRule(svc, rule.hash);
  if (!chain.registered || chain.version !== count)
    throw new Error("최신 진단 기준이 원장 기록과 달라요.");
  return rule;
}

/**
 * 기준을 검사하고 다음 버전으로 원장에 등록한다. 원장에는 정렬한 JSON 원문을 남긴다.
 * 원문을 먼저 저장한다. 영수증 전에 서버가 멈춰도 원문을 잃지 않는다.
 */
export async function registerRule(
  svc: FundService,
  document: RuleDocument,
): Promise<RuleEntry> {
  const version = (await readRuleCount(svc)) + 1;
  const doc: RuleDocument = { ...document, version };
  const errors = validateRule(doc);
  if (errors.length)
    throw new Error(`진단 기준을 확인해 주세요. ${errors.join(" ")}`);
  const hash = ruleHash(doc);
  if ((await readRule(svc, hash)).registered)
    throw new Error(
      "이미 등록한 진단 기준이에요. 내용을 바꿔 새 버전을 만드세요.",
    );
  const stored: StoredRule = { document: doc, hash, version };
  svc.repository.addRule(stored);
  try {
    await send(
      svc,
      "seller",
      "registerRule",
      [BigInt(hash), version, canonical(doc)],
      {
        event: "RuleRegistered",
        match: (log) =>
          log.eventName === "RuleRegistered" &&
          log.args.ruleHash === BigInt(hash) &&
          log.args.version === version,
        onSubmitted: (txHash) => {
          stored.txHash = txHash;
        },
      },
    );
  } catch (error) {
    // 영수증을 기다리는 거래가 있으면 원문을 남긴다. 거절·실패면 지운다.
    const pending = svc.repository
      .traces()
      .some(
        ({ trace }) =>
          !!stored.txHash &&
          trace.txHash === stored.txHash &&
          trace.status === "pending",
      );
    if (!pending) svc.repository.removeRule(stored);
    throw error;
  }
  return {
    document: doc,
    hash,
    version,
    registered: true,
    txHash: stored.txHash,
  };
}
