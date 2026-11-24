import { useEffect, useRef, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ExternalLink, House, Layers, type LucideIcon } from "lucide-react";
import { Notice } from "./components.tsx";
import { focusPageTitle, useFocusRescue } from "./focus.ts";
import { HeadingTools } from "./heading-tools.ts";
import s from "./ui.module.css";

const brand = (
  <>
    <span>
      <Layers size={20} />
    </span>
    FINVERIC
  </>
);

/** 앱 안의 메뉴 항목. */
export type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  end?: boolean;
};
export type NavGroup = { label: string; caption?: string; items: NavItem[] };
/** 다른 페이지로 가는 링크. 사이드바 아래쪽에 두고 새 탭으로 연다. */
export type ExternalItem = { label: string; icon: LucideIcon; href: string };

/**
 * client·auditor 앱이 함께 쓰는 사이드 메뉴와 상태 표시.
 * entryHref를 주면 브랜드와 "처음 화면" 항목이 라우터 밖의 진입 화면으로 간다(같은 탭).
 * links는 "처음 화면" 아래에 작은 링크로 둔다. 새 탭으로 연다.
 * 문서 제목은 "화면 · app · FINVERIC"이다. 경로가 바뀌면 맨 위로 가고 화면 제목(h1)에 초점을 옮긴다.
 * 상태 줄(role="status")은 늘 그려 둔다. 처리 중에는 busy를 보인다. 처리가 끝난 뒤의 notice는 화면 낭독기만 읽는다.
 * 오류 알림(error)은 본문 위에 붙어 있다. 닫기 버튼은 없다. 앱이 다음 처리, 경로 이동, 다시 읽기 성공 때 지운다.
 */
export function Shell({
  home,
  entryHref,
  groups,
  links,
  app,
  title,
  headingTools,
  foot,
  error,
  notice,
  busy,
  children,
}: {
  home: string;
  entryHref?: string;
  groups: NavGroup[];
  links?: ExternalItem[];
  app: string;
  title: string;
  headingTools?: ReactNode;
  foot?: { title: string; text: string };
  error?: string;
  notice?: string;
  busy?: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);
  useFocusRescue(main);
  useEffect(() => {
    document.title = `${title} · ${app} · FINVERIC`;
  }, [title, app]);
  useEffect(() => {
    // 좁은 화면의 가로 메뉴에서 현재 항목이 가려지지 않게 한다. 가로로만 스크롤한다(화면은 움직이지 않는다).
    // 여백은 ui.module.css의 메뉴 안쪽 여백(앞 16px, 뒤 40px의 흐린 끝)과 같다.
    const reveal = () => {
      const menu = nav.current;
      const item = menu?.querySelector('[aria-current="page"]');
      if (!menu || !item || menu.scrollWidth <= menu.clientWidth) return;
      const box = menu.getBoundingClientRect();
      const { left, right } = item.getBoundingClientRect();
      if (left < box.left + 16) menu.scrollLeft += left - box.left - 16;
      else if (right > box.right - 40)
        menu.scrollLeft += right - box.right + 40;
    };
    reveal();
    // 창 크기를 줄이거나 기기를 돌려 가로 메뉴가 되면 다시 맞춘다.
    const narrow = window.matchMedia("(max-width: 640px)");
    narrow.addEventListener("change", reveal);
    return () => narrow.removeEventListener("change", reveal);
  }, [pathname]);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    window.scrollTo(0, 0);
    focusPageTitle(main.current, { preventScroll: true });
  }, [pathname]);
  return (
    <div className={s.shell}>
      <a className={s.skip} href="#content">
        본문으로 이동
      </a>
      <aside className={s.sidebar}>
        {entryHref ? (
          <a
            className={s.brand}
            href={entryHref}
            aria-label="FINVERIC 처음 화면"
          >
            {brand}
          </a>
        ) : (
          <Link className={s.brand} to={home}>
            {brand}
          </Link>
        )}
        <nav ref={nav} aria-label="주 메뉴">
          {groups.map((group) => (
            <div key={group.label}>
              <div className={s.navLabel}>
                {group.label}
                {group.caption && (
                  <span className={s.navCaption}>{group.caption}</span>
                )}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  end={item.end ?? true}
                  to={item.path}
                  className={({ isActive }) =>
                    `${s.navItem} ${isActive ? s.active : ""}`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div
          className={`${s.sidebarEnd} ${links?.length ? s.sidebarLinks : ""}`}
        >
          {entryHref && (
            <a className={s.entryLink} href={entryHref}>
              <House size={16} />
              처음 화면
            </a>
          )}
          {links?.map((link) => (
            <a
              key={link.href}
              className={s.entryLink}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              <link.icon size={16} />
              {link.label}
              <span className={s.srOnly}> (새 탭에서 열기)</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
          {foot && (
            <div className={s.sidebarFoot}>
              <strong>{foot.title}</strong>
              <p>{foot.text}</p>
            </div>
          )}
        </div>
      </aside>
      <div className={s.workspace}>
        <main id="content" ref={main} className={s.main}>
          {error && (
            <div role="alert" className={s.alert}>
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          {/* 처리 중 표시는 누른 버튼의 회전 표시 하나다. 이 줄은 글자만 보인다. */}
          <p role="status" className={busy ? s.busy : s.srOnly}>
            {busy || notice}
          </p>
          <HeadingTools.Provider value={headingTools}>
            {children}
          </HeadingTools.Provider>
        </main>
      </div>
    </div>
  );
}
