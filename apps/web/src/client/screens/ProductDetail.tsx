import { Link } from "react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  DEMO_AMOUNT,
  type Product,
} from "../../../../../packages/core/src/index.ts";
import type { ProductEntryDto } from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { won } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import client from "../client.module.css";
import local from "./channel.module.css";
import { ExplanationCards } from "../components.tsx";
import { channel } from "../links.ts";
import {
  gradeName,
  issuerLabel,
  productName,
  saleProduct,
  type Sale,
} from "../sales.ts";

const s = { ...ui, ...client, ...local };

/** 상품 상세. 원금 손실 가능성, 판매대상 고객군, 부적합 고객 유형을 먼저 보여 주고 가입을 시작한다. */
export function ProductDetail({
  loaded,
  product,
  products,
  activeDraft,
  busy,
  start,
}: {
  loaded: boolean;
  product?: Product;
  products: ProductEntryDto[];
  activeDraft?: Sale;
  busy: boolean;
  start: (productId: string) => unknown;
}) {
  if (!product)
    return (
      <div className={s.empty}>
        <h1>{loaded ? "상품을 찾을 수 없어요" : "상품을 불러오고 있어요"}</h1>
        <p>상품 목록에서 다시 골라 주세요.</p>
        <Button asChild>
          <Link to={channel.catalog}>상품 목록 보기</Link>
        </Button>
      </div>
    );
  const { document } = product;
  const draftProduct = saleProduct(products, activeDraft);
  const sameDraft = draftProduct?.id === product.id;
  const otherDraft = !!activeDraft && !sameDraft;
  const [warning, ...rest] = document.cards;
  return (
    <>
      <Heading title={productName(document)} description={document.summary} />
      <div className={s.detailGrid}>
        <section className={`${s.panel} ${s.pad}`}>
          <Notice tone="warning">
            원금 손실이 날 수 있어요. 최대 손실: {document.maxLoss}
          </Notice>
          <div className={s.firstCard}>
            <AlertTriangle size={18} />
            <div>
              <strong>{warning.title}</strong>
              <p>{warning.text}</p>
            </div>
          </div>
          <Facts
            rows={[
              ["상품 유형", document.type],
              ["위험등급", gradeName(document.riskGrade)],
              [issuerLabel(document), document.issuer],
              ["판매사", document.seller],
              ["판매대상 고객군", document.targetMarket],
              ["수수료", document.fee],
              ["설명서", `v${product.version} · 시연용`],
            ]}
          />
          {document.complex && (
            <Notice>
              고난도 금융투자상품이에요. 청약 과정을 녹취하고, 청약 뒤
              숙려기간이 지나야 최종 확인할 수 있어요.
            </Notice>
          )}
          <details>
            <summary>핵심 설명 더 보기</summary>
            <ExplanationCards cards={[warning, ...rest]} />
          </details>
        </section>
        <aside className={`${s.panel} ${s.pad}`}>
          <h2>이 상품에 가입해요</h2>
          <Facts
            rows={[
              [
                "가입 금액",
                won(
                  activeDraft && sameDraft ? activeDraft.amount : DEMO_AMOUNT,
                ),
              ],
              ["상품", productName(document)],
              [
                "가입 순서",
                "투자성향 진단 → 적합성 확인 → 핵심 설명 → 청약 → 최종 확인",
              ],
            ]}
          />
          <p className={s.small}>
            가입 금액은 시연용으로 정해져 있어요. 실제로 돈이 오가지는 않아요.
          </p>
          {otherDraft ? (
            <>
              <Notice>
                {productName(draftProduct?.document)} 가입을 진행 중이에요.
                마치거나 중단한 뒤 이 상품의 가입을 시작할 수 있어요.
              </Notice>
              <Button size="large" asChild>
                <Link to={channel.enroll}>
                  진행 중인 가입 보기 <ArrowRight size={17} />
                </Link>
              </Button>
            </>
          ) : (
            <Button
              size="large"
              disabled={busy}
              onClick={() => start(product.id)}
            >
              {sameDraft ? "진행 중인 가입 계속하기" : "가입 시작하기"}
              <ArrowRight size={17} />
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
