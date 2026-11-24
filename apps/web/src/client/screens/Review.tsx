import { useLocation, useSearchParams } from "react-router";
import { ExternalLink } from "lucide-react";
import type { ProductEntryDto } from "@finveric/core/api";
import type { LoadState } from "../../shared/api.ts";
import { Button } from "../../shared/button.tsx";
import {
  Badge,
  Empty,
  FilterChip,
  Heading,
  TableScroll,
} from "../../shared/components.tsx";
import { dateTime } from "../../shared/format.ts";
import ui from "../../shared/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import { CHANNEL_APP_HREF } from "../../shared/links.ts";
import { StatusBadge } from "../../shared/sale-components.tsx";
import { SaleRow } from "../components.tsx";
import {
  awaitingApproval,
  nowSeconds,
  productName,
  saleProduct,
  STATUS_KEYS,
  STATUS_LABELS,
  STATUS_TONES,
  statusKey,
  type Sale,
  type StatusKey,
} from "../../shared/sales.ts";

const s = { ...ui, ...client, ...local };

const yesNo = (value?: boolean, yes = "예", no = "아니요") =>
  value === undefined ? "—" : value ? yes : no;

/** 판매 건 목록과 상태별 필터. */
export function Review({
  load,
  sales,
  products,
}: {
  load: LoadState;
  sales: Sale[];
  products: ProductEntryDto[];
}) {
  const now = nowSeconds();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  const status = params.get("status");
  const filter = STATUS_KEYS.find((key) => key === status) ?? "";
  const setFilter = (key: StatusKey | "") =>
    setParams(key ? { status: key } : {}, { replace: true });
  const ordered = [...sales].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const count = (key: StatusKey | "") =>
    ordered.filter((sale) => !key || statusKey(sale, now) === key).length;
  const shown = ordered.filter(
    (sale) => !filter || statusKey(sale, now) === filter,
  );
  return (
    <>
      <Heading
        title="판매 건을 검토하세요"
        description="판매 건을 선택하면 상세 화면에서 진단 회차와 처리 근거를 확인할 수 있습니다."
      />
      <div className={s.chips} role="group" aria-label="판매 건 상태 필터">
        {(["", ...STATUS_KEYS] as const).map((key) => (
          <FilterChip
            key={key || "all"}
            label={key ? STATUS_LABELS[key] : "전체"}
            count={count(key)}
            pressed={filter === key}
            onClick={() => setFilter(key)}
            tone={key ? STATUS_TONES[key] : undefined}
          />
        ))}
      </div>
      <div className={`${s.panel} ${s.salesTable}`}>
        <TableScroll label="판매 건 목록">
          <table>
            <caption className={s.srOnly}>판매 건 목록</caption>
            <thead>
              <tr>
                <th scope="col">판매 ID</th>
                <th scope="col">상품</th>
                <th scope="col">상태</th>
                <th scope="col">회차</th>
                <th scope="col">적합성</th>
                <th scope="col">녹취·숙려</th>
                <th scope="col">관리자 승인</th>
                <th scope="col">신청 시각</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((record) => {
                const attempt = record.chain?.attempt ?? record.latestAttempt;
                const abandoned = record.status === "abandoned";
                return (
                  <SaleRow key={record.id} saleId={record.id} search={search}>
                    <td className={s.wrapCell}>
                      {productName(saleProduct(products, record)?.document)} v
                      {record.productVersion}
                    </td>
                    <td>
                      <StatusBadge sale={record} now={now} />
                    </td>
                    <td>
                      {abandoned
                        ? "—"
                        : attempt
                          ? `${attempt}회차${attempt > 1 ? " · 재진단" : ""}`
                          : "진단 전"}
                    </td>
                    <td>
                      {abandoned
                        ? "—"
                        : yesNo(record.suitable, "적합", "부적합")}
                    </td>
                    <td>
                      {abandoned
                        ? "—"
                        : yesNo(record.protectedSale, "대상", "—")}
                    </td>
                    <td>
                      {awaitingApproval(record) ? (
                        <Badge tone="warning">승인 필요</Badge>
                      ) : record.chain?.approved ||
                        (record.status === "draft" &&
                          record.approvalRequired) ? (
                        "승인"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{dateTime(record.createdAt)}</td>
                  </SaleRow>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
        {shown.length === 0 &&
          (load === "ready" && filter ? (
            <div className={s.empty}>
              <p>{STATUS_LABELS[filter]} 상태의 판매 건이 없습니다.</p>
              <Button variant="outline" onClick={() => setFilter("")}>
                전체 보기
              </Button>
            </div>
          ) : load === "ready" ? (
            <Empty
              title="아직 판매 건이 없습니다"
              text="고객이 증권사 앱에서 상품을 고르고 가입을 시작하면 판매 건이 생깁니다."
            >
              <Button variant="outline" asChild>
                <a href={CHANNEL_APP_HREF} target="_blank" rel="noreferrer">
                  증권사 앱 예시 열기
                  <span className={s.srOnly}> (새 탭에서 열기)</span>
                  <ExternalLink size={14} aria-hidden="true" data-icon="end" />
                </a>
              </Button>
            </Empty>
          ) : (
            <p className={s.empty}>
              {load === "failed"
                ? "판매 건을 불러오지 못했습니다. 연결을 확인하고 화면을 새로 고치세요."
                : "판매 건을 불러오고 있습니다."}
            </p>
          ))}
      </div>
    </>
  );
}
