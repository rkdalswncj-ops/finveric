// 판매사 콘솔과 증권사 앱 예시가 함께 쓰는 판매 건·상품 표시 요소.
import type { ProductDocument } from "../../core/src/index.ts";
import { Badge } from "./components.tsx";
import { STATUS_LABELS, STATUS_TONES, statusKey, type Sale } from "./sales.ts";
import s from "./ui.module.css";

/** 판매 건 상태 배지. 원장 상태에 승인 대기와 숙려 중을 더한다. */
export function StatusBadge({ sale, now }: { sale: Sale; now: number }) {
  const key = statusKey(sale, now);
  return <Badge tone={STATUS_TONES[key]}>{STATUS_LABELS[key]}</Badge>;
}

/** 핵심 설명 카드 5장. 첫 장은 부적합 고객 유형과 손실 사례다. */
export function ExplanationCards({
  cards,
}: {
  cards: ProductDocument["cards"];
}) {
  return (
    <ol className={s.cardList}>
      {cards.map((card, index) => (
        <li key={index}>
          <strong>
            {index + 1}. {card.title}
          </strong>
          <p>{card.text}</p>
        </li>
      ))}
    </ol>
  );
}
