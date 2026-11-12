import { Link } from "react-router";
import {
  PRODUCTS,
  type Deployment,
  type Trace,
} from "../../../../../packages/core/src/index.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
} from "../../../../../packages/ui/src/components.tsx";
import { profileName, short } from "../../../../../packages/ui/src/sale.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./operations.module.css";
import { registrationStatus } from "../traces.ts";

const s = { ...ui, ...local };

/** 판매사가 파는 상품과 설명서 지문을 원장에 등록한다. */
export function Products({
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
  const { documentHashes, ruleRegistered, productsRegistered } =
    registrationStatus(traces, deployment?.ledger);
  return (
    <>
      <Heading
        title="판매 상품을 등록하세요"
        description="상품의 설명서 지문, 위험등급, 기준 투자성향을 원장에 고정합니다. 등록한 상품은 고칠 수 없습니다."
      >
        <Button disabled={busy} onClick={register}>
          {productsRegistered && ruleRegistered
            ? "등록 상태 확인"
            : "상품·진단 기준 등록"}
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
                  <th scope="col">위험등급</th>
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
                      <td>{product.document.risk}</td>
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
          <h2>등급별 판매 기준</h2>
          <p>
            투자성향별로 바로 가입할 수 있는 상품은 진단 기준 화면에서
            확인합니다.
          </p>
          <Button variant="outline" asChild>
            <Link to="/rules">진단 기준 보기</Link>
          </Button>
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
