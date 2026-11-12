import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { ShieldCheck } from "lucide-react";
import { useDeployment } from "../../../packages/ui/src/deployment.ts";
import { Shell, type NavGroup } from "../../../packages/ui/src/Shell.tsx";
import { Independent } from "./screens/Independent.tsx";

/** 감독기관·외부 검증자가 쓰는 B2G 화면. 판매사 API 없이 RPC와 고객 파일로 대조할 수 있다. */
const groups: NavGroup[] = [
  {
    label: "감독·검증",
    items: [{ path: "/", label: "독립 검증", icon: ShieldCheck }],
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
      area="감독기관 · 외부 검증자"
      title="독립 검증"
      badge={{
        tone: deployment ? "success" : "warning",
        text: deployment
          ? deployment.chainId === 11155111
            ? "Sepolia 테스트넷"
            : "Anvil 테스트 원장"
          : "원장 설정 대기",
      }}
      foot={{
        title: "펀드 판매절차 공동 검증",
        text: "지정한 원장과 고객 파일로 판매 기록을 대조해요.",
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
