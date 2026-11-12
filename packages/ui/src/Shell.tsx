import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import {
  ExternalLink,
  House,
  Layers,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./button.tsx";
import { Badge, Notice } from "./components.tsx";
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
export type NavItem = { label: string; icon: LucideIcon; path: string };
export type NavGroup = { label: string; caption?: string; items: NavItem[] };
/** 다른 페이지로 가는 링크. 사이드바 아래쪽에 두고 새 탭으로 연다. */
export type ExternalItem = { label: string; icon: LucideIcon; href: string };

/**
 * client·auditor 앱이 함께 쓰는 사이드 메뉴, 상단 막대, 상태 표시.
 * entryHref를 주면 브랜드와 "처음 화면" 항목이 라우터 밖의 진입 화면으로 간다(같은 탭).
 * links는 "처음 화면" 아래에 작은 링크로 둔다. 새 탭으로 연다.
 */
export function Shell({
  home,
  entryHref,
  groups,
  links,
  area,
  title,
  badge,
  foot,
  error,
  dismissError,
  notice,
  busy,
  children,
}: {
  home: string;
  entryHref?: string;
  groups: NavGroup[];
  links?: ExternalItem[];
  area: string;
  title: string;
  badge: { tone: string; text: string };
  foot?: { title: string; text: string };
  error?: string;
  dismissError?: () => void;
  notice?: string;
  busy?: string;
  children: ReactNode;
}) {
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
        <nav aria-label="주 메뉴">
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
                  end
                  to={item.path}
                  className={({ isActive }) =>
                    `${s.navItem} ${isActive ? s.active : ""}`
                  }
                >
                  <item.icon size={18} />
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
              <ExternalLink size={13} aria-label="새 탭에서 열기" />
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
        <header className={s.topbar}>
          <div>
            {area} <span>/</span> <strong>{title}</strong>
          </div>
          <Badge tone={badge.tone}>{badge.text}</Badge>
        </header>
        <main id="content" className={s.main}>
          {error && (
            <div role="alert" className={s.alert}>
              <Notice tone="danger">{error}</Notice>
              {dismissError && (
                <Button variant="ghost" onClick={dismissError}>
                  닫기
                </Button>
              )}
            </div>
          )}
          {notice && (
            <p role="status" className={s.notice}>
              {notice}
            </p>
          )}
          {busy && (
            <div role="status" aria-live="polite" className={s.busy}>
              <LoaderCircle className={s.spin} size={18} />
              {busy}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
