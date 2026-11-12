import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BadgeCheck,
  BriefcaseBusiness,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  ShieldCheck,
  Siren,
} from "lucide-react";
import type {
  ConfigDto,
  CustomerDto,
  ExportKind,
  ExportResponse,
  OpenSaleRequest,
  ProductEntryDto,
  RegisterDto,
  RuleEntryDto,
  SaleAction,
  SaleDto,
  TraceDto,
} from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import { api, saveFile } from "../../../../packages/ui/src/api.ts";
import { AccessCodeForm } from "../../../../packages/ui/src/components.tsx";
import { useDeployment } from "../../../../packages/ui/src/deployment.ts";
import { networkName } from "../../../../packages/ui/src/format.ts";
import { Shell, type NavGroup } from "../../../../packages/ui/src/Shell.tsx";
import { Empty } from "./components.tsx";
import { auditorUrl, channel, fundPath } from "./links.ts";
import { findProduct, type Sale } from "./sales.ts";
import { Catalog } from "./screens/Catalog.tsx";
import { Chain } from "./screens/Chain.tsx";
import { CustomerVerify } from "./screens/CustomerVerify.tsx";
import { Dashboard } from "./screens/Dashboard.tsx";
import { Enrollment } from "./screens/Enrollment.tsx";
import { ProductDetail } from "./screens/ProductDetail.tsx";
import { Products } from "./screens/Products.tsx";
import { Records } from "./screens/Records.tsx";
import { Review } from "./screens/Review.tsx";
import { Rules } from "./screens/Rules.tsx";
import { Signals } from "./screens/Signals.tsx";

const OPERATIONS = "판매사 업무";
const CHANNEL = "판매 채널 시연";
/** 판매사 소비자보호 담당이 쓰는 B2B 화면. 판매 채널 시연은 증권사 앱의 고객 화면이다. */
const groups: NavGroup[] = [
  {
    label: OPERATIONS,
    items: [
      { path: "/", label: "대시보드", icon: LayoutDashboard },
      { path: "/rules", label: "진단 기준", icon: ListChecks },
      { path: "/products", label: "상품 관리", icon: Landmark },
      { path: "/review", label: "판매·검토", icon: Layers },
      { path: "/signals", label: "위험 신호", icon: Siren },
      { path: "/chain", label: "온체인 처리", icon: Activity },
    ],
  },
  {
    label: CHANNEL,
    caption: "증권사 앱에서 고객이 보는 화면",
    items: [
      { path: channel.catalog, label: "상품 찾기", icon: LayoutGrid },
      { path: channel.enroll, label: "가입하기", icon: BriefcaseBusiness },
      { path: channel.records, label: "내 가입 기록", icon: FileText },
      { path: channel.verify, label: "가입 기록 확인", icon: BadgeCheck },
    ],
  },
  {
    label: "감독·검증",
    items: [{ href: auditorUrl(), label: "감독기관 화면", icon: ShieldCheck }],
  },
];
const isChannel = (pathname: string) =>
  pathname === channel.catalog || pathname.startsWith(`${channel.catalog}/`);
function pageTitle(pathname: string) {
  if (pathname === channel.fund) return "상품 상세";
  for (const group of groups)
    for (const item of group.items)
      if (item.path === pathname) return item.label;
  return "대시보드";
}

