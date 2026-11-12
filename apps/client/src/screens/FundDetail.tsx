import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { PRODUCTS, type Product } from "../../../../packages/core/src/index.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import {
  Facts,
  Heading,
  Notice,
} from "../../../../packages/ui/src/components.tsx";
import {
  profileName,
  saleProduct,
  saleProductName,
  type Sale,
} from "../../../../packages/ui/src/sale.ts";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import { FundDisclosure } from "../components.tsx";
import { channel } from "../links.ts";

const s = { ...ui, ...local };

export function FundDetail({
  product,
  start,
  busy,
  activeDraft,
}: {
  product?: Product;
  start: (product: Product) => unknown;
  busy: boolean;
  activeDraft?: Sale;
}) {
  if (!product) {
    return (
      <div className={s.empty}>
        <h1>펀드를 찾을 수 없어요</h1>
        <p>펀드 목록에서 상품을 다시 선택해 주세요.</p>
        <Button asChild>
          <Link to={channel.catalog}>펀드 목록 보기</Link>
        </Button>
      </div>
    );
  }
  const { document } = product;
  const balancedFund = product.id === PRODUCTS[0].id;
  const otherDraft = activeDraft && saleProduct(activeDraft)?.id !== product.id;
  return (
    <>
      <Heading
        title={document.name}
        description="위험과 비용을 확인하고 가입 절차를 체험해 보세요."
      />
      <div className={s.detailGrid}>
        <section className={`${s.panel} ${s.pad}`}>
          <Notice tone="warning">
            원금 손실 가능성이 있어요. 예금자보호 대상이 아니에요.
          </Notice>
          <h2>
            {balancedFund
              ? "글로벌 주식과 채권에 나누어 투자해요"
              : "어떤 자산에 투자하나요?"}
          </h2>
          <p>{document.strategy}</p>
          {balancedFund && (
            <>
              <div className={s.allocation}>
                <span />
                <span />
              </div>
              <p className={s.small}>
                글로벌 주식 60% · 채권 40% · 가상 운용 전략
              </p>
            </>
          )}
          <Facts
            rows={[
              ["운용사", document.manager],
              ["판매사", document.seller],
              ["클래스", document.class],
              ["위험등급", document.risk],
              ["시연 기준 성향", profileName(product.minimumProfile)],
              ["연 총보수", document.annualFee],
              ["설명서", `${document.version} · 시연용`],
            ]}
          />
          <h3>가입 체험 안내</h3>
          <p>
            매입 결과와 기준가격은 시연용이에요. 실제로 돈이 오가지는 않아요.
          </p>
          <FundDisclosure document={document} />
        </section>
        <aside className={`${s.panel} ${s.pad}`}>
          <h2>이 펀드의 가입 절차를 체험해요</h2>
          <Facts
            rows={[
              ["가입 금액", "1,050,000원"],
              ["상품", document.name],
              ["클래스", document.class],
            ]}
          />
          <p className={s.small}>
            가입 금액은 시연용으로 정해져 있어요. 먼저 투자 진단을 진행해요.
          </p>
          {otherDraft ? (
            <>
              <Notice>
                {saleProductName(activeDraft)} 가입을 작성 중이에요. 완료하거나
                중단한 뒤 이 펀드의 가입을 시작할 수 있어요.
              </Notice>
              <Button size="large" asChild>
                <Link to={channel.enroll}>
                  작성 중인 가입 보기 <ArrowRight size={17} />
                </Link>
              </Button>
            </>
          ) : (
            <Button size="large" disabled={busy} onClick={() => start(product)}>
              {activeDraft ? "작성 중인 가입 계속하기" : "투자 진단 시작하기"}{" "}
              <ArrowRight size={17} />
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
