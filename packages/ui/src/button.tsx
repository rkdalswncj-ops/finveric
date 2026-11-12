import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { LoaderCircle } from "lucide-react";
import { twMerge } from "tailwind-merge";
import ui from "./ui.module.css";

const buttonVariants = cva("button", {
  variants: {
    variant: { default: "primary", outline: "button-outline", ghost: "ghost" },
    size: { default: "", large: "large" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

/**
 * 버튼. 누를 수 없는 상태는 세 가지다. 스타일은 theme.css의 `.button`이다.
 * - `busy`: 이 버튼의 처리가 진행 중이다. `aria-busy`와 `aria-disabled`를 달고 회전 표시를 넣는다.
 *   모양은 그대로다. 누름을 무시하고 초점은 그대로 둔다.
 * - `blocked`: 아직 누를 수 없다(확인란, 숙려, 승인 대기, 빈 입력, 다른 처리 중). `aria-disabled`만 단다.
 *   흐린 모양이다. 누름을 무시하고 초점과 Tab 순서는 그대로 둔다.
 * - `disabled`: 네이티브 disabled. 정말 쓸 수 없고 초점이 그 위에 없을 때만 쓴다.
 *   누른 버튼에 쓰면 초점이 문서 처음으로 떨어진다.
 * `asChild`(링크)에는 회전 표시를 넣지 않는다.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  busy = false,
  blocked = false,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    busy?: boolean;
    blocked?: boolean;
  }) {
  const Component = asChild ? Slot : "button";
  const inert = busy || blocked;
  return (
    <Component
      data-slot="button"
      className={twMerge(clsx(buttonVariants({ variant, size }), className))}
      {...props}
      aria-busy={busy || undefined}
      aria-disabled={inert || props["aria-disabled"] || undefined}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        // aria-disabled는 누름을 막지 않는다. 처리 중이거나 아직 누를 수 없으면 여기서 막는다(폼 제출 포함).
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {busy && !asChild ? (
        <>
          <LoaderCircle
            size={size === "large" ? 18 : 16}
            className={ui.spin}
            aria-hidden="true"
          />
          {children}
        </>
      ) : (
        children
      )}
    </Component>
  );
}
