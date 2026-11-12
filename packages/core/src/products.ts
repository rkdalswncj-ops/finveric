// 상품 설명서 버전. 판매사가 원장에 등록한다. 원장은 설명서 원문의 keccak256을 지문으로 남긴다.
import { keccak256, stringToHex, type Hex } from "viem";
import { canonical } from "./encoding.ts";

export type ProductType = "ELS" | "펀드" | "ELB";
export const PRODUCT_TYPES: readonly ProductType[] = ["ELS", "펀드", "ELB"];
export type RiskGrade = 1 | 2 | 3 | 4 | 5 | 6;

export type ProductDocument = {
  format: "finveric-product-v5";
  code: string;
  version: number;
  name: string;
  type: ProductType;
  /** 발행사 또는 운용사. 표시만 한다. */
  issuer: string;
  /** 판매사. */
  seller: string;
  riskGrade: RiskGrade;
  complex: boolean;
  derivative: boolean;
  targetMarket: string;
  maxLoss: string;
  fee: string;
  summary: string;
  /** 핵심 설명 카드 5장. 첫 장은 부적합 고객 유형과 손실 사례다. */
  cards: { title: string; text: string }[];
};
export type Product = {
  id: Hex;
  version: number;
  document: ProductDocument;
  documentHash: Hex;
};

/** 고난도 상품 이름 앞에 붙이는 표시. */
export const COMPLEX_LABEL = "고난도 금융투자상품";
export const PRODUCT_CARD_COUNT = 5;

/** 상품 ID = keccak256(상품 코드). 버전이 바뀌어도 같다. */
export const productId = (code: string) => keccak256(stringToHex(code));
/** 원장에 등록하는 설명서 원문. */
export const productText = (document: ProductDocument) => canonical(document);
/** 설명서 지문. 원장이 keccak256(bytes(document))로 같은 값을 계산한다. */
export const productDocumentHash = (document: ProductDocument) =>
  keccak256(stringToHex(productText(document)));
export const defineProduct = (document: ProductDocument): Product => ({
  id: productId(document.code),
  version: document.version,
  document,
  documentHash: productDocumentHash(document),
});
/** 화면 표시용 이름. 고난도 상품은 이름 앞에 표시를 붙인다. */
export const productDisplayName = (document: ProductDocument) =>
  document.complex ? `${COMPLEX_LABEL} ${document.name}` : document.name;

/** 적합 여부: 상품 위험등급이 권유 가능 최고 위험등급과 같거나 덜 위험하다. 원장과 같은 식이다. */
export const isSuitable = (riskGrade: number, limit: number) =>
  riskGrade >= limit;
/** 녹취·숙려 대상: 고난도 상품, 또는 고령·부적합 고객에게 파는 파생결합증권. 원장과 같은 식이다. */
export const isProtectedSale = (
  product: Pick<ProductDocument, "complex" | "derivative">,
  diagnosis: { elderly: boolean },
  suitable: boolean,
) =>
  product.complex || (product.derivative && (diagnosis.elderly || !suitable));

const isText = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** 설명서를 검사한다. 오류 문장 목록을 돌려준다. 문제가 없으면 빈 배열이다. */
export function validateProduct(doc: ProductDocument): string[] {
  const errors: string[] = [];
  if (!doc || typeof doc !== "object") return ["상품 설명서가 없어요."];
  if (doc.format !== "finveric-product-v5")
    errors.push("형식은 finveric-product-v5여야 해요.");
  if (
    typeof doc.code !== "string" ||
    !/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(doc.code)
  )
    errors.push("상품 코드는 영문 대문자·숫자·하이픈 2~40자여야 해요.");
  if (!Number.isInteger(doc.version) || doc.version < 1)
    errors.push("버전은 1 이상의 정수여야 해요.");
  if (!PRODUCT_TYPES.includes(doc.type))
    errors.push("상품 유형은 ELS, 펀드, ELB 중 하나여야 해요.");
  if (
    !Number.isInteger(doc.riskGrade) ||
    doc.riskGrade < 1 ||
    doc.riskGrade > 6
  )
    errors.push("위험등급은 1~6등급이어야 해요.");
  if (typeof doc.complex !== "boolean" || typeof doc.derivative !== "boolean")
    errors.push("고난도·파생결합증권 여부를 정해 주세요.");
  for (const [key, label] of [
    ["name", "상품명을"],
    ["issuer", "발행사·운용사를"],
    ["seller", "판매사를"],
    ["targetMarket", "판매대상 고객군을"],
    ["maxLoss", "최대 손실을"],
    ["fee", "수수료를"],
    ["summary", "상품 요약을"],
  ] as const)
    if (!isText(doc[key], 500)) errors.push(`${label} 500자 안으로 써 주세요.`);
  if (
    !Array.isArray(doc.cards) ||
    doc.cards.length !== PRODUCT_CARD_COUNT ||
    !doc.cards.every(
      (card) => card && isText(card.title, 100) && isText(card.text, 1000),
    )
  )
    errors.push(
      `핵심 설명 카드는 ${PRODUCT_CARD_COUNT}장이어야 해요. 첫 장에 부적합 고객 유형과 손실 사례를 써 주세요.`,
    );
  return errors;
}

/** 시연 청약 금액(원). */
export const DEMO_AMOUNT = 10_000_000;

