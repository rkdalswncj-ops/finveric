import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { PRODUCTS } from "../../core/src/index.ts";
import { Button } from "./button.tsx";
import s from "./ui.module.css";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`${s.badge} ${s[tone] ?? ""}`}>{children}</span>;
}
export function Notice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`${s.notice} ${s[tone] ?? ""}`}>
      <AlertTriangle size={17} />
      <div>{children}</div>
    </div>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.heading}>
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={s.facts}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function TransactionFacts({
  hash,
  block,
}: {
  hash: string;
  block?: string;
}) {
  return (
    <Facts
      rows={[
        ["블록 번호", block ?? "확인 대기"],
        ["거래 해시", <code>{hash}</code>],
      ]}
    />
  );
}
export function FundFilter({
  value,
  change,
  disabled,
}: {
  value: string;
  change: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`${s.field} ${s.fundFilter}`}>
      펀드 선택
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">전체 펀드</option>
        {PRODUCTS.map((product) => (
          <option key={product.id} value={product.id}>
            {product.document.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function AccessCodeForm({
  connect,
  busy,
}: {
  connect: () => void;
  busy: boolean;
}) {
  const [accessCode, setAccessCode] = useState("");
  return (
    <form
      className={s.access}
      onSubmit={(e) => {
        e.preventDefault();
        sessionStorage.setItem("finveric-token", accessCode);
        connect();
      }}
    >
      <label htmlFor="access">시연 접근 코드</label>
      <input
        id="access"
        type="password"
        value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)}
        autoComplete="off"
      />
      <Button disabled={busy}>연결하기</Button>
    </form>
  );
}
