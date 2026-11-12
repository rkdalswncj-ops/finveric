import { useEffect, useState } from "react";
import { ArrowRight, Landmark, Layers, Store } from "lucide-react";
import type { HealthResponse } from "../../../../packages/core/src/api.ts";
import { Badge, Facts } from "../../../../packages/ui/src/components.tsx";
import { useDeployment } from "../../../../packages/ui/src/deployment.ts";
import s from "./entry.module.css";

const ignore = () => {};
const roles = [
  {
    href: "/client/",
    icon: Store,
    who: "판매사",
    title: "판매사 콘솔",
    text: "진단 기준과 판매 상품을 관리해요. 판매 건, 관리자 승인, 위험 신호를 봐요.",
    go: "콘솔 열기",
  },
  {
    href: "/auditor/",
    icon: Landmark,
    who: "감독기관",
    title: "감독기관 화면",
    text: "판매 건을 원장과 대조해요. 판매사가 낸 원본이 기록과 같은지 확인해요.",
    go: "감독기관 화면 열기",
  },
];

/** 사이트 루트(/)의 진입 화면. 역할을 고르고 연결된 원장 상태를 본다. */
export function Entry() {
  const deployment = useDeployment(ignore);
  const [health, setHealth] = useState<"loading" | "ok" | "fail" | "down">(
    "loading",
  );
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((result) => setHealth(result.ok ? "ok" : "fail"))
      .catch(() => setHealth("down"));
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
        판매 과정을 단계마다 기록하고, 판매사 밖에서 검증해요
      </h1>
      <p className={s.lead}>
        투자성향 진단, 적합성 판정, 설명 확인을 공동 원장에 남겨요. 판매사도
        기록을 바꿀 수 없고, 감독기관은 판매사를 거치지 않고 확인해요.
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
      <div className={s.grid}>
        <section aria-labelledby="demo-title">
          <h2 id="demo-title">시연 순서</h2>
          <ol>
            <li>판매사 콘솔에서 상품과 진단 기준을 원장에 등록해요.</li>
            <li>
              판매 채널 시연(증권사 앱 화면)에서 고객이 진단하고 가입해요.
            </li>
            <li>세 번째 진단부터는 판매사 관리자가 승인해요.</li>
            <li>감독기관 화면에서 같은 판매 건을 원장과 대조해요.</li>
            <li>판매 채널 시연에서 고객이 가입 증명서로 기록을 확인해요.</li>
          </ol>
        </section>
        <section aria-labelledby="ledger-title">
          <h2 id="ledger-title">연결된 원장</h2>
          <Facts
            rows={[
              [
                "상태",
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
                </Badge>,
              ],
              [
                "네트워크",
                deployment
                  ? deployment.chainId === 11155111
                    ? "Sepolia 테스트넷"
                    : "Anvil 테스트 원장"
                  : "설정 대기",
              ],
              ["원장 버전", deployment ? `v${deployment.ledgerVersion}` : "—"],
              ["컨트랙트", <code>{deployment?.ledger ?? "—"}</code>],
            ]}
          />
        </section>
      </div>
      <p className={s.foot}>
        테스트용 상품, 가상 고객, 테스트 원장으로 시연해요. 실제 자금과
        개인정보는 쓰지 않아요.
      </p>
    </main>
  );
}