const SELLER = "데모증권";
/** 시연 상품 3종(PRD). 모든 상품과 기관은 가상이다. */
export const DEMO_PRODUCTS: readonly Product[] = [
  defineProduct({
    format: "finveric-product-v5",
    code: "ELS-DEMO-001",
    version: 1,
    name: "가상 글로벌지수 스텝다운 ELS",
    type: "ELS",
    issuer: "데모증권",
    seller: SELLER,
    riskGrade: 1,
    complex: true,
    derivative: true,
    targetMarket: "원금 전액 손실을 감내할 수 있는 공격투자형",
    maxLoss: "원금 전액(100%)",
    fee: "별도 판매보수 없음. 발행 비용은 쿠폰에 반영돼요(가상).",
    summary:
      "가상 글로벌 지수 2개에 연동하는 원금비보장 상품이에요. 6개월마다 조기상환을 평가하고 만기는 3년이에요. 녹인은 60%예요.",
    cards: [
      {
        title: "이런 분께는 맞지 않아요",
        text: "원금 손실을 원하지 않는 분, 투자 경험이 적은 분, 3년 안에 돈이 필요한 분께는 맞지 않아요. 손실 사례: 한 지수가 가입 때보다 50% 내린 채 만기를 맞으면 원금의 50%를 잃어요.",
      },
      {
        title: "수익 구조",
        text: "6개월마다 두 지수가 모두 기준가의 90%(6·12개월), 85%(18·24개월), 80%(30개월) 이상이면 연 7%(가상)로 조기상환해요.",
      },
      {
        title: "원금 손실 조건(녹인 60%)",
        text: "만기 전에 한 지수라도 기준가의 60% 아래로 내린 적이 있고, 만기에 조건을 채우지 못하면 더 많이 내린 지수의 하락률만큼 원금을 잃어요.",
      },
      {
        title: "조기상환과 만기",
        text: "조기상환이 되지 않으면 3년 만기까지 보유해요. 중도 환매는 발행사가 정한 가격으로만 가능하고 원금보다 적을 수 있어요.",
      },
      {
        title: "발행사 신용위험",
        text: "이 상품은 예금자보호 대상이 아니에요. 발행사가 지급하지 못하면 원금 전액을 잃을 수 있어요.",
      },
    ],
  }),
  defineProduct({
    format: "finveric-product-v5",
    code: "FUND-DEMO-002",
    version: 1,
    name: "가상 글로벌 주식혼합 펀드",
    type: "펀드",
    issuer: "데모자산운용",
    seller: SELLER,
    riskGrade: 3,
    complex: false,
    derivative: false,
    targetMarket: "위험중립형 이상",
    maxLoss: "원금 전액. 주식 비중 60%의 가격 변동을 그대로 받아요.",
    fee: "총보수 연 0.85%(가상)",
    summary:
      "글로벌 주식 60%와 채권 40%에 나눠 투자하는 공모펀드예요. 원금 손실이 날 수 있어요.",
    cards: [
      {
        title: "이런 분께는 맞지 않아요",
        text: "원금 손실을 원하지 않는 분, 1년 안에 돈이 필요한 분께는 맞지 않아요. 손실 사례: 주식시장이 30% 내리면 펀드 가치가 약 18% 줄어요.",
      },
      {
        title: "투자 대상",
        text: "글로벌 주식에 60%, 투자등급 채권에 40%를 투자해요. 비중은 운용사가 정한 범위 안에서 바뀌어요.",
      },
      {
        title: "수익과 손실",
        text: "수익은 보장하지 않아요. 기준가격이 매일 바뀌고 환매할 때의 기준가격으로 돌려받아요.",
      },
      {
        title: "수수료",
        text: "총보수 연 0.85%(가상)를 매일 나눠 빼요. 90일 안에 환매하면 이익금의 30%를 환매수수료로 내요(가상).",
      },
      {
        title: "예금자보호",
        text: "펀드는 예금자보호 대상이 아니에요.",
      },
    ],
  }),
  defineProduct({
    format: "finveric-product-v5",
    code: "ELB-DEMO-003",
    version: 1,
    name: "가상 원금지급형 ELB",
    type: "ELB",
    issuer: "데모증권",
    seller: SELLER,
    riskGrade: 5,
    complex: false,
    derivative: false,
    targetMarket: "안정추구형 이상",
    maxLoss:
      "만기에 원금을 지급해요. 발행사가 지급하지 못하면 손실이 날 수 있어요.",
    fee: "별도 판매보수 없음(가상)",
    summary:
      "만기 1년에 원금을 지급하는 상품이에요. 가상 지수가 오르면 최대 연 4%(가상)를 더 받아요.",
    cards: [
      {
        title: "이런 분께는 맞지 않아요",
        text: "1년 안에 돈이 필요한 분께는 맞지 않아요. 손실 사례: 만기 전에 팔면 원금보다 적게 받을 수 있어요.",
      },
      {
        title: "수익 구조",
        text: "만기에 지수가 기준가 이상이면 상승률에 따라 최대 연 4%(가상)를 더 받아요. 아니면 원금만 받아요.",
      },
      {
        title: "원금 지급",
        text: "만기까지 보유하면 원금을 지급해요. 중도 환매는 원금보다 적을 수 있어요.",
      },
      {
        title: "발행사 신용위험",
        text: "예금자보호 대상이 아니에요. 발행사가 지급하지 못하면 원금을 잃을 수 있어요.",
      },
      {
        title: "세금",
        text: "추가 수익은 배당소득으로 과세해요.",
      },
    ],
  }),
];
