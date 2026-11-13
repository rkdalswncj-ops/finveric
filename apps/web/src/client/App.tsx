import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BookOpen,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  Siren,
  Smartphone,
} from "lucide-react";
import type {
  ApiKeyDto,
  ConfigDto,
  CustomerDto,
  ProductEntryDto,
  RegisterDto,
  RuleEntryDto,
  SaleAction,
  SaleDto,
  TraceDto,
} from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import {
  api,
  ApiError,
  type LoadState,
} from "../../../../packages/ui/src/api.ts";
import {
  AccessCodeForm,
  Empty,
} from "../../../../packages/ui/src/components.tsx";
import {
  DEPLOYMENT_ERROR,
  useDeployment,
} from "../../../../packages/ui/src/deployment.ts";
import { networkName } from "../../../../packages/ui/src/format.ts";
import {
  API_DOCS_HREF,
  CHANNEL_APP_HREF,
} from "../../../../packages/ui/src/links.ts";
import type { Sale } from "../../../../packages/ui/src/sales.ts";
import {
  Shell,
  type ExternalItem,
  type NavGroup,
} from "../../../../packages/ui/src/Shell.tsx";
import { ApiKeys } from "./screens/ApiKeys.tsx";
import { Chain } from "./screens/Chain.tsx";
import { Dashboard } from "./screens/Dashboard.tsx";
import { Products } from "./screens/Products.tsx";
import { Review } from "./screens/Review.tsx";
import { Rules } from "./screens/Rules.tsx";
import { Signals } from "./screens/Signals.tsx";

const OPERATIONS = "판매사 업무";
/**
 * 판매사 소비자보호 담당이 쓰는 B2B 화면.
 * 고객 화면은 증권사 앱 예시(/channel/)에 있다. 새 탭으로 연다.
 */
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
      { path: "/keys", label: "API 키", icon: KeyRound },
    ],
  },
];
/** 사이드바 아래쪽의 새 탭 링크. */
const links: ExternalItem[] = [
  { href: CHANNEL_APP_HREF, label: "증권사 앱 예시", icon: Smartphone },
  { href: API_DOCS_HREF, label: "API 문서", icon: BookOpen },
];
function pageTitle(pathname: string) {
  for (const group of groups)
    for (const item of group.items)
      if (item.path === pathname) return item.label;
  return "대시보드";
}

/**
 * 이전 주소(/client/channel/*)를 증권사 앱 예시(/channel/*)로 보낸다. 쿼리를 그대로 넘긴다.
 * 공유한 링크와 이전 화면 캡처의 주소가 쓴다.
 */
function ChannelRedirect() {
  const { pathname, search, hash } = useLocation();
  const target = `/channel${pathname.slice("/channel".length) || "/"}${search}${hash}`;
  useEffect(() => {
    window.location.replace(target);
  }, [target]);
  return (
    <Empty
      title="증권사 앱 예시로 이동합니다"
      text="고객 화면은 증권사 앱 예시로 옮겼습니다."
    >
      <Button asChild>
        <a href={target}>증권사 앱 예시 열기</a>
      </Button>
    </Empty>
  );
}

/**
 * 화면이 부르는 처리. 실패하면 오류를 보여 주고 undefined를 돌려준다.
 * done을 주면 끝난 뒤 상태 줄에 넣어 화면 낭독기가 읽는다.
 */
export type Run = <T>(
  name: string,
  operation?: () => Promise<T>,
  done?: string,
) => Promise<T | undefined>;

/**
 * 화면에 보여 줄 오류. 닫기 버튼 없이 지운다: 다음 처리를 시작할 때, 경로가 바뀔 때.
 * 읽기 실패(`load`)는 다음 읽기가 성공해도 지운다. 처리 실패 뒤 바로 다시 읽는 것은 지우지 않는다.
 */
