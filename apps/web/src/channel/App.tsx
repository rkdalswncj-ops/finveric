import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router";
import {
  LEDGER_ERRORS,
  type LedgerError,
} from "../../../../packages/core/src/index.ts";
import type {
  ConfigDto,
  CustomerDto,
  ExportKind,
  ExportResponse,
  OpenSaleRequest,
  ProductEntryDto,
  RuleEntryDto,
  SaleAction,
  SaleDto,
} from "../../../../packages/core/src/api.ts";
import { Button } from "../../../../packages/ui/src/button.tsx";
import {
  api,
  ApiError,
  saveFile,
  type LoadState,
} from "../../../../packages/ui/src/api.ts";
import {
  AccessCodeForm,
  Empty,
} from "../../../../packages/ui/src/components.tsx";
import { useDeployment } from "../../../../packages/ui/src/deployment.ts";
import { networkName } from "../../../../packages/ui/src/format.ts";
import {
  findProduct,
  latestProducts,
  type Sale,
} from "../../../../packages/ui/src/sales.ts";
import { Frame } from "./Frame.tsx";
import { channel, fundPath } from "./links.ts";
import { Catalog } from "./screens/Catalog.tsx";
import { CustomerVerify } from "./screens/CustomerVerify.tsx";
import { Enrollment } from "./screens/Enrollment.tsx";
import { ProductDetail } from "./screens/ProductDetail.tsx";
import { Records } from "./screens/Records.tsx";

/** 진행 중인 가입 신청 번호. 탭마다 따로 보관한다. */
const DRAFT_KEY = "finveric-draft";

/** 원장 거절 이유 중 고객에게 다르게 알리는 것. 나머지는 원장 오류 문구(LEDGER_ERRORS)를 그대로 쓴다. */
const CUSTOMER_REJECTIONS: Partial<Record<LedgerError, string>> = {
  TooEarly:
    "숙려기간이 아직 끝나지 않았어요. 남은 시간이 지나면 다시 눌러 주세요.",
};
const UNAVAILABLE =
  "지금은 처리하지 못했어요. 잠시 후 다시 시도해 주세요. 계속 안 되면 판매사에 문의해 주세요.";

/**
 * 오류를 고객에게 보여 줄 문장으로 바꾼다. API 응답의 `code`로 고른다.
 * 원장·거래·영수증 같은 말과 판매사 콘솔에서만 할 수 있는 안내를 고객에게 보이지 않는다.
 * `code`가 없는 업무 규칙 오류는 API 문장을 그대로 쓴다.
 */
function customerMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return error instanceof Error && /^[가-힣]/.test(error.message)
      ? error.message
      : UNAVAILABLE;
  switch (error.code) {
    case "offline":
      return "서버에 연결하지 못했어요. 연결을 확인하고 화면을 새로 고쳐 주세요.";
    case "pending":
      return "요청을 보냈어요. 처리를 확인하는 데 시간이 걸리고 있어요. 잠시 후 다시 시도해 주세요.";
    case "unavailable":
      return UNAVAILABLE;
    case "rejected":
      return error.ledgerError
        ? (CUSTOMER_REJECTIONS[error.ledgerError] ??
            LEDGER_ERRORS[error.ledgerError])
        : UNAVAILABLE;
    default:
      return error.message;
  }
}

/** 화면이 부르는 처리. 실패하면 오류를 보여 주고 undefined를 돌려준다. */
export type Run = <T>(
  name: string,
  operation?: () => Promise<T>,
) => Promise<T | undefined>;

