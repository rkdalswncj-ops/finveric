import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Landmark,
  Search,
  ShieldCheck,
  TrendingUp,
  Umbrella,
} from "lucide-react";
import {
  PRODUCT_TYPES,
  type ProductType,
} from "../../../../../packages/core/src/index.ts";
import type { ProductEntryDto } from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import { Badge, Heading } from "../../../../../packages/ui/src/components.tsx";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import { channel, fundPath } from "../links.ts";
import {
  gradeName,
  issuerLabel,
  latestProducts,
  productName,
} from "../sales.ts";

const s = { ...ui, ...local };
const ICONS: Record<ProductType, [typeof TrendingUp, string]> = {
  ELS: [TrendingUp, s.symbolEls],
  펀드: [Landmark, s.symbolFund],
  ELB: [Umbrella, s.symbolElb],
};

/** 판매 채널의 상품 목록. 원장에 등록한 최신 버전만 판다. */
export function Catalog({
  loaded,
  products,
}: {
  loaded: boolean;
  products: ProductEntryDto[];
}) {
  const [type, setType] = useState<ProductType | "">("");
  const [query, setQuery] = useState("");
  // 위험등급이 높은 상품부터 보여 준다. 1등급 상품이 맨 앞에 온다.
  const selling = latestProducts(products).sort(
    (a, b) => a.product.document.riskGrade - b.product.document.riskGrade,
  );
  const filtered = selling.filter(
    ({ product: { document } }) =>
      (!type || document.type === type) &&
      `${document.name} ${document.issuer}`.includes(query.trim()),
  );
  return (
    <>
      <Heading
        title="어떤 상품을 살펴볼까요?"
        description="상품 유형, 위험등급, 비용, 최대 손실을 비교해 보세요."
      />
      <div className={s.tools}>
        <div className={s.chips}>
          {(["", ...PRODUCT_TYPES] as const).map((value) => (
            <button
              key={value || "all"}
              aria-pressed={type === value}
              onClick={() => setType(value)}
              className={type === value ? s.chipActive : ""}
            >
              {value || "전체"}
            </button>
          ))}
        </div>
        <div className={s.search}>
          <Search size={18} />
          <input
            aria-label="상품명 또는 발행사·운용사 검색"
            placeholder="상품명·발행사 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className={s.catalog}>
        {filtered.map(({ product }) => {
          const { document } = product;
          const [Icon, tone] = ICONS[document.type];
          return (
            <article className={s.fundCard} key={product.id}>
              <div className={s.cardTop}>
                <div className={`${s.symbol} ${tone}`}>
                  <Icon size={27} />
                </div>
                <Badge tone={document.riskGrade <= 2 ? "warning" : "blue"}>
                  {gradeName(document.riskGrade)}
                </Badge>
              </div>
              <p className={s.small}>
                {document.type}
                {document.derivative && " · 파생결합증권"}
              </p>
              <h2>{productName(document)}</h2>
              <p className={s.strategy}>{document.summary}</p>
              <dl className={s.parties}>
                <div>
                  <dt>{issuerLabel(document)}</dt>
                  <dd>{document.issuer}</dd>
                </div>
                <div>
                  <dt>판매사</dt>
                  <dd>{document.seller}</dd>
                </div>
                <div>
                  <dt>수수료</dt>
                  <dd>{document.fee}</dd>
                </div>
                <div>
                  <dt>최대 손실</dt>
                  <dd>{document.maxLoss}</dd>
                </div>
              </dl>
              <Button asChild>
                <Link
                  to={fundPath(product.id)}
                  aria-label={`${document.name} 살펴보기`}
                >
                  상품 살펴보기 <ArrowRight size={16} />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className={s.empty}>
          {!loaded
            ? "상품을 불러오고 있어요."
            : selling.length
              ? "검색 결과가 없어요. 상품 유형이나 검색어를 바꿔 보세요."
              : "지금 가입할 수 있는 상품이 없어요. 상품이 등록되면 여기에 보여요."}
        </div>
      )}
      <div className={s.catalogNote}>
        <span>원장에 등록한 최신 설명서로 보여 드려요.</span>
        <span>가입할 수 있는 상품 {selling.length}개</span>
      </div>
      <div className={s.help}>
        <ShieldCheck size={30} />
        <div>
          <h3>가입 과정이 안전하게 보관돼요</h3>
          <p>
            투자성향 진단, 설명 확인, 청약과 최종 확인 기록을 증명서로 다시
            확인할 수 있어요.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={channel.records}>
            내 가입 기록 보기 <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </>
  );
}
