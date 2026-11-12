import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, FileText } from "lucide-react";
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
/** 빈 목록·없는 화면 안내. */
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <FileText size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
/**
 * 요약 수치 카드. `.stats` 묶음 안에 둔다. `to`가 있으면 그 화면으로 가는 링크다.
 */
export function Stat({
  label,
  value,
  note,
  to,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </>
  );
  return to ? (
    <Link className={s.stat} to={to}>
      {body}
    </Link>
  ) : (
    <div className={s.stat}>{body}</div>
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
      <label htmlFor="access">접근 코드</label>
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

/**
 * 되돌릴 수 없는 동작이나 작업을 버리는 동작 전에 묻는 가운데 창.
 * 안전한 선택(`cancelLabel`)이 주요 버튼이고 처음 초점을 받는다. Esc는 안전한 선택과 같다.
 * 증권사 앱 예시는 `size="large"` 버튼을 쓴다.
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  size,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  size?: "default" | "large";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const safe = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // 처음 초점은 안전한 선택(계속하기)에 둔다.
      safe.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={textId}>{text}</p>
      <div className={s.dialogActions}>
        <Button variant="outline" size={size} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button ref={safe} size={size} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