type Failure = { message: string; load?: boolean };

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<Failure>();
  const showError = useCallback(
    (message: string) => setFailure({ message }),
    [],
  );
  const deployment = useDeployment(showError, DEPLOYMENT_ERROR.institution);
  const [config, setConfig] = useState<ConfigDto>();
  const configRef = useRef<ConfigDto>(undefined);
  const [rules, setRules] = useState<RuleEntryDto[]>([]);
  const [products, setProducts] = useState<ProductEntryDto[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [traces, setTraces] = useState<TraceDto[]>([]);
  const [customer, setCustomer] = useState<CustomerDto>();
  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  const [selected, setSelected] = useState(
    sessionStorage.getItem("finveric-sale") ?? "",
  );
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  /** 서버가 접근 코드를 거절했을 때 입력 칸 아래에 보여 줄 문장. */
  const [accessError, setAccessError] = useState("");
  const noteAccess = (e: unknown) =>
    setAccessError(
      e instanceof ApiError && e.status === 401
        ? "접근 코드를 다시 확인하세요."
        : "",
    );

  const reload = useCallback(async () => {
    const current = configRef.current ?? (await api<ConfigDto>("/config"));
    if (!configRef.current) {
      configRef.current = current;
      setConfig(current);
    }
    const [newRules, newProducts, newSales, newTraces, newCustomer, newKeys] =
      await Promise.all([
        api<RuleEntryDto[]>("/rules"),
        api<ProductEntryDto[]>("/products"),
        api<SaleDto[]>("/sales"),
        api<TraceDto[]>("/traces"),
        api<CustomerDto>(
          `/customers/${encodeURIComponent(current.demoCustomer.number)}`,
        ),
        api<ApiKeyDto[]>("/keys"),
      ]);
    setRules(newRules);
    setProducts(newProducts);
    setSales(newSales);
    setTraces(newTraces);
    setCustomer(newCustomer);
    setApiKeys(newKeys);
    setLoad("ready");
    // 읽기에 성공하면 앞선 읽기 실패의 오류를 지운다. 처리 실패의 오류는 그대로 둔다.
    setFailure((current) => (current?.load ? undefined : current));
  }, []);
  /** 화면을 막지 않고 다시 읽는다. */
  const refresh = useCallback(() => reload().catch(() => undefined), [reload]);
  useEffect(() => {
    reload().catch((e: Error) => {
      setFailure({ message: e.message, load: true });
      noteAccess(e);
      // 처음 읽기에 실패하면 빈 표가 "불러오고 있습니다"에 머물지 않게 한다.
      setLoad((current) => (current === "loading" ? "failed" : current));
    });
  }, [reload]);
  // 고객은 다른 탭(증권사 앱 예시)에서 가입한다. 이 탭으로 돌아오면 판매 건을 다시 읽는다.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);
  // 오래 걸리는 처리(증명 생성, 거래 영수증) 중에도 처리 기록을 갱신한다.
  // 처리 기록만 읽는다. 전체를 2초마다 다시 읽으면 분당 180번이라 요청 한도(120번)를 넘는다.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () =>
        void api<TraceDto[]>("/traces")
          .then(setTraces)
          .catch(() => undefined),
      2000,
    );
    return () => clearInterval(timer);
  }, [busy]);
  // 화면을 옮기면 앞 화면의 오류를 지운다.
  const route = location.pathname + location.search;
  useEffect(() => {
    setFailure(undefined);
  }, [route]);

  const run: Run = async (name, operation, done) => {
    if (busy) return undefined;
    setBusy(name);
    setFailure(undefined);
    setNotice("");
    try {
      const result = await operation?.();
      await reload();
      setAccessError("");
      if (done) setNotice(done);
      return result;
    } catch (e) {
      setFailure({
        message:
          e instanceof Error
            ? e.message
            : "처리를 완료하지 못했습니다. 잠시 뒤 다시 시도하세요.",
      });
      noteAccess(e);
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
  const register = () =>
    run(
      "기본 진단 기준과 예시 상품을 원장에 등록하고 있습니다",
      () => api<RegisterDto>("/register", {}),
      "기본 진단 기준과 예시 상품을 원장에 등록했습니다.",
    );
  const action = (id: string, name: SaleAction, label: string, done?: string) =>
    run(label, () => api<SaleDto>(`/sales/${id}/action/${name}`, {}), done);

  return (
    <Shell
      home="/"
      entryHref="/"
      groups={groups}
      links={links}
      area={OPERATIONS}
      app="판매사 콘솔"
      title={pageTitle(location.pathname)}
      badge={{
        tone: deployment ? "success" : "warning",
        text: networkName(deployment),
      }}
      error={failure?.message}
      notice={notice}
      busy={busy}
    >
      {config?.requiresToken && (
        <AccessCodeForm
          connect={() => void run("연결하고 있습니다", reload, "연결했습니다.")}
          busy={!!busy}
          error={accessError}
        />
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              load={load}
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
              load={load}
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
              load={load}
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
              load={load}
              sales={sales}
              products={products}
              customer={customer}
              selected={selected}
              select={select}
              busy={!!busy}
              action={action}
            />
          }
        />
        <Route
          path="/signals"
          element={
            <Signals
              load={load}
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
              load={load}
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
          path="/keys"
          element={
            <ApiKeys keys={apiKeys} load={load} busy={!!busy} run={run} />
          }
        />
        <Route path="/channel/*" element={<ChannelRedirect />} />
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
