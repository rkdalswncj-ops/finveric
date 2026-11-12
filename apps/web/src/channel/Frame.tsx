import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronLeft,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { Button } from "../../../../packages/ui/src/button.tsx";
import {
  Badge,
  Notice,
  type Tone,
} from "../../../../packages/ui/src/components.tsx";
import ui from "../../../../packages/ui/src/ui.module.css";
import f from "./frame.module.css";
import { channel } from "./links.ts";

const TABS = [
  { path: channel.catalog, label: "상품", icon: LayoutGrid },
  { path: channel.enroll, label: "가입", icon: BriefcaseBusiness },
  { path: channel.records, label: "내 가입", icon: FileText },
  { path: channel.verify, label: "기록 확인", icon: BadgeCheck },
];
/** 탭이 맡는 경로. 상품 상세는 상품 탭에 속한다. */
const tabOf = (pathname: string) =>
  pathname === channel.fund ? channel.catalog : pathname;

/**
 * 증권사 앱의 틀. 맨 위 줄은 이 화면이 FINVERIC API 연동 예시라는 표시와 연결한 원장이다.
 * 앱 머리글(증권사 이름 또는 뒤로 가기), 최대 480px 한 열의 본문, 아래 탭 막대로 이뤄진다.
 * 탭을 옮겨도 진행 중인 가입은 그대로다(App의 신청 번호와 가입 화면의 세션 보관).
 */
export function Frame({
  firm,
  title,
  back,
  network,
  error,
  dismissError,
  children,
}: {
  firm: string;
  title?: string;
  back?: { to: string; label: string };
  network: { tone: Tone; text: string };
  error?: string;
  dismissError: () => void;
  children: ReactNode;
}) {
  const { pathname, search } = useLocation();
  const current = tabOf(pathname);
  // 앱처럼 화면이 바뀌면 맨 위에서 시작한다.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return (
    <div className={f.page}>
      <a className={ui.skip} href="#content">
        본문으로 이동
      </a>
      <div className={f.example}>
        <span>FINVERIC API 연동 예시</span>
        <Badge tone={network.tone}>{network.text}</Badge>
      </div>
      <div className={f.app}>
        <header className={f.header}>
          {back ? (
            <Link className={f.back} to={back.to} aria-label={back.label}>
              <ChevronLeft size={24} />
            </Link>
          ) : (
            <span className={f.logo} aria-hidden="true">
              {firm.slice(0, 1)}
            </span>
          )}
          <strong>{title ?? firm}</strong>
        </header>
        <main id="content" className={f.main}>
          {children}
        </main>
        {/* 오류는 본문 위에 띄운다. 본문이 밀려 움직이지 않는다. 처리 중 표시는 각 화면의 동작 자리에 둔다. */}
        {error && (
          <div role="alert" className={f.toast}>
            <Notice tone="danger">{error}</Notice>
            <Button variant="ghost" onClick={dismissError}>
              닫기
            </Button>
          </div>
        )}
        <nav className={f.tabs} aria-label="앱 메뉴">
          {TABS.map((tab) => {
            const active = current === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={active ? f.tabActive : f.tab}
                aria-current={active ? "page" : undefined}
              >
                {/* 현재 탭은 색, 위 막대, 굵은 아이콘 선으로 함께 표시한다. */}
                <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
