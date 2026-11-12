import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import {
  FileDown,
  LayoutDashboard,
  ListChecks,
  Package,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  DEPLOYMENT_ERROR,
  useDeployment,
} from "../../../../packages/ui/src/deployment.ts";
import { Shell, type NavGroup } from "../../../../packages/ui/src/Shell.tsx";
import { Dashboard } from "./screens/Dashboard.tsx";
import { Disputes } from "./screens/Disputes.tsx";
import { Products } from "./screens/Products.tsx";
import { Report } from "./screens/Report.tsx";
import { Rules } from "./screens/Rules.tsx";
import { Signals } from "./screens/Signals.tsx";
import { useLedger } from "./useLedger.ts";

/** 감독기관 화면(B2G). 모든 원장 기록은 지정 RPC에서 읽는다. 판매사 API에는 GET만 보낸다. */
const PAGES: { path: string; label: string; icon: LucideIcon }[] = [
  { path: "/", label: "대시보드", icon: LayoutDashboard },
  { path: "/disputes", label: "분쟁 조회", icon: ShieldCheck },
  { path: "/rules", label: "기준 감사", icon: ListChecks },
  { path: "/products", label: "상품 감사", icon: Package },
  { path: "/signals", label: "위험 신호", icon: TriangleAlert },
  { path: "/report", label: "보고서", icon: FileDown },
];
const groups: NavGroup[] = [{ label: "감독기관", items: PAGES }];

export function App() {
  const location = useLocation();
  const [error, setError] = useState("");
  // 검증 설정을 읽지 못하면 원장 줄과 각 화면의 원장 영역이 오류를 보여 준다(useLedger). 알림을 따로 띄우지 않는다.
  const [configFailed, setConfigFailed] = useState(false);
  const onConfigError = useCallback(() => setConfigFailed(true), []);
  const deployment = useDeployment(onConfigError, DEPLOYMENT_ERROR.institution);
  const ledger = useLedger(deployment, configFailed);
  const params = new URLSearchParams(location.search);
  // 이전 분쟁 조회 주소(/?sale=…, /?source=file)는 분쟁 조회로 보낸다.
  const legacy =
    location.pathname === "/" && (params.has("sale") || params.has("source"));
  const page =
    PAGES.find((entry) => entry.path === location.pathname) ?? PAGES[0];
  return (
    <Shell
      home="/"
      entryHref="/"
      groups={groups}
      area="감독기관"
      title={page.label}
      badge={{
        tone: deployment ? "success" : "warning",
        text: deployment
          ? deployment.chainId === 11155111
            ? "Sepolia 테스트넷"
            : "Anvil 테스트 원장"
          : "원장 설정 대기",
      }}
      error={error}
      dismissError={() => setError("")}
    >
      <Routes>
        <Route
          path="/"
          element={
            legacy ? (
              <Navigate to={`/disputes${location.search}`} replace />
            ) : (
              <Dashboard deployment={deployment} ledger={ledger} />
            )
          }
        />
        <Route
          path="/disputes"
          element={
            <Disputes
              deployment={deployment}
              ledger={ledger}
              search={location.search}
            />
          }
        />
        <Route path="/rules" element={<Rules ledger={ledger} />} />
        <Route path="/products" element={<Products ledger={ledger} />} />
        <Route path="/signals" element={<Signals ledger={ledger} />} />
        <Route
          path="/report"
          element={<Report deployment={deployment} ledger={ledger} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
