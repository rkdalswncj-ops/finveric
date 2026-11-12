// 초점 이동. 경로가 바뀌거나 누른 요소가 사라지면 초점을 화면 제목으로 옮긴다.
import { useEffect, type RefObject } from "react";

/** 초점을 받을 수 있는 화면 제목. `Heading`의 h1, `Empty`의 h2, 가입 단계 제목이 `tabIndex={-1}`이다. */
const TITLE = ':is(h1, h2)[tabindex="-1"]';

/** root 안의 첫 화면 제목으로 초점을 옮긴다. 제목이 없으면 false다. */
export function focusPageTitle(
  root: ParentNode | null | undefined,
  options?: FocusOptions,
) {
  const title = root?.querySelector<HTMLElement>(TITLE);
  title?.focus(options);
  return !!title;
}

/** 요소로 초점을 옮긴다. 구역 제목처럼 누를 수 없는 요소는 `tabIndex={-1}`이어야 한다. */
export function focusElement(id: string) {
  document.getElementById(id)?.focus();
}

/**
 * 누른 요소가 사라져 초점이 문서 처음(body)으로 떨어지면 root 안의 화면 제목으로 옮긴다.
 * 승인, 폐기, 편집 취소처럼 누른 버튼이 없어지는 처리 뒤에도 키보드 위치가 남는다.
 * 더 알맞은 곳(구역 제목, 다음 행)이 있으면 화면이 처리 직후 그곳으로 먼저 옮긴다.
 */
export function useFocusRescue(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let last: Element | null = null;
    const remember = (event: FocusEvent) => {
      last = event.target as Element;
    };
    // 빈 곳을 눌러 초점을 뺀 경우는 되돌리지 않는다.
    const forget = () => {
      last = null;
    };
    const observer = new MutationObserver(() => {
      const active = document.activeElement;
      if (last && !last.isConnected && (!active || active === document.body))
        focusPageTitle(element);
    });
    observer.observe(element, { childList: true, subtree: true });
    document.addEventListener("focusin", remember);
    document.addEventListener("pointerdown", forget, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", remember);
      document.removeEventListener("pointerdown", forget, true);
    };
  }, [root]);
}
