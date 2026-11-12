import {
  PRODUCTS,
  PROFILE_NAMES,
  RULE_HASH,
  RULE_TEXT,
  type Deployment,
  type Trace,
} from "../../../../../packages/core/src/index.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Facts,
  Heading,
  Notice,
} from "../../../../../packages/ui/src/components.tsx";
import { profileName } from "../../../../../packages/ui/src/sale.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./operations.module.css";
import { profileRanges, questions } from "../questions.ts";
import { registrationStatus } from "../traces.ts";

const s = { ...ui, ...local };
const profiles = Object.keys(PROFILE_NAMES).map(Number);

/** 고객 투자성향을 판정하는 문항, 점수, 등급과 등급별 판매 상품. */
export function Rules({
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
  const { ruleRegistered } = registrationStatus(traces, deployment?.ledger);
  return (
    <>
      <Heading
        title="진단 기준을 확인하세요"
        description="고객의 투자성향을 판정하는 문항, 점수, 등급입니다. 원장에 등록한 기준으로만 판정을 기록합니다."
      >
        <Badge tone={ruleRegistered ? "success" : "neutral"}>
          {ruleRegistered ? "진단 기준 v3 등록 확인" : "등록 근거 없음"}
        </Badge>
      </Heading>
      <Notice>
        지금 원장(v4)은 진단 기준 v3 하나만 받습니다. 문항·점수·등급을 고치고 새
        버전을 등록하는 기능은 원장 v5에서 제공합니다.
      </Notice>
      <div className={s.detailGrid}>
        <section className={`${s.panel} ${s.pad}`}>
          <h2>문항과 점수</h2>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">문항</th>
                  <th scope="col">0점</th>
                  <th scope="col">1점</th>
                  <th scope="col">2점</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.label}>
                    <th scope="row">{question.label}</th>
                    {question.choices.map((choice) => (
                      <td key={choice}>{choice}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>투자성향 등급</h2>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">점수 합계</th>
                  <th scope="col">투자성향</th>
                </tr>
              </thead>
              <tbody>
                {profileRanges.map(({ profile, range }) => (
                  <tr key={profile}>
                    <td>{range}</td>
                    <th scope="row">{profileName(profile)}</th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>등급별 판매 상품</h2>
          <p>
            고객의 투자성향이 상품의 기준 투자성향보다 낮으면 권유하지 않습니다.
            고객이 직접 고르면 추가 위험 확인을 받은 뒤 가입할 수 있습니다.
          </p>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">투자성향</th>
                  <th scope="col">바로 가입할 수 있는 상품</th>
                  <th scope="col">추가 위험 확인이 필요한 상품</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const suitable = PRODUCTS.filter(
                    (product) => product.minimumProfile <= profile,
                  );
                  const higherRisk = PRODUCTS.filter(
                    (product) => product.minimumProfile > profile,
                  );
                  return (
                    <tr key={profile}>
                      <th scope="row">{profileName(profile)}</th>
                      <td>
                        {suitable
                          .map((product) => product.document.name)
                          .join(", ") || "—"}
                      </td>
                      <td>
                        {higherRisk
                          .map((product) => product.document.name)
                          .join(", ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <aside className={`${s.panel} ${s.pad}`}>
          <h2>원장 등록</h2>
          <Facts
            rows={[
              ["버전", "진단 기준 v3"],
              ["원장 등록", ruleRegistered ? "확인" : "등록 근거 없음"],
              ["기준 지문", <code>{RULE_HASH}</code>],
            ]}
          />
          <details>
            <summary>기준 원문 보기</summary>
            <pre>{RULE_TEXT}</pre>
          </details>
          {!ruleRegistered && (
            <Button disabled={busy} onClick={register}>
              상품·진단 기준 등록
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
