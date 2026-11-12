import type { ReactNode } from "react";
import { Link } from "react-router";
import { FileText } from "lucide-react";
import type { Product } from "../../../packages/core/src/index.ts";
import { Button } from "../../../packages/ui/src/button.tsx";
import { Badge, Facts } from "../../../packages/ui/src/components.tsx";
import {
  profileName,
  saleProductName,
  short,
  type Sale,
} from "../../../packages/ui/src/sale.ts";
import ui from "../../../packages/ui/src/ui.module.css";
import local from "./client.module.css";
import { channel } from "./links.ts";

const s = { ...ui, ...local };

export function FundDisclosure({
  document,
}: {
  document: Product["document"];
}) {
  return (
    <details>
      <summary>상품 설명서 {document.version} 보기</summary>
      <h3>{document.name}</h3>
      <p>{document.strategy}</p>
      <Facts
        rows={[
          ["상품 코드", document.product],
          ["클래스", document.class],
          ["운용사", document.manager],
          ["판매사", document.seller],
          ["위험등급", document.risk],
          ["연 총보수", document.annualFee],
        ]}
      />
      <p>{document.warning}</p>
    </details>
  );
}
export function Empty({ children }: { children?: ReactNode }) {
  return (
    <div className={s.empty}>
      <FileText size={30} />
      <h2>아직 가입 기록이 없어요</h2>
      <p>상품을 확인하고 첫 진단을 시작해 주세요.</p>
      {children ?? (
        <Button asChild>
          <Link to={channel.catalog}>펀드 살펴보기</Link>
        </Button>
      )}
    </div>
  );
}
export function History({
  sale,
  showDraftProfiles = false,
}: {
  sale: Sale;
  showDraftProfiles?: boolean;
}) {
  return (
    <ol className={s.history}>
      {sale.attempts.map((a) => (
        <li key={a.round}>
          <span className={s.historyDot}>{a.round}</span>
          <div>
            <strong>진단 {a.round}회차</strong>
            <p>
              <code>{short(a.commitment)}</code>
              {a.round > 1 && " · 답변 정정"}
            </p>
          </div>
          {a.confirmed && (sale.state.finalized || showDraftProfiles) ? (
            <Badge tone="blue">{profileName(a.profile)}</Badge>
          ) : (
            <Badge>초안</Badge>
          )}
        </li>
      ))}
    </ol>
  );
}
export function SaleSelect({
  sales,
  sale,
  select,
  label = "판매 건 선택",
}: {
  sales: Sale[];
  sale?: Sale;
  select: (id: string) => void;
  label?: string;
}) {
  return (
    <label className={s.saleSelect}>
      {label}
      <select value={sale?.id ?? ""} onChange={(e) => select(e.target.value)}>
        {sales.map((s) => (
          <option key={s.id} value={s.id}>
            {saleProductName(s)} · {s.id.slice(-6)}
          </option>
        ))}
      </select>
    </label>
  );
}
