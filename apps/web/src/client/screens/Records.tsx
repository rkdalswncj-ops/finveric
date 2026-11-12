import { Link } from "react-router";
import { ArrowRight, Download } from "lucide-react";
import type {
  CustomerDto,
  ExportKind,
  ProductEntryDto,
} from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { dateTime, won } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./channel.module.css";
import { Empty, StatusBadge } from "../components.tsx";
import { channel, verifyPath } from "../links.ts";
import {
  confirmedTrace,
  inCooling,
  nowSeconds,
  productName,
  profileName,
  saleProduct,
  type Sale,
} from "../sales.ts";

const s = { ...ui, ...local };

/** 고객이 청약한 가입 기록. 증명서와 원본을 내려받고, 가입 기록 확인 화면으로 간다. */
export function Records({
  loaded,
  sales,
  products,
  customer,
  selected,
  select,
  busy,
  download,
  resume,
}: {
  loaded: boolean;
  sales: Sale[];
  products: ProductEntryDto[];
  customer?: CustomerDto;
  selected: string;
  select: (id: string) => void;
  busy: boolean;
  download: (id: string, kind: ExportKind) => unknown;
  resume: (id: string) => void;
}) {
  const now = nowSeconds();
  const records = sales
    .filter((sale) => !!sale.chain)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sale = records.find((entry) => entry.id === selected) ?? records[0];
  const product = saleProduct(products, sale);
  const diagnosis = customer?.diagnoses.find(
    (entry) => entry.attempt === sale?.chain?.attempt,
  );
  const subscribeTx = confirmedTrace(sale, "subscribe");
  const confirmTx = confirmedTrace(sale, "confirm");
  return (
    <>
      <Heading
        title="내 가입 기록"
        description="청약하고 확정한 가입을 확인하고, 증명서와 원본을 보관할 수 있어요."
      />
      {sale ? (
        <div className={s.recordsGrid}>
          <nav className={s.recordList} aria-label="가입 기록 목록">
            {records.map((record) => (
              <button
                key={record.id}
                className={record.id === sale.id ? s.recordActive : ""}
                aria-current={record.id === sale.id}
                onClick={() => select(record.id)}
              >
                <strong>
                  {productName(saleProduct(products, record)?.document)}
                </strong>
                <span>
                  <StatusBadge sale={record} now={now} />
                  <small>{dateTime(record.createdAt)}</small>
                </span>
              </button>
            ))}
          </nav>
          <section className={`${s.panel} ${s.pad}`}>
            <StatusBadge sale={sale} now={now} />
            <h2 className={s.recordTitle}>{productName(product?.document)}</h2>
            <Facts
              rows={[
                ["증명서 번호", <code>{sale.id}</code>],
                ["설명서 버전", `v${sale.productVersion}`],
                ["가입 금액", won(sale.amount)],
                [
                  "투자성향",
                  `${profileName(diagnosis?.profile)} · ${sale.chain?.attempt}회차 진단`,
                ],
                [
                  "적합성",
                  sale.chain?.suitable ? "적합" : "부적합 · 본인 판단으로 가입",
                ],
                ["핵심 설명 확인", `${sale.chain?.explanationSeconds}초`],
                [
                  "녹취·숙려",
                  sale.chain?.protectedSale ? "대상 · 녹취 동의" : "대상 아님",
                ],
                ["청약", dateTime(Number(sale.chain?.subscribedAt ?? 0))],
                [
                  "최종 확인",
                  sale.status === "confirmed"
                    ? dateTime(Number(sale.chain?.confirmedAt ?? 0))
                    : sale.status === "withdrawn"
                      ? "철회"
                      : "대기",
                ],
                [
                  "결제 기록",
                  sale.settled
                    ? "완료"
                    : sale.status === "confirmed"
                      ? "대기"
                      : "—",
                ],
              ]}
            />
            {inCooling(sale, now) && (
              <Notice>
                숙려기간이에요. {dateTime(sale.coolingEndsAt)}부터 최종 확인할
                수 있어요.
              </Notice>
            )}
            {sale.status === "subscribed" && (
              <Button onClick={() => resume(sale.id)}>
                최종 확인하러 가기 <ArrowRight size={16} />
              </Button>
            )}
            <details>
              <summary>기술 정보 보기</summary>
              <Facts
                rows={[
                  [
                    "청약 기록",
                    subscribeTx ? <code>{subscribeTx.txHash}</code> : "—",
                  ],
                  [
                    "최종 확인 기록",
                    confirmTx ? <code>{confirmTx.txHash}</code> : "—",
                  ],
                  ["고객 가명 ID", <code>{sale.customerRef}</code>],
                ]}
              />
            </details>
          </section>
          <aside className={`${s.panel} ${s.pad}`}>
            <h2>가입 서류</h2>
            <p>
              판매사를 거치지 않는 확인 화면에서 이 기록을 확인하거나, 서류를
              내려받아 보관할 수 있어요.
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
              onClick={() => download(sale.id, "receipt")}
            >
              <Download size={16} />
              증명서 내려받기
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => download(sale.id, "original")}
            >
              <Download size={16} />
              가입 원본 내려받기
            </Button>
            <Notice>
              가입 원본에는 진단 답변이 담겨 있어요. 본인만 볼 수 있는 곳에
              보관해 주세요.
            </Notice>
          </aside>
        </div>
      ) : (
        <Empty
          title={
            loaded ? "아직 가입 기록이 없어요" : "가입 기록을 불러오고 있어요"
          }
          text="상품을 고르고 진단부터 청약까지 마치면 여기에 기록이 생겨요."
        >
          <Button asChild>
            <Link to={channel.catalog}>상품 보러 가기</Link>
          </Button>
        </Empty>
      )}
    </>
  );
}
