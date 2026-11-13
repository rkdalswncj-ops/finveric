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
import { PRODUCT_TYPES, type ProductType } from "@finveric/core";
import type { ProductEntryDto } from "@finveric/core/api";
import type { LoadState } from "../../shared/api.ts";
import { Button } from "../../shared/button.tsx";
import { Badge, Heading } from "../../shared/components.tsx";
import ui from "../../shared/ui.module.css";
import {
  gradeName,
  issuerLabel,
  latestProducts,
  productName,
  type Sale,
} from "../../shared/sales.ts";
import local from "./channel.module.css";
import { useStartEnrollment } from "../flow.tsx";
import { channel, fundPath } from "../links.ts";

const s = { ...ui, ...local };
const ICONS: Record<ProductType, [typeof TrendingUp, string]> = {
  ELS: [TrendingUp, s.symbolEls],
  펀드: [Landmark, s.symbolFund],
  ELB: [Umbrella, s.symbolElb],
};

/**
 * 상품 목록. 원장에 등록한 최신 버전만 판다.
 * 카드의 "가입하기"는 그 상품의 가입에 바로 들어간다. "자세히 보기"는 상품 상세로 간다.
 */
export function Catalog({
  load,
  products,
  activeDraft,
  busy,
  start,
}: {
  load: LoadState;
  products: ProductEntryDto[];
  activeDraft?: Sale;
  busy: string;
  start: (productId: string, replace?: boolean) => unknown;
}) {
  const enroll = useStartEnrollment(products, activeDraft, start);
  const [starting, setStarting] = useState("");
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
        <div className={s.chips} role="group" aria-label="상품 유형">
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
            placeholder="상품명·발행사·운용사"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {/* 유형·검색으로 목록이 바뀌면 화면 낭독기가 상품 수를 읽는다. */}
      <p role="status" className={s.srOnly}>
        {load === "ready" ? `상품 ${filtered.length}개` : ""}
      </p>
      <div className={s.catalog}>
        {filtered.map(({ product }) => {
          const { document } = product;
          const [Icon, tone] = ICONS[document.type];
          const enrollLabel = enroll.same(product.id)
            ? "가입 이어 하기"
            : "가입하기";
          return (
            <article className={s.fundCard} key={product.id}>
              <div className={s.cardTop}>
                <div className={`${s.symbol} ${tone}`}>
                  <Icon size={27} />
                </div>
                <Badge tone={document.riskGrade <= 2 ? "warning" : "info"}>
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
              <div className={s.cardActions}>
                <Button variant="outline" asChild>
                  <Link
                    to={fundPath(product.id)}
                    aria-label={`${document.name} 자세히 보기`}
                  >
                    자세히 보기
                  </Link>
                </Button>
                <Button
                  busy={!!busy && starting === product.id}
                  blocked={!!busy && starting !== product.id}
                  aria-label={`${enrollLabel} · ${document.name}`}
                  onClick={() => {
                    setStarting(product.id);
                    enroll.request(product.id);
                  }}
                >
                  {enrollLabel}
                  <ArrowRight size={16} aria-hidden="true" data-icon="end" />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className={s.empty}>
          {load === "failed" && !selling.length ? (
            <p>상품을 불러오지 못했어요. 화면을 새로 고쳐 주세요.</p>
          ) : load === "loading" ? (
            <p>상품을 불러오고 있어요.</p>
          ) : !selling.length ? (
            <p>
              지금 가입할 수 있는 상품이 없어요. 상품이 등록되면 여기에 보여요.
            </p>
          ) : query.trim() ? (
            <>
              <p>{`'${query.trim()}' 검색 결과가 없어요.`}</p>
              <Button variant="outline" onClick={() => setQuery("")}>
                검색 지우기
              </Button>
            </>
          ) : (
            <>
              <p>{type} 상품이 없어요.</p>
              <Button variant="outline" onClick={() => setType("")}>
                전체 상품 보기
              </Button>
            </>
          )}
        </div>
      )}
      <div className={s.catalogNote}>
        <span>판매사가 등록한 최신 설명서로 보여 드려요.</span>
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
            내 가입 기록 보기 <ArrowRight size={16} data-icon="end" />
          </Link>
        </Button>
      </div>
      {enroll.dialog}
    </>
  );
}
