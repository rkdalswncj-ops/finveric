// client 페이지의 여러 화면이 함께 쓰는 표시 요소.
import {
  isSuitable,
  PROFILE_NAMES,
  type ProductDocument,
  type RuleDocument,
} from "../../../../packages/core/src/index.ts";
import type { DiagnosisDto } from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import { Facts, Notice } from "../../../../packages/ui/src/components.tsx";
import { dateTime } from "../../../../packages/ui/src/format.ts";
import {
  gradeName,
  issuerLabel,
  limitRange,
  productName,
  profileName,
  type ProductEntry,
} from "../../../../packages/ui/src/sales.ts";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./client.module.css";

const s = { ...ui, ...local };
const PROFILES = Object.keys(PROFILE_NAMES).map(Number);

/** 아무 기준·상품도 등록하지 않았을 때 보여 주는 기본 등록 안내. */
export function RegisterNotice({
  busy,
  register,
}: {
  busy: boolean;
  register: () => unknown;
}) {
  return (
    <div className={s.registerNotice}>
      <Notice tone="warning">
        아직 원장에 등록한 진단 기준과 상품이 없습니다. 기본 진단 기준과 예시
        상품 3종을 한 번에 등록할 수 있습니다.
      </Notice>
      <Button busy={busy} onClick={register}>
        상품·진단 기준 등록
      </Button>
    </div>
  );
}

/** 상품 설명서의 속성. 판매사 화면에서 쓴다. */
export function ProductFacts({ document }: { document: ProductDocument }) {
  return (
    <Facts
      rows={[
        ["상품 코드", <code>{document.code}</code>],
        ["상품 유형", document.type],
        ["위험등급", gradeName(document.riskGrade)],
        [
          "속성",
          [
            document.complex ? "고난도" : "고난도 아님",
            document.derivative ? "파생결합증권" : "파생결합증권 아님",
          ].join(" · "),
        ],
        [issuerLabel(document), document.issuer],
        ["판매사", document.seller],
        ["판매대상 고객군", document.targetMarket],
        ["최대 손실", document.maxLoss],
        ["수수료", document.fee],
      ]}
    />
  );
}

/**
 * 투자성향별 권유 가능 상품. 적합성 기준(투자성향별 권유 가능 최고 위험등급)으로 나눈다.
 * 고객이 추출 조건 답변을 고르면 권유 범위가 더 좁아질 수 있다.
 */
export function ProfileProducts({
  rule,
  products,
}: {
  rule?: RuleDocument;
  products: ProductEntry[];
}) {
  if (!rule) return <p className={s.small}>진단 기준을 등록하면 표시합니다.</p>;
  return (
    <div className={s.tableWrap}>
      <table>
        <thead>
          <tr>
            <th scope="col">투자성향</th>
            <th scope="col">권유 가능 위험등급</th>
            <th scope="col">권유 가능 상품</th>
            <th scope="col">추가 위험 확인이 필요한 상품</th>
          </tr>
        </thead>
        <tbody>
          {PROFILES.map((profile) => {
            const limit = rule.matrix[profile - 1];
            const names = (suitable: boolean) =>
              products
                .filter(
                  ({ product }) =>
                    isSuitable(product.document.riskGrade, limit) === suitable,
                )
                .map(({ product }) => productName(product.document))
                .join(", ") || "—";
            return (
              <tr key={profile}>
                <td>
                  <strong>{profileName(profile)}</strong>
                </td>
                <td>{limitRange(limit)}</td>
                <td className={s.wrapCell}>{names(true)}</td>
                <td className={s.wrapCell}>{names(false)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 고객 가명 ID의 진단 회차. 청약에 쓴 회차를 강조한다. */
export function DiagnosisTable({
  diagnoses,
  used,
  caption,
}: {
  diagnoses: DiagnosisDto[];
  used?: number;
  caption?: string;
}) {
  return (
    <div className={s.tableWrap}>
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">회차</th>
            <th scope="col">투자성향</th>
            <th scope="col">권유 가능 위험등급</th>
            <th scope="col">고령</th>
            <th scope="col">기록 시각</th>
            <th scope="col">거래</th>
          </tr>
        </thead>
        <tbody>
          {diagnoses.map((diagnosis) => (
            <tr
              key={diagnosis.attempt}
              className={diagnosis.attempt === used ? s.selectedRow : ""}
            >
              <td>
                <strong>
                  {diagnosis.attempt}회차
                  {diagnosis.attempt === used && " · 청약"}
                </strong>
              </td>
              <td>{profileName(diagnosis.profile)}</td>
              <td>{limitRange(diagnosis.limit)}</td>
              <td>{diagnosis.elderly ? "고령" : "—"}</td>
              <td>{dateTime(diagnosis.at)}</td>
              <td className={s.wrapCell}>
                <code>{diagnosis.txHash}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
