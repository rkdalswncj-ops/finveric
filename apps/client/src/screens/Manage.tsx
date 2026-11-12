import {
  PRODUCTS,
  RULE_HASH,
  type Deployment,
  type Trace,
} from "../../../../packages/core/src/index.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../packages/ui/src/components.tsx";
import { profileName, short } from "../../../../packages/ui/src/sale.ts";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./operations.module.css";
import { receiptEvents, registrationActions } from "../traces.ts";

const s = { ...ui, ...local };

export function Manage({
  deployment,
  traces,
  busy,
  register,
}: {
  deployment?: Deployment;
  traces: Trace[];
  busy: boolean;
  register: () => unknown;
}) {
  const registrationEvents = traces
    .filter((trace) => registrationActions.has(trace.action))
    .flatMap((trace) => receiptEvents(trace, deployment?.ledger));
  const documentHashes = new Map(
    registrationEvents
      .filter((event) => event.eventName === "ProductRegistered")
      .map(({ args }) => [
        args.productId.toLowerCase(),
        args.documentHash.toLowerCase(),
      ]),
  );
  const ruleRegistered = registrationEvents.some(
    (event) =>
      event.eventName === "RuleRegistered" &&
      event.args.ruleHash.toLowerCase() === RULE_HASH.toLowerCase(),
  );
  const productsRegistered = PRODUCTS.every(
    (product) =>
      documentHashes.get(product.id.toLowerCase()) ===
      product.documentHash.toLowerCase(),
  );
  return (
    <>
      <Heading
        title="상품과 적용 기준을 등록하세요"
        description="운용사와 판매사가 서로 다른 테스트 키로 등록합니다."
      >
        <Button disabled={busy} onClick={register}>
          {productsRegistered && ruleRegistered
            ? "등록 상태 확인"
            : "상품·규칙 v3 등록"}
        </Button>
      </Heading>
      <div className={s.detailGrid}>
        <section className={`${s.panel} ${s.pad}`}>
          <h2>상품별 등록 현황</h2>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">상품</th>
                  <th scope="col">기준 투자성향</th>
                  <th scope="col">등록 상태</th>
                  <th scope="col">원장 설명서 지문</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map((product) => {
                  const hash = documentHashes.get(product.id.toLowerCase());
                  const matches = hash === product.documentHash.toLowerCase();
                  return (
                    <tr key={product.id}>
                      <th scope="row">{product.document.name}</th>
                      <td>{profileName(product.minimumProfile)}</td>
                      <td>
                        <Badge
                          tone={
                            matches ? "success" : hash ? "warning" : "neutral"
                          }
                        >
                          {matches
                            ? "등록 확인"
                            : hash
                              ? "지문 불일치"
                              : "등록 근거 없음"}
                        </Badge>
                      </td>
                      <td>
                        <code title={hash}>{short(hash)}</code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {PRODUCTS.map(({ id, document, documentHash }) => (
            <details key={id}>
              <summary>
                {document.name} 설명서 {document.version} 보기
              </summary>
              <Facts
                rows={[
                  ["상품 ID", <code>{id}</code>],
                  ["설명서 지문", <code>{documentHash}</code>],
                  [
                    "원장 설명서 지문",
                    <code>{documentHashes.get(id.toLowerCase()) ?? "—"}</code>,
                  ],
                ]}
              />
              <pre>{JSON.stringify(document, null, 2)}</pre>
            </details>
          ))}
        </section>
        <aside className={`${s.panel} ${s.pad}`}>
          <h2>투자성향 분류 규칙 v3</h2>
          <p>손실 감내와 투자 경험은 각각 0~2점입니다.</p>
          <Facts
            rows={[
              ["합계 0~1점", profileName(1)],
              ["합계 2점", profileName(2)],
              ["합계 3~4점", profileName(3)],
              ["원장 등록", ruleRegistered ? "확인" : "등록 근거 없음"],
              ["규칙 지문", <code>{RULE_HASH}</code>],
            ]}
          />
          <Notice tone="warning">
            상품의 기준보다 낮은 투자성향에는 고객의 추가 위험 확인이
            필요합니다.
          </Notice>
          <h3>역할별 테스트 주소</h3>
          <Facts
            rows={Object.entries(deployment?.roles ?? {})
              .filter(([r]) => r !== "deployer")
              .map(([r, a]) => [r, <code title={a}>{short(a)}</code>])}
          />
        </aside>
      </div>
    </>
  );
}
