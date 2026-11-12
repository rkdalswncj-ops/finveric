import { useState } from "react";
import { Link } from "react-router";
import type { Deployment } from "../../../../../packages/core/src/index.ts";
import type {
  EventRef,
  LedgerSnapshot,
} from "../../../../../packages/core/src/ledger.ts";
import {
  Badge,
  Facts,
  Heading,
  Stat,
  TableScroll,
  type Tone,
} from "../../../../../packages/ui/src/components.tsx";
import { dateTime } from "../../../../../packages/ui/src/format.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "../auditor.module.css";
import { LedgerGate, LedgerLine } from "../components.tsx";
import {
  customerPath,
  customerRefs,
  gradeLabel,
  percent,
  productName,
  ruleLabel,
  salePath,
  saleProduct,
  short,
} from "../format.ts";
import type { Ledger } from "../useLedger.ts";

const s = { ...ui, ...local };

type LedgerEvent = EventRef & {
  name: string;
  subject: string;
  to?: string;
  tone: Tone;
};

/** 원장 이벤트를 최신 순서로 펼친다. 같은 블록은 기록 순서의 역순이다. */
function ledgerEvents(snapshot: LedgerSnapshot): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  for (const rule of snapshot.rules)
    events.push({
      ...rule,
      name: "진단 기준 등록",
      subject: `v${rule.version} · ${rule.parsed?.name ?? short(rule.hash)}`,
      to: "/rules",
      tone: "neutral",
    });
  for (const product of snapshot.products)
    events.push({
      ...product,
      name: "상품 설명서 등록",
      subject: `${productName(snapshot, product.id, product.version)} v${product.version}`,
      to: "/products",
      tone: "neutral",
    });
  for (const diagnosis of snapshot.diagnoses)
    events.push({
      ...diagnosis,
      name: `진단 ${diagnosis.attempt}회차`,
      subject: `고객 ${short(diagnosis.customerRef)} · 기준 ${ruleLabel(snapshot, diagnosis.ruleHash)}`,
      to: customerPath(diagnosis.customerRef),
      tone: "neutral",
    });
  for (const sale of snapshot.sales) {
    const subject = `판매 ${short(sale.saleId)} · ${productName(snapshot, sale.productId, sale.productVersion)}`;
    const to = salePath(sale.saleId);
    events.push({
      ...sale.subscribed,
      name: "청약",
      subject,
      to,
      tone: "neutral",
    });
    if (sale.confirmed)
      events.push({
        ...sale.confirmed,
        name: "가입 확정",
        subject,
        to,
        tone: "success",
      });
    if (sale.withdrawn)
      events.push({
        ...sale.withdrawn,
        name: "철회",
        subject,
        to,
        tone: "neutral",
      });
    if (sale.settlement)
      events.push({
        ...sale.settlement,
        name: "결제 기록",
        subject,
        to,
        tone: "neutral",
      });
  }
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.block === b.event.block
        ? b.index - a.index
        : a.event.block < b.event.block
          ? 1
          : -1,
    )
    .map(({ event }) => event);
}

/** 감독기관 첫 화면. 원장 이벤트만으로 판매 현황을 집계한다. */
export function Dashboard({
  deployment,
  ledger,
}: {
  deployment?: Deployment;
  ledger: Ledger;
}) {
  return (
    <div className={s.page}>
      <Heading
        title="원장 기록을 한눈에 확인하세요"
        description="지정 RPC에서 읽은 원장 v5 이벤트로 집계합니다. 판매사 API를 쓰지 않습니다."
      />
      <LedgerLine ledger={ledger} />
      <LedgerGate ledger={ledger}>
        {(snapshot) => <Summary snapshot={snapshot} deployment={deployment} />}
      </LedgerGate>
    </div>
  );
}

