// 증권사 앱 예시의 단계 화면 부품: 단계 머리글, 아래 동작 막대, 가입 시작. 확인 창은 packages/ui의 ConfirmDialog다.
import { useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import type { ProductEntryDto } from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import { ConfirmDialog } from "../../../../packages/ui/src/components.tsx";
import {
  productName,
  saleProduct,
  type Sale,
} from "../../../../packages/ui/src/sales.ts";
import { ErrorSlot } from "./Frame.tsx";
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
      <p className={s.caption}>{caption}</p>
    </>
  );
}

/**
 * 단계의 주요 동작. 처리 중(busy)에는 같은 자리에서 회전 표시를 보이고 누름을 무시한다.
 * 아직 누를 수 없으면(blocked: 확인란, 숙려, 승인 대기) 흐린 모양으로 두고 누름을 무시한다.
 * 확인란이나 답을 기다리면 `explain`이 누를 때 이유를 보여 주고 그 입력으로 초점을 옮긴다. `describedBy`는 그 안내의 id다.
 * 두 경우 모두 네이티브 disabled를 쓰지 않는다. 초점과 Tab 순서가 그대로 남는다.
 */
export function PrimaryAction({
  label,
  onClick,
  to,
  blocked,
  busy,
  explain,
  describedBy,
}: {
  label: string;
  onClick?: () => void;
  to?: string;
  blocked?: boolean;
  busy?: boolean;
  explain?: () => void;
  describedBy?: string;
}) {
  if (to && !busy && !blocked)
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
      busy={busy}
      blocked={blocked}
      onClick={onClick}
      onBlockedClick={explain}
      aria-describedby={describedBy}
    >
      {label}
    </Button>
  );
}

/**
 * 아래 동작 막대. 화면 높이가 넉넉하면 좁은 화면에서는 탭 막대 바로 위에 고정하고,
 * 넓은 화면에서는 본문 끝에 두되 스크롤하면 탭 막대 위에 붙는다. 짧은 화면에서는 본문 끝에 둔다(flow.module.css).
 * 주요 동작은 하나만 둔다. 처리 중 안내는 버튼 아래 한 줄이다. 자리를 미리 잡아 화면이 움직이지 않는다.
 * 처리 오류(`ErrorSlot`)도 같은 자리에 보인다. 고객이 방금 누른 버튼 바로 아래다. 닫기 버튼은 없다.
 */
export function ActionBar({
  children,
  busy,
}: {
  children: ReactNode;
  busy?: string;
}) {
  const { error, attach } = useContext(ErrorSlot);
  // 그리기 전에 알린다. Frame이 본문 위에 같은 오류를 잠깐 그리지 않는다.
  useLayoutEffect(attach, [attach]);
  return (
    <>
      <div className={s.actionSpacer} aria-hidden="true" />
      <div className={error ? `${s.actionBar} ${s.failed}` : s.actionBar}>
        {children}
        {/* 오류 줄과 처리 중 줄은 늘 그려 둔다. 화면 낭독기가 바뀐 문장을 읽는다. 비어 있으면 높이가 없다. */}
        <div className={s.actionLine}>
          <p className={s.actionError} role="alert">
            {error ? (
              <>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{error}</span>
              </>
            ) : null}
          </p>
          <p className={s.actionStatus} role="status">
            {busy && !error ? `${busy} · 잠시만 기다려 주세요` : ""}
          </p>
        </div>
      </div>
    </>
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
      size="large"
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