/**
 * 증권사 앱 예시. 고객이 상품을 고르고, 가입하고, 받은 증명서로 기록을 확인한다.
 * 자료는 모두 FINVERIC API(packages/ui의 api())로 읽고 쓴다. 가입 기록 확인만 브라우저가 원장과 바로 대조한다.
 */
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
  const [customer, setCustomer] = useState<CustomerDto>();
  const [load, setLoad] = useState<LoadState>("loading");
  const [draftId, setDraftId] = useState(
    sessionStorage.getItem(DRAFT_KEY) ?? "",
  );
  const [busy, setBusy] = useState("");
  /** 서버가 접근 코드를 거절했을 때 입력 칸 아래에 보여 줄 문장. */
  const [accessError, setAccessError] = useState("");
  const params = new URLSearchParams(location.search);
  const noteAccess = (e: unknown) =>
    setAccessError(
      e instanceof ApiError && e.status === 401
        ? "접근 코드를 다시 확인해 주세요."
        : "",
    );

  const reload = useCallback(async () => {
    const current = configRef.current ?? (await api<ConfigDto>("/config"));
    if (!configRef.current) {
      configRef.current = current;
      setConfig(current);
    }
    const [newRules, newProducts, newSales, newCustomer] = await Promise.all([
      api<RuleEntryDto[]>("/rules"),
      api<ProductEntryDto[]>("/products"),
      api<SaleDto[]>("/sales"),
      api<CustomerDto>(
        `/customers/${encodeURIComponent(current.demoCustomer.number)}`,
      ),
    ]);
    setRules(newRules);
    setProducts(newProducts);
    setSales(newSales);
    setCustomer(newCustomer);
    setLoad("ready");
  }, []);
  /** 화면을 막지 않고 다시 읽는다. 승인 대기·숙려 화면이 쓴다. */
  const refresh = useCallback(() => reload().catch(() => undefined), [reload]);
  useEffect(() => {
    reload().catch((e: unknown) => {
      setError(customerMessage(e));
      noteAccess(e);
      // 처음 읽기에 실패하면 빈 화면이 "불러오고 있어요"에 머물지 않게 한다.
      setLoad((current) => (current === "loading" ? "failed" : current));
    });
  }, [reload]);
  // 관리자 승인은 판매사 콘솔(다른 탭)에서 한다. 이 탭으로 돌아오면 다시 읽는다.
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

  const run: Run = async (name, operation) => {
    if (busy) return undefined;
    setBusy(name);
    setError("");
    try {
      const result = await operation?.();
      await reload();
      setAccessError("");
      return result;
    } catch (e) {
      setError(customerMessage(e));
      noteAccess(e);
      await refresh();
      return undefined;
    } finally {
      setBusy("");
    }
  };
  const setDraft = (id: string) => {
    setDraftId(id);
    if (id) sessionStorage.setItem(DRAFT_KEY, id);
    else sessionStorage.removeItem(DRAFT_KEY);
  };
  const draft = sales.find((sale) => sale.id === draftId);
  const activeDraft =
    draft && (draft.status === "draft" || draft.status === "subscribed")
      ? draft
      : undefined;
  /**
   * 상품의 가입에 들어간다. 같은 상품의 가입이 진행 중이면 그 단계로 돌아간다.
   * 다른 상품의 청약 전 가입은 replace일 때만 중단한다(화면이 먼저 묻는다). 청약한 가입은 내 가입 기록에 남는다.
   */
  const start = (productId: string, replace = false) => {
    if (activeDraft?.productId.toLowerCase() === productId.toLowerCase())
      return navigate(channel.enroll);
    return run("가입 신청을 준비하고 있어요", async () => {
      if (activeDraft?.status === "draft") {
        if (!replace)
          throw new Error(
            "작성 중인 가입을 마치거나 중단한 뒤 새로 시작해 주세요.",
          );
        await api<SaleDto>(`/sales/${activeDraft.id}/action/abandon`, {});
      }
      if (!config) throw new Error("설정을 불러온 뒤 다시 시도해 주세요.");
      const sale = await api<SaleDto>("/sales", {
        productId: productId as `0x${string}`,
        customerNo: config.demoCustomer.number,
      } satisfies OpenSaleRequest);
      setDraft(sale.id);
      return sale;
    }).then((sale) => {
      // 새 판매 건을 다시 읽은 뒤에 옮긴다. 가입 화면이 "진행 중인 가입이 없어요"를 잠깐 보였다가 바뀌지 않는다.
      if (sale) navigate(channel.enroll);
    });
  };
  const action = (id: string, name: SaleAction, label: string) =>
    run(label, () => api<SaleDto>(`/sales/${id}/action/${name}`, {}));
  const abandon = () =>
    activeDraft?.status === "draft" &&
    run("가입을 중단하고 있어요", async () => {
      await api<SaleDto>(`/sales/${activeDraft.id}/action/abandon`, {});
      // 신청 번호는 가입 화면을 떠난 뒤 지운다(아래 효과). 먼저 지우면 가입 화면이 잠깐 "진행 중인 가입이 없어요"로 바뀐다.
      navigate(fundPath(activeDraft.productId));
    });
  // 중단한 가입의 신청 번호는 가입 화면 밖에서 지운다.
  useEffect(() => {
    if (draft?.status === "abandoned" && location.pathname !== channel.enroll) {
      setDraftId("");
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, [draft?.status, location.pathname]);
  /** 내 가입 기록에서 숙려 중인 청약을 가입 화면으로 다시 연다. */
  const resume = (id: string) => {
    setDraft(id);
    navigate(channel.enroll);
  };
  const download = (id: string, kind: ExportKind) =>
    run("파일을 준비하고 있어요", async () => {
      const value = await api<ExportResponse[ExportKind]>(
        `/sales/${id}/export/${kind}`,
      );
      saveFile(value, `finveric-${kind}-${id.slice(0, 10)}.json`);
    });

  // 머리글의 증권사 이름은 판매 중인 상품의 판매사다.
  const firm =
    latestProducts(products)[0]?.product.document.seller ??
    products[0]?.product.document.seller ??
    "증권사";
  const recordId = params.get("sale") ?? "";
  const header =
    location.pathname === channel.fund
      ? {
          title: "상품 상세",
          back: { to: channel.catalog, label: "상품 목록으로" },
        }
      : location.pathname === channel.records && recordId
        ? {
            title: "가입 기록",
            back: { to: channel.records, label: "가입 기록 목록으로" },
          }
        : {};
  return (
    <Frame
      firm={firm}
      {...header}
      network={{
        tone: deployment ? "success" : "warning",
        text: networkName(deployment),
      }}
      error={error}
      dismissError={() => setError("")}
    >
      {config?.requiresToken && (
        <AccessCodeForm
          connect={() => void run("연결하고 있어요", reload)}
          busy={!!busy}
          error={accessError}
          emptyMessage="접근 코드를 입력해 주세요."
        />
      )}
      <Routes>
        <Route
          path={channel.catalog}
          element={
            <Catalog
              load={load}
              products={products}
              activeDraft={activeDraft}
              busy={busy}
              start={start}
            />
          }
        />
        <Route
          path={channel.fund}
          element={
            <ProductDetail
              load={load}
              product={findProduct(products, params.get("product") ?? "")}
              products={products}
              activeDraft={activeDraft}
              busy={busy}
              start={start}
            />
          }
        />
        <Route
          path={channel.enroll}
          element={
            <Enrollment
              key={draft?.id ?? "empty"}
              load={load}
              sale={draft}
              rules={rules}
              products={products}
              customer={customer}
              deployment={config?.deployment}
              busy={busy}
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
              load={load}
              sales={sales}
              products={products}
              customer={customer}
              selected={recordId}
              busy={busy}
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
              title="화면을 찾을 수 없어요"
              text="아래 메뉴에서 화면을 다시 골라 주세요."
            >
              <Button asChild>
                <Link to={channel.catalog}>상품 보러 가기</Link>
              </Button>
            </Empty>
          }
        />
      </Routes>
    </Frame>
  );
}