function Summary({
  snapshot,
  deployment,
}: {
  snapshot: LedgerSnapshot;
  deployment?: Deployment;
}) {
  const [technical, setTechnical] = useState(false);
  const { sales, diagnoses } = snapshot;
  const confirmed = sales.filter((sale) => sale.status === "confirmed");
  const subscribed = sales.filter((sale) => sale.status === "subscribed");
  const withdrawn = sales.filter((sale) => sale.status === "withdrawn");
  const customers = customerRefs(snapshot);
  const attempts = new Map<string, number>();
  for (const diagnosis of diagnoses) {
    const key = diagnosis.customerRef.toLowerCase();
    attempts.set(key, Math.max(attempts.get(key) ?? 0, diagnosis.attempt));
  }
  const diagnosed = attempts.size;
  const repeated = [...attempts.values()].filter((count) => count >= 2).length;
  const unsuitable = confirmed.filter((sale) => !sale.suitable).length;
  const stats = [
    { label: "가입 확정", value: confirmed.length, unit: "건" },
    { label: "청약·숙려 중", value: subscribed.length, unit: "건" },
    { label: "철회", value: withdrawn.length, unit: "건" },
    { label: "진단 회차", value: diagnoses.length, unit: "회" },
    { label: "고객 가명 ID", value: customers.length, unit: "명" },
  ];
  const productIds = [...new Set(snapshot.products.map((entry) => entry.id))];
  const byProduct = productIds.map((id) => {
    const list = sales.filter((sale) => sale.productId === id);
    return {
      id,
      name: productName(snapshot, id),
      grade: snapshot.products.filter((entry) => entry.id === id).at(-1)
        ?.riskGrade,
      total: list.length,
      confirmed: list.filter((sale) => sale.status === "confirmed").length,
      subscribed: list.filter((sale) => sale.status === "subscribed").length,
      withdrawn: list.filter((sale) => sale.status === "withdrawn").length,
    };
  });
  const byGrade = [1, 2, 3, 4, 5, 6].map((grade) => {
    const list = sales.filter(
      (sale) => saleProduct(snapshot, sale)?.riskGrade === grade,
    );
    return {
      grade,
      total: list.length,
      confirmed: list.filter((sale) => sale.status === "confirmed").length,
      unsuitable: list.filter(
        (sale) => sale.status === "confirmed" && !sale.suitable,
      ).length,
    };
  });
  const events = ledgerEvents(snapshot).slice(0, 12);
  const ratios = [
    {
      label: "재진단 비율",
      part: repeated,
      whole: diagnosed,
      note: `진단한 고객 ${diagnosed}명 중 2회 이상 진단한 고객 ${repeated}명`,
    },
    {
      label: "부적합 가입 비율",
      part: unsuitable,
      whole: confirmed.length,
      note: `가입 확정 ${confirmed.length}건 중 부적합 상태로 확정한 ${unsuitable}건`,
    },
  ];
  return (
    <>
      <div className={`${s.stats} ${s.ledgerStats}`}>
        {stats.map((stat) => (
          <Stat
            key={stat.label}
            label={stat.label}
            value={stat.value.toLocaleString("ko-KR")}
            note={stat.unit}
          />
        ))}
      </div>
      <div className={s.columns}>
        <section className={s.panel} aria-labelledby="ratios">
          <div className={s.panelTitle}>
            <h2 id="ratios">판매 절차 지표</h2>
          </div>
          <p className={s.panelNote}>
            원장의 진단·청약·확정 이벤트로 계산합니다.
          </p>
          {ratios.map((ratio) => (
            <div key={ratio.label} className={s.ratio}>
              <div>
                <span>{ratio.label}</span>
                <strong>{percent(ratio.part, ratio.whole)}</strong>
              </div>
              <div
                className={s.bar}
                role="img"
                aria-label={`${ratio.label} ${percent(ratio.part, ratio.whole)}`}
              >
                <span
                  style={{
                    width: ratio.whole
                      ? `${(ratio.part / ratio.whole) * 100}%`
                      : 0,
                  }}
                />
              </div>
              <p>{ratio.note}</p>
            </div>
          ))}
        </section>
        <section className={`${s.panel} ${s.pad}`} aria-labelledby="source">
          <h2 id="source">읽은 원장</h2>
          <Facts
            rows={[
              [
                "네트워크",
                deployment?.chainId === 11155111
                  ? "Sepolia (11155111)"
                  : "Anvil (31337)",
              ],
              ["원장", <code>{deployment?.ledger}</code>],
              ["RPC", <code>{deployment?.rpcUrl}</code>],
              [
                "진단 기준",
                snapshot.rules.length
                  ? `${snapshot.rules.length}개 버전 · 최신 v${snapshot.rules.at(-1)!.version}`
                  : "등록 없음",
              ],
              [
                "상품",
                `${productIds.length}종 · 설명서 ${snapshot.products.length}개 버전`,
              ],
              [
                "숙려 최소 경과 시간",
                deployment ? `${deployment.coolingPeriod}초` : "—",
              ],
            ]}
          />
        </section>
      </div>
      <div className={s.columns}>
        <TableScroll as="section" label="상품별 판매 건" className={s.panel}>
          <table>
            <caption className={s.tableCaption}>상품별 판매 건</caption>
            <thead>
              <tr>
                <th scope="col">상품</th>
                <th scope="col">최신 위험등급</th>
                <th scope="col" className={s.numeric}>
                  청약
                </th>
                <th scope="col" className={s.numeric}>
                  확정
                </th>
                <th scope="col" className={s.numeric}>
                  청약·숙려 중
                </th>
                <th scope="col" className={s.numeric}>
                  철회
                </th>
              </tr>
            </thead>
            <tbody>
              {byProduct.map((row) => (
                <tr key={row.id}>
                  <td className={s.wrap}>{row.name}</td>
                  <td>{row.grade ? `${row.grade}등급` : "—"}</td>
                  <td className={s.numeric}>{row.total}</td>
                  <td className={s.numeric}>{row.confirmed}</td>
                  <td className={s.numeric}>{row.subscribed}</td>
                  <td className={s.numeric}>{row.withdrawn}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {byProduct.length === 0 && (
            <p className={s.panelNote}>원장에 등록한 상품이 없습니다.</p>
          )}
        </TableScroll>
        <TableScroll
          as="section"
          label="위험등급별 판매 건"
          className={s.panel}
        >
          <table>
            <caption className={s.tableCaption}>위험등급별 판매 건</caption>
            <thead>
              <tr>
                <th scope="col">위험등급</th>
                <th scope="col" className={s.numeric}>
                  청약
                </th>
                <th scope="col" className={s.numeric}>
                  확정
                </th>
                <th scope="col" className={s.numeric}>
                  부적합 확정
                </th>
              </tr>
            </thead>
            <tbody>
              {byGrade.map((row) => (
                <tr key={row.grade}>
                  <td>{gradeLabel(row.grade)}</td>
                  <td className={s.numeric}>{row.total}</td>
                  <td className={s.numeric}>{row.confirmed}</td>
                  <td className={s.numeric}>
                    {row.unsuitable ? (
                      <Badge tone="warning">{row.unsuitable}</Badge>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>
      <TableScroll as="section" label="최근 원장 이벤트" className={s.panel}>
        <div className={s.panelTitle}>
          <h2>최근 원장 이벤트</h2>
          <label className={s.toggle}>
            <input
              type="checkbox"
              checked={technical}
              onChange={(e) => setTechnical(e.target.checked)}
            />
            블록·거래 보기
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col">블록 시각</th>
              <th scope="col">이벤트</th>
              <th scope="col">대상</th>
              {technical && <th scope="col">블록</th>}
              {technical && <th scope="col">거래 해시</th>}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={`${event.txHash}:${event.name}:${event.subject}`}>
                <td>{dateTime(event.at)}</td>
                <td>
                  <Badge tone={event.tone}>{event.name}</Badge>
                </td>
                <td>
                  {event.to ? (
                    <Link to={event.to}>{event.subject}</Link>
                  ) : (
                    event.subject
                  )}
                </td>
                {technical && (
                  <td className={s.numeric}>{event.block.toString()}</td>
                )}
                {technical && (
                  <td className={s.wrap}>
                    <code>{event.txHash}</code>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && (
          <p className={s.panelNote}>아직 원장 이벤트가 없습니다.</p>
        )}
      </TableScroll>
    </>
  );
}
