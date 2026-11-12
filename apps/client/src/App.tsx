import { useCallback, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  Activity,
  BriefcaseBusiness,
  FileText,
  Landmark,
  Layers,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";
import { PRODUCTS, type Product } from "../../../packages/core/src/index.ts";
import type {
  AbandonResponse,
  ConfigDto,
  ExportKind,
  ExportResponse,
  OpenSaleRequest,
  OpenSaleResponse,
  RegisterResponse,
  SaleAction,
  SaleActionDto,
  TraceDto,
} from "../../../packages/core/src/api.ts";
import { Button } from "../../../packages/ui/src/button.tsx";
import { api, saveFile } from "../../../packages/ui/src/api.ts";
import { AccessCodeForm } from "../../../packages/ui/src/components.tsx";
import { useDeployment } from "../../../packages/ui/src/deployment.ts";
import { Shell, type NavGroup } from "../../../packages/ui/src/Shell.tsx";
import {
  getProduct,
  saleProduct,
  type Sale,
} from "../../../packages/ui/src/sale.ts";
import { Empty } from "./components.tsx";
import { auditorUrl, channel, draftProofKey, fundPath } from "./links.ts";
import { Catalog } from "./screens/Catalog.tsx";
import { Chain } from "./screens/Chain.tsx";
import { Enrollment } from "./screens/Enrollment.tsx";
import { FundDetail } from "./screens/FundDetail.tsx";
import { Manage } from "./screens/Manage.tsx";
import { Records } from "./screens/Records.tsx";
import { Review } from "./screens/Review.tsx";

const OPERATIONS = "기관 업무";
const CHANNEL = "판매 채널 시연";
/** 운용사·증권사·준법 담당자가 쓰는 B2B 화면. 판매 채널 시연은 증권사 앱의 고객 화면이다. */
const groups: NavGroup[] = [
  {
    label: OPERATIONS,
    items: [
      { path: "/", label: "상품·문서 관리", icon: Landmark },
      { path: "/review", label: "판매·검토 현황", icon: Layers },
      { path: "/chain", label: "온체인 처리", icon: Activity },
    ],
  },
  {
    label: CHANNEL,
    caption: "증권사 앱에서 고객이 보는 화면",
    items: [
      { path: channel.catalog, label: "펀드 찾기", icon: LayoutGrid },
      { path: channel.enroll, label: "가입하기", icon: BriefcaseBusiness },
      { path: channel.records, label: "내 가입 기록", icon: FileText },
    ],
  },
  {
    label: "감독·검증",
    items: [{ href: auditorUrl(), label: "독립 검증", icon: ShieldCheck }],
  },
];
const isChannel = (pathname: string) =>
  pathname === channel.catalog || pathname.startsWith(`${channel.catalog}/`);
function pageTitle(pathname: string) {
  if (pathname === channel.fund) return "펀드 찾기";
  for (const group of groups)
    for (const item of group.items)
      if (item.path === pathname) return item.label;
  return "상품·문서 관리";
}
/** 이전 단일 웹의 독립 검증 주소(/verify)는 auditor 앱으로 보낸다. */
function LegacyVerify() {
  const { search } = useLocation();
  useEffect(() => {
    window.location.replace(auditorUrl(search));
  }, [search]);
  return null;
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const deployment = useDeployment(setError);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesReady, setSalesReady] = useState(false);
  const [traces, setTraces] = useState<TraceDto[]>([]);
  const [selected, setSelected] = useState(
    sessionStorage.getItem("finveric-sale") ?? "",
  );
  const [draftId, setDraftId] = useState(
    sessionStorage.getItem("finveric-draft") ?? "",
  );
  const [recordsProduct, setRecordsProduct] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [tokenRequired, setTokenRequired] = useState(false);
  const sale = sales.find((s) => s.id === selected) ?? sales[0];
  const draft = sales.find((s) => s.id === draftId);
  const activeDraft = draft && !draft.state.finalized ? draft : undefined;
  const records = sales.filter(
    (s) =>
      s.state.finalized &&
      (!recordsProduct || saleProduct(s)?.id === recordsProduct),
  );
  const record = records.find((s) => s.id === selected) ?? records[0];
  const requestedProduct = new URLSearchParams(location.search).get("product");
  const detailProduct =
    requestedProduct === null ? PRODUCTS[0] : getProduct(requestedProduct);
  const reload = useCallback(async () => {
    const [newSales, newTraces] = await Promise.all([
      api<Sale[]>("/sales"),
      api<TraceDto[]>("/traces"),
    ]);
    setSales(newSales);
    setTraces(newTraces);
    setSalesReady(true);
  }, []);
  useEffect(() => {
    api<ConfigDto>("/config")
      .then((c) => {
        setTokenRequired(c.requiresToken);
        return reload();
      })
      .catch((e) => setError(e.message));
  }, [reload]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void reload().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [busy, reload]);
  const run = async (name: string, operation?: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await operation?.();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리를 완료하지 못했어요.");
    } finally {
      setBusy("");
    }
  };
  const select = (id: string) => {
    setSelected(id);
    sessionStorage.setItem("finveric-sale", id);
  };
  const start = (product: Product) =>
    run("가입 초안을 준비하고 있어요", async () => {
      if (activeDraft) {
        if (saleProduct(activeDraft)?.id !== product.id)
          throw new Error(
            "작성 중인 가입을 완료하거나 중단한 뒤 새로 시작해 주세요.",
          );
        navigate(channel.enroll);
        return;
      }
      const result = await api<OpenSaleResponse>("/sales", {
        productId: product.id,
      } satisfies OpenSaleRequest);
      setDraftId(result.id);
      sessionStorage.setItem("finveric-draft", result.id);
      navigate(channel.enroll);
    });
  const abandon = () =>
    draft &&
    !draft.state.finalized &&
    !draft.submissionPending &&
    run("가입을 중단하고 있어요", async () => {
      const product = saleProduct(draft);
      await api<AbandonResponse>(`/sales/${draft.id}/action/abandon`, {});
      sessionStorage.removeItem("finveric-draft");
      sessionStorage.removeItem(draftProofKey(draft.id));
      setDraftId("");
      navigate(product ? fundPath(product) : channel.catalog);
    });
  const markEnrolled = (id: string) => {
    sessionStorage.removeItem("finveric-draft");
    sessionStorage.removeItem(draftProofKey(id));
    setRecordsProduct(saleProduct(draft)?.id ?? "");
    select(id);
  };
  const action = (name: SaleAction) =>
    sale &&
    run("가입 상태 업데이트 중", () =>
      api<SaleActionDto>(`/sales/${sale.id}/action/${name}`, {}),
    );
  const download = (kind: ExportKind, modified = false) =>
    record &&
    run("파일 준비 중", async () => {
      const value = await api<ExportResponse[ExportKind]>(
        `/sales/${record.id}/export/${kind}`,
      );
      // 변경 탐지 시연: 원본 사본의 첫 답변만 바꾼다.
      if (modified && "attempts" in value && value.attempts.length)
        value.attempts[0].answers.loss =
          (value.attempts[0].answers.loss + 1) % 3;
      saveFile(
        value,
        `finveric-${modified ? "modified" : kind}-${record.id.slice(0, 10)}.json`,
      );
    });
  const channelPage = isChannel(location.pathname);
  return (
    <Shell
      home="/"
      groups={groups}
      area={channelPage ? `${CHANNEL} · 증권사 앱 화면` : OPERATIONS}
      title={pageTitle(location.pathname)}
      badge={{
        tone: deployment ? "success" : "warning",
        text: deployment
          ? channelPage
            ? "테스트 환경"
            : deployment.chainId === 11155111
              ? "Sepolia 테스트넷"
              : "Anvil 테스트 원장"
          : "원장 설정 대기",
      }}
      foot={{
        title: "펀드 판매절차 공동 검증",
        text: "테스트용 상품과 가입 절차를 제공해요.",
      }}
      error={error}
      dismissError={() => setError("")}
      notice={notice}
      busy={busy}
    >
      {tokenRequired && (
        <AccessCodeForm connect={() => void run("접속 중")} busy={!!busy} />
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Manage
              deployment={deployment}
              traces={traces}
              busy={!!busy}
              register={() =>
                run("상품·규칙 등록 중", () =>
                  api<RegisterResponse>("/register", {}),
                )
              }
            />
          }
        />
        <Route
          path="/review"
          element={
            <Review
              sales={sales}
              sale={sale}
              select={select}
              action={action}
              busy={!!busy}
            />
          }
        />
        <Route
          path="/chain"
          element={
            <Chain
              traces={traces}
              sale={sale}
              action={action}
              busy={!!busy}
              refresh={() => run("원장 조회 중", reload)}
              deployment={deployment}
            />
          }
        />
        <Route path={channel.catalog} element={<Catalog />} />
        <Route
          path={channel.fund}
          element={
            <FundDetail
              product={detailProduct}
              start={start}
              busy={!!busy || (!!draftId && !salesReady)}
              activeDraft={activeDraft}
            />
          }
        />
        <Route
          path={channel.enroll}
          element={
            <Enrollment
              key={draft?.id ?? "empty"}
              sale={draft}
              deployment={deployment}
              busy={!!busy}
              run={run}
              abandon={abandon}
              markEnrolled={markEnrolled}
            />
          }
        />
        <Route
          path={channel.records}
          element={
            <Records
              sale={record}
              sales={records}
              productFilter={recordsProduct}
              filterProducts={setRecordsProduct}
              select={select}
              download={download}
              busy={!!busy}
            />
          }
        />
        <Route path="/manage" element={<Navigate to="/" replace />} />
        <Route
          path="/fund"
          element={
            <Navigate
              to={{ pathname: channel.fund, search: location.search }}
              replace
            />
          }
        />
        <Route
          path="/enroll"
          element={<Navigate to={channel.enroll} replace />}
        />
        <Route
          path="/records"
          element={<Navigate to={channel.records} replace />}
        />
        <Route path="/verify" element={<LegacyVerify />} />
        <Route
          path="*"
          element={
            <Empty>
              <Button asChild>
                <Link to="/">처음 화면으로</Link>
              </Button>
            </Empty>
          }
        />
      </Routes>
    </Shell>
  );
}
