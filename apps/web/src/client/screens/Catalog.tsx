import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Landmark,
  Layers,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { PRODUCTS } from "../../../../../packages/core/src/index.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import { Badge, Heading } from "../../../../../packages/ui/src/components.tsx";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import { channel, fundPath } from "../links.ts";

const s = { ...ui, ...local };
const fundIcons = [TrendingUp, Landmark, Layers];
const fundCategories = [
  "전체",
  ...new Set(PRODUCTS.map((product) => product.category)),
];

export function Catalog() {
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const filtered = PRODUCTS.filter(
    ({ category: fundCategory, document }) =>
      (category === "전체" || fundCategory === category) &&
      `${document.name} ${document.manager}`.includes(query.trim()),
  );
  return (
    <>
      <Heading
        title="어떤 펀드를 살펴볼까요?"
        description="운용사와 판매사, 펀드별 위험등급과 보수를 비교해 보세요."
      />
      <div className={s.tools}>
        <div className={s.chips}>
          {fundCategories.map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={category === c ? s.chipActive : ""}
            >
              {c}
            </button>
          ))}
        </div>
        <div className={s.search}>
          <Search size={18} />
          <input
            aria-label="펀드명 또는 운용사 검색"
            placeholder="펀드명·운용사 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className={s.catalog}>
        {filtered.map((product) => {
          const { document, category } = product;
          const index = PRODUCTS.indexOf(product);
          const Icon = fundIcons[index];
          return (
            <article className={s.fundCard} key={product.id}>
              <div className={s.cardTop}>
                <div className={`${s.symbol} ${s["symbol" + index]}`}>
                  <Icon size={27} />
                </div>
                <Badge tone="blue">가입 체험</Badge>
              </div>
              <p className={s.small}>
                {category} · {document.class}
              </p>
              <h2>{document.name}</h2>
              <p className={s.strategy}>{document.strategy}</p>
              <dl className={s.parties}>
                <div>
                  <dt>운용사</dt>
                  <dd>{document.manager}</dd>
                </div>
                <div>
                  <dt>판매사</dt>
                  <dd>{document.seller}</dd>
                </div>
              </dl>
              <div className={s.numbers}>
                <div>
                  <span>연 총보수</span>
                  <strong>
                    {document.annualFee.replace(/%$/, "")}
                    <small>%</small>
                  </strong>
                </div>
                <div>
                  <span>위험등급</span>
                  <strong>
                    {document.risk.split(" · ")[0]}
                    <small> / 6</small>
                  </strong>
                </div>
              </div>
              <Button asChild>
                <Link
                  to={fundPath(product)}
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
          검색 결과가 없어요. 펀드 유형이나 검색어를 바꿔 보세요.
        </div>
      )}
      <div className={s.catalogNote}>
        <span>상품과 기관 정보는 모두 시연용이에요.</span>
        <span>가입을 체험할 수 있는 펀드 {PRODUCTS.length}개</span>
      </div>
      <div className={s.help}>
        <ShieldCheck size={30} />
        <div>
          <h3>가입 과정이 한곳에 기록돼요</h3>
          <p>진단 결과와 설명 확인, 서명 기록을 다시 볼 수 있어요.</p>
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
