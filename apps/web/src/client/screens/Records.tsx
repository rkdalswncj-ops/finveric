import { Link } from "react-router";
import { ArrowRight, Download, FileText } from "lucide-react";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  FundFilter,
  Heading,
  Notice,
  TransactionFacts,
} from "../../../../../packages/ui/src/components.tsx";
import {
  enrollmentTrace,
  finalProfile,
  getProduct,
  higherRiskStatus,
  procedureLabels,
  profileName,
  purchaseNames,
  saleProduct,
  saleProductName,
  status,
  won,
  type Sale,
} from "../../../../../packages/ui/src/sale.ts";
import type { ExportKind } from "../../../../../packages/core/src/api.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import { Empty, History, SaleSelect } from "../components.tsx";
import { fundPath, verifyPath } from "../links.ts";

const s = { ...ui, ...local };

export function Records({
  sale,
  sales,
  productFilter,
  filterProducts,
  select,
  download,
  busy,
}: {
  sale?: Sale;
  sales: Sale[];
  productFilter: string;
  filterProducts: (id: string) => void;
  select: (id: string) => void;
  download: (kind: ExportKind, modified?: boolean) => unknown;
  busy: boolean;
}) {
  const enrollment = enrollmentTrace(sale);
  const profile = finalProfile(sale);
  const selectedProduct = getProduct(productFilter);
  const product = saleProduct(sale);
  return (
    <>
      <Heading
        title="내 가입 기록"
        description="가입 진행 상태와 검증 기록을 확인할 수 있어요."
      />
      <FundFilter
        value={productFilter}
        change={filterProducts}
        disabled={busy}
      />
      {sale ? (
        <>
          <SaleSelect
            sales={sales}
            sale={sale}
            select={select}
            label="가입 신청 선택"
          />
          <div className={s.detailGrid}>
            <section className={`${s.panel} ${s.pad}`}>
              <Badge tone={sale.state.finalized ? "success" : "warning"}>
                {status(sale)}
              </Badge>
              <h2>{saleProductName(sale)}</h2>
              <Facts
                rows={[
                  ["가입 진행 상태", status(sale)],
                  ["투자성향", profileName(profile)],
                  [
                    procedureLabels["higher-risk"],
                    higherRiskStatus(
                      profile,
                      product?.minimumProfile,
                      sale.state.higherRiskConfirmed,
                    ),
                  ],
                  ["매입 상태", purchaseNames[sale.state.purchaseState]],
                  ["신청 금액", won(sale.amount)],
                  [
                    "매입 좌수",
                    sale.state.purchaseState === 3
                      ? `${Number(sale.state.units).toLocaleString()}좌`
                      : "—",
                  ],
                  [
                    "기준가격",
                    sale.state.purchaseState === 3
                      ? `${won(sale.state.nav)} / 1,000좌`
                      : "—",
                  ],
                ]}
              />
              <p className={s.small}>매입 금액과 좌수는 테스트 값이에요.</p>
              <h3>진단 기록</h3>
              {sale.attempts.length ? (
                <History sale={sale} />
              ) : (
                <p className={s.small}>아직 진단 기록이 없어요.</p>
              )}
              <h3>블록체인 기록</h3>
              {enrollment?.txHash ? (
                <>
                  <Link
                    to={`/chain?trace=${enrollment.id}`}
                    onClick={() => select(sale.id)}
                  >
                    가입 거래 보기 <ArrowRight size={14} />
                  </Link>
                  <TransactionFacts
                    hash={enrollment.txHash}
                    block={enrollment.blockNumber}
                  />
                  <p className={s.small}>
                    한 거래에 진단 증명, 설명 확인, 가입 조건 검증 결과를
                    기록했어요.
                    {sale.state.higherRiskConfirmed &&
                      " 추가 위험 확인도 함께 기록했어요."}
                  </p>
                </>
              ) : (
                <p className={s.small}>
                  가입 거래의 해시와 블록 번호를 아직 확인하지 못했어요.
                </p>
              )}
            </section>
            <aside className={`${s.panel} ${s.pad}`}>
              <h2>가입 서류</h2>
              <p>
                판매사와 독립된 확인 페이지에서 이 가입 기록을 확인하거나,
                서류를 내려받아 보관할 수 있어요.
              </p>
              <Button asChild>
                <Link to={verifyPath(sale.id)}>
                  가입 기록 확인하기
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => download("receipt")}
              >
                <Download size={16} />
                검증 영수증 내려받기
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => download("original")}
              >
                <Download size={16} />
                가입 원본 내려받기
              </Button>
              <Notice>
                가입 원본에는 진단 답변이 담겨 있어요. 본인만 볼 수 있는 곳에
                보관해 주세요.
              </Notice>
              <details>
                <summary>파일 변경 감지 테스트</summary>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => download("original", true)}
                >
                  변경한 사본 내려받기
                </Button>
              </details>
            </aside>
          </div>
        </>
      ) : selectedProduct ? (
        <div className={s.empty}>
          <FileText size={30} />
          <h2>이 펀드의 가입 기록이 없어요</h2>
          <Button asChild>
            <Link to={fundPath(selectedProduct)}>상품 살펴보기</Link>
          </Button>
        </div>
      ) : (
        <Empty />
      )}
    </>
  );
}
