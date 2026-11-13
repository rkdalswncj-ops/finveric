import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Landmark,
  Layers,
  Store,
} from "lucide-react";
import type { HealthResponse } from "@finveric/core/api";
import { api, ApiError } from "../shared/api.ts";
import { Badge } from "../shared/components.tsx";
import { useDeployment } from "../shared/deployment.ts";
import { networkName } from "../shared/format.ts";
import { API_DOCS_HREF, CHANNEL_APP_HREF } from "../shared/links.ts";
import ui from "../shared/ui.module.css";
import s from "./entry.module.css";

const roles = [
  {
    href: "/client/",
    icon: Store,
    who: "판매사",
    title: "판매사 콘솔",
    text: "진단 기준과 판매 상품을 관리합니다. 판매 건, 관리자 승인, 위험 신호를 봅니다.",
    go: "콘솔 열기",
  },
  {
    href: "/auditor/",
    icon: Landmark,
    who: "감독기관",
    title: "감독기관 화면",
    text: "판매 건을 원장과 대조합니다. 판매사가 낸 원본이 기록과 같은지 확인합니다.",
    go: "감독기관 화면 열기",
  },
];
/** 역할 카드 아래의 보조 링크. 새 탭으로 연다. */
const extras = [
  { href: API_DOCS_HREF, label: "API 문서" },
  { href: CHANNEL_APP_HREF, label: "증권사 앱 예시" },
];

/** 사이트 루트(/)의 진입 화면. 역할을 고르고 연결된 원장 상태를 본다. 기관이 읽으므로 합니다체로 쓴다. */
export function Entry() {
  const [configFailed, setConfigFailed] = useState(false);
  const deployment = useDeployment(
    useCallback(() => setConfigFailed(true), []),
  );
  const [health, setHealth] = useState<"loading" | "ok" | "fail" | "down">(
    "loading",
  );
  useEffect(() => {
    // 점검이 실패하면 API가 503을 돌려준다. 서버에 닿지 못하면 code가 offline이다.
    api<HealthResponse>("/health")
      .then((result) => setHealth(result.ok ? "ok" : "fail"))
      .catch((e: unknown) =>
        setHealth(
          e instanceof ApiError && e.code !== "offline" ? "fail" : "down",
        ),
      );
  }, []);
  return (
    <main className={s.page}>
      <div className={s.brand}>
        <span>
          <Layers size={20} />
        </span>
        FINVERIC
      </div>
      <h1 className={s.title}>
        판매 과정을 단계마다 기록하고, 판매사 밖에서 검증합니다
      </h1>
      <p className={s.lead}>
        투자성향 진단, 적합성 판정, 설명 확인을 공동 원장에 남깁니다. 판매사도
        기록을 바꿀 수 없습니다. 감독기관은 판매사를 거치지 않고 확인합니다.
      </p>
      <nav className={s.roles} aria-label="역할 선택">
        {roles.map((role) => (
          <a key={role.title} className={s.role} href={role.href}>
            <small>
              <role.icon size={16} />
              {role.who}
            </small>
            <strong>{role.title}</strong>
            <p>{role.text}</p>
            <span className={s.go}>
              {role.go}
              <ArrowRight size={16} />
            </span>
          </a>
        ))}
      </nav>
      <div className={s.extras}>
        <p>
          고객은 증권사 앱에서 가입합니다. 증권사 앱은 FINVERIC API를 씁니다.
        </p>
        <ul aria-label="API 연동">
          {extras.map((extra) => (
            <li key={extra.href}>
              <a href={extra.href} target="_blank" rel="noreferrer">
                {extra.label}
                <span className={ui.srOnly}> (새 탭에서 열기)</span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
      <section className={s.ledger} aria-labelledby="ledger-title">
        <h2 id="ledger-title">연결된 원장</h2>
        <dl>
          <div>
            <dt>상태</dt>
            <dd>
              <Badge
                tone={
                  health === "ok"
                    ? "success"
                    : health === "loading"
                      ? "neutral"
                      : "warning"
                }
              >
                {health === "ok"
                  ? "정상"
                  : health === "loading"
                    ? "확인 중"
                    : health === "fail"
                      ? "확인 필요"
                      : "API 연결 안 됨"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>네트워크</dt>
            <dd>
              {deployment
                ? networkName(deployment)
                : configFailed
                  ? "설정을 읽지 못함"
                  : "설정 대기"}
            </dd>
          </div>
          <div>
            <dt>원장 버전</dt>
            <dd>{deployment ? `v${deployment.ledgerVersion}` : "—"}</dd>
          </div>
          <div className={s.contract}>
            <dt>컨트랙트</dt>
            <dd>
              <code>{deployment?.ledger ?? "—"}</code>
            </dd>
          </div>
        </dl>
      </section>
      <p className={s.foot}>
        고객 번호와 개인정보는 원장에 남기지 않습니다. 원장은 고객을 가명 ID로만
        구분합니다.
      </p>
    </main>
  );
}
