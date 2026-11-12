// 증권사 앱 예시의 단계 화면 부품: 단계 머리글, 아래 동작 막대, 확인 창.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import type { ProductEntryDto } from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import {
  productName,
  saleProduct,
  type Sale,
} from "../../../../packages/ui/src/sales.ts";
import ui from "../../../../packages/ui/src/ui.module.css";
import s from "./flow.module.css";

/**
 * 단계 머리글. 왼쪽에 이전(갈 수 있을 때만), 가운데에 단계 이름과 진행, 오른쪽에 중단(청약 전만)을 둔다.
 * 아래에 진행 막대와 상품 한 줄을 둔다.
 */
export function StepHeader({
  label,
  progress,
  caption,
  back,
  stop,
}: {
  label: string;
  progress: number;
  caption: string;
  back?: () => void;
  stop?: () => void;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <>
      <div className={s.stepHeader}>
        <div className={s.stepNav}>
          {back ? (
            <button type="button" className={s.navButton} onClick={back}>
              <ChevronLeft size={20} aria-hidden="true" />
              이전
            </button>
          ) : (
            <span />
          )}
          <span className={s.stepLabel}>{label}</span>
          {stop ? (
            <button
              type="button"
              className={`${s.navButton} ${s.stop}`}
              aria-label="가입 중단하기"
              onClick={stop}
            >
              중단
            </button>
          ) : (
            <span />
          )}
        </div>
        <div
          className={s.progress}
          role="progressbar"
          aria-label="가입 진행"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <p className={s.caption} title={caption}>
        {caption}
      </p>
    </>
  );
}

/** 단계의 주요 동작. 처리 중에는 같은 자리에서 회전 표시를 보이고 다시 누를 수 없다. */
export function PrimaryAction({
  label,
  onClick,
  to,
  disabled,
  busy,
}: {
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  if (to && !busy && !disabled)
    return (
      <Button size="large" asChild>
        <Link to={to} onClick={onClick}>
          {label}
        </Link>
      </Button>
    );
  return (
    <Button
      size="large"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      {busy && (
        <LoaderCircle size={18} className={ui.spin} aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}

/**
 * 아래 동작 막대. 좁은 화면에서는 탭 막대 바로 위에 고정하고, 넓은 화면에서는 본문 끝에 둔다.
 * 주요 동작은 하나만 둔다. 처리 중 안내는 버튼 아래 한 줄이다. 자리를 미리 잡아 화면이 움직이지 않는다.
 */
export function ActionBar({
  children,
  busy,
}: {
  children: ReactNode;
  busy?: string;
}) {
  return (
    <>
      <div className={s.actionSpacer} aria-hidden="true" />
      <div className={s.actionBar}>
        {children}
        <p className={s.actionStatus} role="status">
          {busy ? `${busy} · 잠시만 기다려 주세요` : ""}
        </p>
      </div>
    </>
  );
}

/** 되돌릴 수 없는 동작(가입 중단, 청약 철회) 전에 묻는 창. 안전한 선택이 주요 버튼이다. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const safe = useRef<HTMLButtonElement>(null);
  const titleId = useId();
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
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{text}</p>
      <div className={s.dialogActions}>
        <Button variant="outline" size="large" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button ref={safe} size="large" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}

/**
 * 상품 카드·상세에서 그 상품의 가입에 바로 들어간다.
 * 다른 상품의 청약 전 가입이 있으면 중단할지 먼저 묻는다. 그 밖에는 묻지 않는다.
 */
export function useStartEnrollment(
  products: ProductEntryDto[],
  activeDraft: Sale | undefined,
  start: (productId: string, replace?: boolean) => unknown,
) {
  const [pending, setPending] = useState<string>();
  const draftProduct = saleProduct(products, activeDraft);
  const same = (productId: string) =>
    activeDraft?.productId.toLowerCase() === productId.toLowerCase();
  const replaces = (productId: string) =>
    activeDraft?.status === "draft" && !same(productId);
  const request = (productId: string) =>
    replaces(productId) ? setPending(productId) : void start(productId);
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title="진행 중인 가입을 중단할까요?"
      text={`${productName(draftProduct?.document)} 가입을 중단하고 이 상품으로 새로 시작해요. 진단 기록은 남아요.`}
      confirmLabel="중단하고 시작하기"
      cancelLabel="그대로 두기"
      onCancel={() => setPending(undefined)}
      onConfirm={() => {
        const id = pending;
        setPending(undefined);
        if (id) void start(id, true);
      }}
    />
  );
  return { request, dialog, same, replaces, draftProduct };
}
