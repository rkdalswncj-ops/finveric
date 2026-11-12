import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  FundFilter,
  Heading,
  TransactionFacts,
} from "../../../../../packages/ui/src/components.tsx";
import {
  enrollmentTrace,
  higherRiskStatus,
  profileName,
  saleProduct,
  saleProductName,
  short,
  status,
  type Sale,
} from "../../../../../packages/ui/src/sale.ts";
import type { SaleAction } from "../../../../../packages/core/src/api.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./operations.module.css";
import { Empty, History } from "../components.tsx";

const s = { ...ui, ...local };

export function Review({
  sales,
  sale,
  select,
  action,
  busy,
}: {
  sales: Sale[];
  sale?: Sale;
  select: (id: string) => void;
  action: (action: SaleAction) => unknown;
  busy: boolean;
}) {
  const [filter, setFilter] = useState("전체");
  const [productFilter, setProductFilter] = useState("");
  const productSales = sales.filter(
    (record) => !productFilter || saleProduct(record)?.id === productFilter,
  );
  const filters = ["전체", ...new Set(productSales.map(status))];
  const activeFilter = filters.includes(filter) ? filter : "전체";
  const filtered = productSales.filter(
    (record) => activeFilter === "전체" || status(record) === activeFilter,
  );
  const profile = sale?.attempts.at(-1)?.profile;
  const minimumProfile = saleProduct(sale)?.minimumProfile;
  const completion = enrollmentTrace(sale);
  return (
    <>
      <Heading
        title="판매 이력과 가입 거래를 확인하세요"
        description="투자성향과 고객 확인 기록을 조회하세요. 세 번째 진단부터는 관리자 승인이 필요합니다."
      />
      {sale ? (
        <>
          <FundFilter value={productFilter} change={setProductFilter} />
          <div className={s.chips} aria-label="판매 절차 상태 필터">
            {filters.map((value) => (
              <button
                key={value}
                aria-pressed={activeFilter === value}
                className={activeFilter === value ? s.chipActive : ""}
                onClick={() => setFilter(value)}
              >
                {value}{" "}
                {
                  productSales.filter(
                    (record) => value === "전체" || status(record) === value,
                  ).length
                }
              </button>
            ))}
          </div>
          <div className={`${s.panel} ${s.tableWrap} ${s.salesTable}`}>
            <table>
              <caption>
                판매 건 목록 · 같은 판매 ID의 전체 진단을 확인합니다.
              </caption>
              <thead>
                <tr>
                  <th scope="col">판매 ID</th>
                  <th scope="col">상품</th>
                  <th scope="col">판매 절차</th>
                  <th scope="col">진단</th>
                  <th scope="col">확인 기록</th>
                  <th scope="col">선택</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => {
                  const profile = record.attempts.at(-1)?.profile;
                  const minimumProfile = saleProduct(record)?.minimumProfile;
                  return (
                    <tr
                      key={record.id}
                      className={record.id === sale.id ? s.selectedRow : ""}
                    >
                      <td>
                        <code title={record.id}>{short(record.id)}</code>
                      </td>
                      <td>{saleProductName(record)}</td>
                      <td>
                        <Badge
                          tone={
                            record.state.finalized
                              ? "success"
                              : record.state.attempts >= 3 &&
                                  !record.state.reviewed
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {status(record)}
                        </Badge>
                      </td>
                      <td>
                        {record.attempts.length}회차 · {profileName(profile)}
                        {record.attempts.length > 1 ? " · 재진단" : ""}
                      </td>
                      <td>
                        {record.state.explained
                          ? "설명 확인"
                          : "설명 확인 대기"}{" "}
                        ·{" "}
                        {record.state.signed
                          ? "거래 서명 확인"
                          : "거래 서명 대기"}
                        {record.state.higherRiskConfirmed
                          ? " · 추가 위험 확인 완료"
                          : profile !== undefined &&
                              minimumProfile !== undefined &&
                              profile < minimumProfile
                            ? " · 추가 위험 확인 필요"
                            : ""}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => select(record.id)}
                          aria-label={`${short(record.id)} 기록 보기`}
                        >
                          기록 보기
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className={s.empty}>이 상태의 판매 건이 없습니다.</p>
            )}
          </div>
          <div className={s.detailGrid}>
            <section className={`${s.panel} ${s.pad}`}>
              <div className={s.row}>
                <h2>선택한 판매 건</h2>
                <Badge
                  tone={
                    sale.state.finalized
                      ? "success"
                      : sale.state.attempts >= 3 && !sale.state.reviewed
                        ? "warning"
                        : "neutral"
                  }
                >
                  {status(sale)}
                </Badge>
              </div>
              <Facts
                rows={[
                  ["판매 ID", <code>{sale.id}</code>],
                  ["상품", saleProductName(sale)],
                  ["상품 기준 투자성향", profileName(minimumProfile)],
                  [
                    "진단",
                    `${sale.attempts.length}회차 · ${profileName(profile)}`,
                  ],
                  ["설명 확인", sale.state.explained ? "완료" : "대기"],
                  [
                    "추가 위험 확인",
                    higherRiskStatus(
                      profile,
                      minimumProfile,
                      sale.state.higherRiskConfirmed,
                    ),
                  ],
                  ["가입 거래 서명", sale.state.signed ? "확인" : "대기"],
                  [
                    "관리자 승인",
                    sale.attempts.length < 3
                      ? "대상 아님"
                      : sale.state.reviewed
                        ? "승인"
                        : "필요",
                  ],
                ]}
              />
              <h3>진단 이력</h3>
              <History sale={sale} showDraftProfiles />
              {sale.attempts.length >= 3 &&
                !sale.state.finalized &&
                !sale.submissionPending && (
                  <Button
                    disabled={
                      busy || profile === undefined || sale.state.reviewed
                    }
                    onClick={() => action("review")}
                  >
                    {sale.state.reviewed
                      ? "관리자 승인 완료"
                      : "이력을 확인하고 관리자 승인"}
                  </Button>
                )}
            </section>
            <aside className={`${s.panel} ${s.pad}`}>
              <h2>가입 거래</h2>
              {completion?.txHash ? (
                <TransactionFacts
                  hash={completion.txHash}
                  block={completion.blockNumber}
                />
              ) : sale.submissionPending ? (
                <p>가입 거래 영수증을 기다리는 중입니다.</p>
              ) : (
                <p>
                  시연 서비스가 고객 역할의 테스트 키로 서명하고, 진단 증명과
                  확인 내용을 한 거래로 제출합니다.
                </p>
              )}
              <Button variant="outline" asChild>
                <Link
                  to={
                    completion?.id ? `/chain?trace=${completion.id}` : "/chain"
                  }
                >
                  처리 근거 보기
                </Link>
              </Button>
            </aside>
          </div>
        </>
      ) : (
        <Empty />
      )}
    </>
  );
}