/** 화면이 부르는 처리. 실패하면 오류를 보여 주고 undefined를 돌려준다. */
export type Run = <T>(
  name: string,
  operation?: () => Promise<T>,
) => Promise<T | undefined>;

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const deployment = useDeployment(setError);
  const [config, setConfig] = useState<ConfigDto>();
  const configRef = useRef<ConfigDto>(undefined);
  const [rules, setRules] = useState<RuleEntryDto[]>([]);
  const [products, setProducts] = useState<ProductEntryDto[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [traces, setTraces] = useState<TraceDto[]>([]);
  const [customer, setCustomer] = useState<CustomerDto>();
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(
    sessionStorage.getItem("finveric-sale") ?? "",
  );
  const [draftId, setDraftId] = useState(
    sessionStorage.getItem("finveric-draft") ?? "",
  );
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams(location.search);

  const reload = useCallback(async () => {
    const current = configRef.current ?? (await api<ConfigDto>("/config"));
    if (!configRef.current) {
      configRef.current = current;
      setConfig(current);
    }
    const [newRules, newProducts, newSales, newTraces, newCustomer] =
      await Promise.all([
        api<RuleEntryDto[]>("/rules"),
        api<ProductEntryDto[]>("/products"),
        api<SaleDto[]>("/sales"),
        api<TraceDto[]>("/traces"),
        api<CustomerDto>(
          `/customers/${encodeURIComponent(current.demoCustomer.number)}`,
        ),
      ]);
    setRules(newRules);
    setProducts(newProducts);
    setSales(newSales);
    setTraces(newTraces);
    setCustomer(newCustomer);
    setLoaded(true);
  }, []);
  /** 화면을 막지 않고 다시 읽는다. 승인 대기·숙려 화면이 쓴다. */
  const refresh = useCallback(() => reload().catch(() => undefined), [reload]);
  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, [reload]);
  // 오래 걸리는 처리(증명 생성, 거래 영수증) 중에도 처리 기록을 갱신한다.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  const run: Run = async (name, operation) => {
    if (busy) return undefined;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      const result = await operation?.();
      await reload();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리를 완료하지 못했어요.");
      await refresh();
      return undefined;
    } finally {
      setBusy("");
    }
  };
  const select = (id: string) => {
    setSelected(id);
    sessionStorage.setItem("finveric-sale", id);
  };
  /** 대시보드·위험 신호에서 고른 판매 건을 판매·검토 화면에서 연다. */
  const open = (id: string) => {
    select(id);
    navigate("/review");
  };
  const setDraft = (id: string) => {
    setDraftId(id);
    if (id) sessionStorage.setItem("finveric-draft", id);
    else sessionStorage.removeItem("finveric-draft");
  };
  const register = () =>
    run("진단 기준과 시연 상품을 원장에 등록하고 있습니다", () =>
      api<RegisterDto>("/register", {}),
    );
  const draft = sales.find((sale) => sale.id === draftId);
  const activeDraft =
    draft && (draft.status === "draft" || draft.status === "subscribed")
      ? draft
      : undefined;
  const start = (productId: string) =>
    run("가입 신청을 준비하고 있어요", async () => {
      if (activeDraft) {
        if (activeDraft.productId.toLowerCase() !== productId.toLowerCase())
          throw new Error(
            "작성 중인 가입을 마치거나 중단한 뒤 새로 시작해 주세요.",
          );
      } else {
        if (!config) throw new Error("설정을 불러온 뒤 다시 시도해 주세요.");
        const sale = await api<SaleDto>("/sales", {
          productId: productId as `0x${string}`,
          customerNo: config.demoCustomer.number,
        } satisfies OpenSaleRequest);
        setDraft(sale.id);
      }
      navigate(channel.enroll);
    });
  const action = (id: string, name: SaleAction, label: string) =>
    run(label, () => api<SaleDto>(`/sales/${id}/action/${name}`, {}));
  const abandon = () =>
    activeDraft?.status === "draft" &&
    run("가입을 중단하고 있어요", async () => {
      await api<SaleDto>(`/sales/${activeDraft.id}/action/abandon`, {});
      setDraft("");
      navigate(fundPath(activeDraft.productId));
    });
  /** 내 가입 기록에서 숙려 중인 청약을 가입하기 화면으로 다시 연다. */
  const resume = (id: string) => {
    setDraft(id);
    navigate(channel.enroll);
  };
  const download = (id: string, kind: ExportKind, modified = false) =>
    run("파일을 준비하고 있어요", async () => {
      const value = await api<ExportResponse[ExportKind]>(
        `/sales/${id}/export/${kind}`,
      );
      // 변경 탐지 시연: 원본 사본에서 답변 하나를 다른 선택지로 바꾼다.
      if (modified && "attempts" in value) {
        const attempt = value.attempts.at(-1);
        const rule = rules.find(
          (entry) =>
            entry.hash.toLowerCase() === attempt?.ruleHash.toLowerCase(),
        );
        if (attempt) {
          const q = Math.max(
            0,
            attempt.answers.findIndex(
              (_, index) =>
                (rule?.document.questions[index]?.choices.length ?? 2) > 1,
            ),
          );
          const count = rule?.document.questions[q]?.choices.length ?? 2;
          attempt.answers[q] = (attempt.answers[q] + 1) % count;
        }
      }
      saveFile(
        value,
        `finveric-${modified ? "modified" : kind}-${id.slice(0, 10)}.json`,
      );
    });

  const channelPage = isChannel(location.pathname);
  const requestedProduct = params.get("product") ?? "";
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
            : networkName(deployment)
          : "원장 설정 대기",
      }}
      foot={{
        title: "판매 기록 검증",
        text: "테스트용 상품과 가상 고객으로 판매 절차를 시연해요.",
      }}
      error={error}
      dismissError={() => setError("")}
      notice={notice}
      busy={busy}
    >
      {config?.requiresToken && (
        <AccessCodeForm
          connect={() => void run("접속 중", reload)}
          busy={!!busy}
        />
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              loaded={loaded}
              rules={rules}
              products={products}
              sales={sales}
              customer={customer}
              busy={!!busy}
              register={register}
              open={open}
            />
          }
        />
        <Route
          path="/rules"
          element={
            <Rules
              loaded={loaded}
              rules={rules}
              products={products}
              busy={!!busy}
              run={run}
              register={register}
            />
          }
        />
        <Route
          path="/products"
          element={
            <Products
              loaded={loaded}
              rules={rules}
              products={products}
              busy={!!busy}
              run={run}
              register={register}
            />
          }
        />
        <Route
          path="/review"
          element={
            <Review
              loaded={loaded}
              sales={sales}
              products={products}
              customer={customer}
              selected={selected}
              select={select}
              busy={!!busy}
              run={run}
              action={action}
            />
          }
        />
        <Route
          path="/signals"
          element={
            <Signals
              sales={sales}
              products={products}
              customer={customer}
              open={open}
            />
          }
        />
        <Route
          path="/chain"
          element={
            <Chain
              traces={traces}
              sales={sales}
              products={products}
              deployment={config?.deployment}
              busy={!!busy}
              refresh={() => run("처리 기록을 다시 읽고 있습니다", reload)}
            />
          }
        />
        <Route
          path={channel.catalog}
          element={<Catalog loaded={loaded} products={products} />}
        />
        <Route
          path={channel.fund}
          element={
            <ProductDetail
              loaded={loaded}
              product={findProduct(products, requestedProduct)}
              products={products}
              activeDraft={activeDraft}
              busy={!!busy}
              start={start}
            />
          }
        />
        <Route
          path={channel.enroll}
          element={
            <Enrollment
              key={draft?.id ?? "empty"}
              loaded={loaded}
              sale={draft}
              rules={rules}
              products={products}
              customer={customer}
              deployment={config?.deployment}
              busy={!!busy}
              run={run}
              action={action}
              abandon={abandon}
              refresh={refresh}
              download={download}
              finish={() => setDraft("")}
            />
          }
        />
        <Route
          path={channel.records}
          element={
            <Records
              loaded={loaded}
              sales={sales}
              products={products}
              customer={customer}
              selected={selected}
              select={select}
              busy={!!busy}
              download={download}
              resume={resume}
            />
          }
        />
        <Route
          path={channel.verify}
          element={
            <CustomerVerify
              key={params.get("sale") ?? ""}
              deployment={deployment}
              initialId={params.get("sale") ?? ""}
            />
          }
        />
        <Route
          path="*"
          element={
            <Empty
              title="화면을 찾을 수 없습니다"
              text="메뉴에서 화면을 다시 골라 주세요."
            >
              <Button asChild>
                <Link to="/">대시보드로 가기</Link>
              </Button>
            </Empty>
          }
        />
      </Routes>
    </Shell>
  );
}
