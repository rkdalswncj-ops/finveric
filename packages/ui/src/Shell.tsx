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

/** 앱 안 경로(path) 또는 다른 앱으로 가는 주소(href). */
export type NavItem = {
  label: string;
  icon: LucideIcon;
  path?: string;
  href?: string;
};
export type NavGroup = { label: string; caption?: string; items: NavItem[] };

/**
 * client·auditor 앱이 함께 쓰는 사이드 메뉴, 상단 막대, 상태 표시.
 * entryHref를 주면 브랜드와 "처음 화면" 항목이 라우터 밖의 진입 화면으로 간다(같은 탭).
 */
export function Shell({
  home,
  entryHref,
  groups,
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
  area: string;
  title: string;
  badge: { tone: string; text: string };
  foot: { title: string; text: string };
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
              {group.items.map((item) =>
                item.href ? (
                  <a
                    key={item.href}
                    className={s.navItem}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <item.icon size={18} />
                    {item.label}
                    <ExternalLink size={13} aria-label="새 탭에서 열기" />
                  </a>
                ) : (
                  <NavLink
                    key={item.path}
                    end
                    to={item.path ?? home}
                    className={({ isActive }) =>
                      `${s.navItem} ${isActive ? s.active : ""}`
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className={s.sidebarEnd}>
          {entryHref && (
            <a className={s.entryLink} href={entryHref}>
              <House size={16} />
              처음 화면
            </a>
          )}
          <div className={s.sidebarFoot}>
            <strong>{foot.title}</strong>
            <p>{foot.text}</p>
          </div>
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
