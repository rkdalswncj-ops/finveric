import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { ShieldCheck } from "lucide-react";
import { useDeployment } from "../../../../packages/ui/src/deployment.ts";
import { Shell, type NavGroup } from "../../../../packages/ui/src/Shell.tsx";
import { Independent } from "./screens/Independent.tsx";

/** 감독기관 화면(B2G). 판매사가 낸 서류나 고객 파일을 RPC로 원장과 대조한다. */
const groups: NavGroup[] = [
  {
    label: "감독기관",
    items: [{ path: "/", label: "분쟁 조회", icon: ShieldCheck }],
  },
];

export function App() {
  const location = useLocation();
  const [error, setError] = useState("");
  const deployment = useDeployment(setError);
  const params = new URLSearchParams(location.search);
  const saleId = params.get("sale") ?? "";
  const source = params.get("source") === "file" ? "file" : "history";
  return (
    <Shell
      home="/"
      groups={groups}
      area="감독기관"
      title="분쟁 조회"
      badge={{
        tone: deployment ? "success" : "warning",
        text: deployment
          ? deployment.chainId === 11155111
            ? "Sepolia 테스트넷"
            : "Anvil 테스트 원장"
          : "원장 설정 대기",
      }}
      foot={{
        title: "판매 기록 검증",
        text: "지정한 원장과 판매사 제출 서류, 고객 파일을 대조해요.",
      }}
      error={error}
      dismissError={() => setError("")}
    >
      <Routes>
        <Route
          path="/"
          element={
            <Independent
              key={`${source}:${saleId}`}
              deployment={deployment}
              initialId={saleId}
              source={source}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
