import { Link } from "react-router";
import {
  PRODUCTS,
  RULE_HASH,
  type Deployment,
  type Trace,
} from "../../../../../packages/core/src/index.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
} from "../../../../../packages/ui/src/components.tsx";
import {
  profileName,
  saleProductName,
  short,
  status,
  type Sale,
} from "../../../../../packages/ui/src/sale.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import { awaitingApproval, riskSignals } from "../signals.ts";
import { registrationStatus } from "../traces.ts";

const s = { ...ui, ...client, ...local };

/** 판매사 콘솔의 첫 화면. 판매 건, 승인 대기, 위험 신호, 적용 기준을 요약한다. */
export function Dashboard({
  sales,
  traces,
  deployment,
  open,
}: {
  sales: Sale[];
  traces: Trace[];
  deployment?: Deployment;
  open: (id: string) => void;
}) {
  const { ruleRegistered, productsRegistered } = registrationStatus(
    traces,
    deployment?.ledger,
  );
  const signals = riskSignals(sales);
  const inProgress = sales.filter((sale) => !sale.state.finalized);
  const enrolled = sales.filter((sale) => sale.state.finalized);
  const approvals = sales.filter(awaitingApproval);
  const recent = [...sales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const stats = [
    { label: "진행 중인 가입", value: inProgress.length, to: "/review" },
    { label: "가입 확정", value: enrolled.length, to: "/review" },
    { label: "관리자 승인 대기", value: approvals.length, to: "/review" },
    { label: "위험 신호", value: signals.length, to: "/signals" },
  ];
  return (
    <>
      <Heading
        title="판매 현황을 확인하세요"
        description="판매 건과 관리자 승인 대기, 위험 신호를 확인하세요. 모든 판정은 원장에 등록한 기준으로 기록합니다."
      />
      <div className={s.stats}>
        {stats.map((stat) => (
          <Link key={stat.label} className={s.stat} to={stat.to}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>건</small>
          </Link>
        ))}
      </div>
      <div className={s.detailGrid}>
        <section className={`${s.panel} ${s.tableWrap}`}>
          <table>
            <caption>최근 판매 건</caption>
            <thead>
              <tr>
                <th scope="col">판매 ID</th>
                <th scope="col">상품</th>
                <th scope="col">판매 절차</th>
                <th scope="col">진단</th>
                <th scope="col">보기</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <code title={sale.id}>{short(sale.id)}</code>
                  </td>
                  <td>{saleProductName(sale)}</td>
                  <td>
                    <Badge
                      tone={
                        sale.state.finalized
                          ? "success"
                          : awaitingApproval(sale)
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {status(sale)}
                    </Badge>
                  </td>
                  <td>
                    {sale.attempts.length}회차 ·{" "}
                    {profileName(sale.attempts.at(-1)?.profile)}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => open(sale.id)}
                      aria-label={`${short(sale.id)} 판매 건 보기`}
                    >
                      보기
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 && (
            <p className={s.empty}>아직 판매 건이 없습니다.</p>
          )}
        </section>
        <aside className={`${s.panel} ${s.pad}`}>
          <h2>적용 기준</h2>
          <Facts
            rows={[
              [
                "진단 기준",
                <>
                  v3 ·{" "}
                  <Badge tone={ruleRegistered ? "success" : "neutral"}>
                    {ruleRegistered ? "등록 확인" : "등록 근거 없음"}
                  </Badge>
                </>,
              ],
              ["기준 지문", <code title={RULE_HASH}>{short(RULE_HASH)}</code>],
              [
                "판매 상품",
                <>
                  {PRODUCTS.length}종 ·{" "}
                  <Badge tone={productsRegistered ? "success" : "neutral"}>
                    {productsRegistered ? "등록 확인" : "등록 근거 없음"}
                  </Badge>
                </>,
              ],
            ]}
          />
          <Button variant="outline" asChild>
            <Link to="/rules">진단 기준 보기</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/products">상품 관리</Link>
          </Button>
        </aside>
      </div>
    </>
  );
}
