import { Link } from "react-router";
import type {
  CustomerDto,
  ProductEntryDto,
  RuleEntryDto,
} from "@finveric/core/api";
import type { LoadState } from "../../shared/api.ts";
import { Button } from "../../shared/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Stat,
  TableScroll,
} from "../../shared/components.tsx";
import { dateTime, short } from "../../shared/format.ts";
import ui from "../../shared/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import { StatusBadge } from "../../shared/sale-components.tsx";
import { RegisterNotice } from "../components.tsx";
import {
  activeRule,
  awaitingApproval,
  latestProducts,
  nowSeconds,
  productName,
  saleProduct,
  type Sale,
} from "../../shared/sales.ts";
import { saleSignals } from "../signals.ts";

const s = { ...ui, ...client, ...local };

/** 판매사 콘솔의 첫 화면. 진행 중인 판매 건, 승인 대기, 위험 신호, 적용 기준을 요약한다. */
export function Dashboard({
  load,
  rules,
  products,
  sales,
  customer,
  busy,
  register,
  open,
}: {
  load: LoadState;
  rules: RuleEntryDto[];
  products: ProductEntryDto[];
  sales: Sale[];
  customer?: CustomerDto;
  busy: boolean;
  register: () => unknown;
  open: (id: string) => void;
}) {
  const now = nowSeconds();
  const rule = activeRule(rules);
  const selling = latestProducts(products);
  const drafts = sales.filter((sale) => sale.status === "draft");
  const subscribed = sales.filter((sale) => sale.status === "subscribed");
  const confirmed = sales.filter((sale) => sale.status === "confirmed");
  const approvals = sales.filter(awaitingApproval);
  const signals = saleSignals(customer, sales);
  const recent = [...sales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const failed = load === "failed";
  // 처음 읽기에 실패하면 0 대신 "—"를 보여 준다. 0건이라고 읽히지 않게 한다.
  const count = (value: number) => (failed ? "—" : value);
  const stats = [
    {
      label: "진행 중인 가입",
      value: count(drafts.length + subscribed.length),
      unit: "건",
      note: failed
        ? "불러오지 못했습니다"
        : `신청 ${drafts.length}건 · 숙려 중·확인 대기 ${subscribed.length}건`,
      to: "/review",
    },
    {
      label: "가입 확정",
      value: count(confirmed.length),
      unit: "건",
      to: "/review",
    },
    {
      label: "관리자 승인 대기",
      value: count(approvals.length),
      unit: "건",
      note: "3회차 이상 진단한 고객의 신청",
      to: "/review",
    },
    {
      label: "위험 신호",
      value: count(signals.length),
      unit: "건",
      note: "원장 기록 기준",
      to: "/signals",
    },
  ];
  return (
    <>
      <Heading
        title="판매 현황을 확인하세요"
        description="진행 중인 판매 건, 관리자 승인 대기, 위험 신호를 확인하세요. 모든 판정은 원장에 등록한 기준으로 기록합니다."
      />
      {load === "ready" && !rule && !selling.length && (
        <RegisterNotice busy={busy} register={register} />
      )}
      <div className={`${s.stats} ${s.dashboardStats}`}>
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </div>
      <div className={s.detailGrid}>
        <TableScroll label="최근 판매 건" as="section" className={s.panel}>
          <table>
            <caption className={s.tableCaption}>최근 판매 건</caption>
            <thead>
              <tr>
                <th scope="col">판매 ID</th>
                <th scope="col">상품</th>
                <th scope="col">상태</th>
                <th scope="col">회차</th>
                <th scope="col">적합성</th>
                <th scope="col">신청 시각</th>
                <th scope="col">보기</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((sale) => {
                const product = saleProduct(products, sale);
                const attempt = sale.chain?.attempt ?? sale.latestAttempt;
                return (
                  <tr key={sale.id}>
                    <td>
                      <code title={sale.id}>{short(sale.id)}</code>
                    </td>
                    <td className={s.wrapCell}>
                      {productName(product?.document)} v{sale.productVersion}
                    </td>
                    <td>
                      <StatusBadge sale={sale} now={now} />
                    </td>
                    <td>
                      {sale.status === "abandoned"
                        ? "—"
                        : attempt
                          ? `${attempt}회차`
                          : "진단 전"}
                    </td>
                    <td>
                      {sale.status === "abandoned" ||
                      sale.suitable === undefined
                        ? "—"
                        : sale.suitable
                          ? "적합"
                          : "부적합"}
                    </td>
                    <td>{dateTime(sale.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={s.linkButton}
                        onClick={() => open(sale.id)}
                        aria-label={`보기 · ${short(sale.id)} 판매 건`}
                      >
                        보기
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {recent.length === 0 && (
            <p className={s.empty}>
              {load === "ready"
                ? "아직 판매 건이 없습니다."
                : load === "failed"
                  ? "판매 건을 불러오지 못했습니다. 연결을 확인하고 화면을 새로 고치세요."
                  : "판매 건을 불러오고 있습니다."}
            </p>
          )}
        </TableScroll>
        <aside className={`${s.panel} ${s.pad}`}>
          <h2>적용 기준</h2>
          <Facts
            rows={[
              [
                "진단 기준",
                rule ? (
                  <>
                    v{rule.version} · <Badge tone="success">원장 등록</Badge>
                  </>
                ) : (
                  <Badge tone="warning">등록 전</Badge>
                ),
              ],
              ["기준 이름", rule?.document.name ?? "—"],
              ["기준 해시", rule ? <code>{rule.hash}</code> : "—"],
              [
                "판매 상품",
                selling.length ? (
                  <>
                    {selling.length}종 · <Badge tone="success">원장 등록</Badge>
                  </>
                ) : (
                  <Badge tone="warning">등록 전</Badge>
                ),
              ],
            ]}
          />
          <ul className={s.productList}>
            {selling.map(({ product }) => (
              <li key={product.id}>
                <span>{productName(product.document)}</span>
                <span className={s.versionText}>v{product.version}</span>
              </li>
            ))}
          </ul>
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
