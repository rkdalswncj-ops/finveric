import { useState } from "react";
import { Plus } from "lucide-react";
import {
  PRODUCT_CARD_COUNT,
  PRODUCT_TYPES,
  RISK_GRADE_NAMES,
  productDocumentHash,
  productId,
  validateProduct,
  type ProductDocument,
  type ProductType,
  type RiskGrade,
} from "../../../../../packages/core/src/index.ts";
import type {
  ProductEntryDto,
  RegisterProductRequest,
  RuleEntryDto,
} from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import {
  Badge,
  ConfirmDialog,
  Facts,
  Heading,
  Notice,
  TableScroll,
} from "../../../../../packages/ui/src/components.tsx";
import { api, type LoadState } from "../../../../../packages/ui/src/api.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import client from "../client.module.css";
import local from "./operations.module.css";
import type { Run } from "../App.tsx";
import { ExplanationCards } from "../../../../../packages/ui/src/sale-components.tsx";
import {
  ProductFacts,
  ProfileProducts,
  RegisterNotice,
} from "../components.tsx";
import {
  activeRule,
  gradeName,
  latestProducts,
  productName,
} from "../../../../../packages/ui/src/sales.ts";

const s = { ...ui, ...client, ...local };
const GRADES = Object.keys(RISK_GRADE_NAMES).map(Number) as RiskGrade[];

const blankProduct = (seller: string): ProductDocument => ({
  format: "finveric-product-v5",
  code: "",
  version: 1,
  name: "",
  type: "ELS",
  issuer: "",
  seller,
  riskGrade: 3,
  complex: false,
  derivative: false,
  targetMarket: "",
  maxLoss: "",
  fee: "",
  summary: "",
  cards: Array.from({ length: PRODUCT_CARD_COUNT }, (_, index) => ({
    title: index === 0 ? "이런 분께는 맞지 않아요" : "",
    text: "",
  })),
});

/** 상품마다 등록 버전을 모은다. 최신 등록 버전을 먼저 고른다. */
function groupProducts(entries: ProductEntryDto[]) {
  const groups = new Map<string, ProductEntryDto[]>();
  for (const entry of entries) {
    const key = entry.product.id.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()].map((versions) => {
    versions.sort((a, b) => a.product.version - b.product.version);
    return {
      id: versions[0].product.id,
      versions,
      latest: versions.find((entry) => entry.latest) ?? versions.at(-1)!,
    };
  });
}

/** 상품 설명서 입력. 새 상품이나 기존 상품의 새 버전을 원장에 등록한다. */
function ProductForm({
  base,
  existing,
  busy,
  run,
  cancel,
  registered,
}: {
  base: ProductDocument;
  existing: ProductEntryDto[];
  busy: boolean;
  run: Run;
  cancel: () => void;
  registered: (id: string) => void;
}) {
  const newVersion = base.code !== "";
  const [doc, setDoc] = useState<ProductDocument>(() => structuredClone(base));
  // 처음 연 내용. 바뀐 것이 있을 때만 편집 취소를 묻는다.
  const [initial] = useState(() => JSON.stringify(base));
  const changed = JSON.stringify(doc) !== initial;
  const [confirmCancel, setConfirmCancel] = useState(false);
  // 빈 양식에 오류 목록을 바로 띄우지 않는다. 입력을 시작하거나 원장에 등록을 누르면 보여 준다.
  const [showErrors, setShowErrors] = useState(false);
  const edit = (change: (draft: ProductDocument) => void) => {
    setShowErrors(true);
    setDoc((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
  };
  const id = doc.code ? productId(doc.code) : undefined;
  const sameCode = existing.filter(
    (entry) => entry.registered && entry.product.id === id,
  );
  const version =
    Math.max(0, ...sameCode.map((entry) => entry.product.version)) + 1;
  const document = { ...doc, version };
  const errors = validateProduct(document);
  const text = (
    key: "name" | "issuer" | "seller" | "targetMarket" | "maxLoss" | "fee",
    label: string,
  ) => (
    <label className={s.field}>
      {label}
      <input
        value={doc[key]}
        maxLength={500}
        onChange={(e) =>
          edit((draft) => {
            draft[key] = e.target.value;
          })
        }
      />
    </label>
  );
  const submit = async () => {
    const entry = await run("상품 설명서를 원장에 등록하고 있습니다", () =>
      api<ProductEntryDto>("/products", {
        document,
      } satisfies RegisterProductRequest),
    );
    if (entry) registered(entry.product.id);
  };
  return (
    <div className={s.editorGrid}>
      <section className={`${s.panel} ${s.pad}`}>
        <div className={s.row}>
          <h2>
            {newVersion ? `${base.name} 새 버전 v${version}` : "새 상품 만들기"}
          </h2>
          <Button
            variant="ghost"
            blocked={busy}
            onClick={() => (changed ? setConfirmCancel(true) : cancel())}
          >
            편집 취소
          </Button>
        </div>
        <div className={s.editGrid}>
          <label className={s.field}>
            상품 코드
            <input
              value={doc.code}
              readOnly={newVersion}
              placeholder="예: ELS-DEMO-004"
              onChange={(e) =>
                edit((draft) => {
                  draft.code = e.target.value.toUpperCase();
                })
              }
            />
          </label>
          <label className={s.field}>
            상품 유형
            <select
              value={doc.type}
              onChange={(e) =>
                edit((draft) => {
                  draft.type = e.target.value as ProductType;
                })
              }
            >
              {PRODUCT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            위험등급
            <select
              value={doc.riskGrade}
              onChange={(e) =>
                edit((draft) => {
                  draft.riskGrade = Number(e.target.value) as RiskGrade;
                })
              }
            >
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {gradeName(grade)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!newVersion && sameCode.length > 0 && (
          <Notice>
            이미 등록한 상품 코드입니다. 이 상품의 새 버전 v{version}으로
            등록합니다.
          </Notice>
        )}
        {text("name", "상품명")}
        <div className={s.checks}>
          <label>
            <input
              type="checkbox"
              checked={doc.complex}
              onChange={(e) =>
                edit((draft) => {
                  draft.complex = e.target.checked;
                })
              }
            />
            고난도 금융투자상품
          </label>
          <label>
            <input
              type="checkbox"
              checked={doc.derivative}
              onChange={(e) =>
                edit((draft) => {
                  draft.derivative = e.target.checked;
                })
              }
            />
            파생결합증권
          </label>
        </div>
        <div className={s.editGrid}>
          {text("issuer", doc.type === "펀드" ? "운용사" : "발행사")}
          {text("seller", "판매사")}
        </div>
        {text("targetMarket", "판매대상 고객군")}
        <div className={s.editGrid}>
          {text("maxLoss", "최대 손실")}
          {text("fee", "수수료")}
        </div>
        <label className={s.field}>
          상품 요약
          <textarea
            rows={3}
            maxLength={500}
            value={doc.summary}
            onChange={(e) =>
              edit((draft) => {
                draft.summary = e.target.value;
              })
            }
          />
        </label>
        <h3 className={s.subTitle}>핵심 설명 카드 {PRODUCT_CARD_COUNT}장</h3>
        <p className={s.small}>
          고객은 가입 중에 카드를 차례로 봅니다. 첫 장에는 부적합 고객 유형과
          손실 사례를 씁니다.
        </p>
        {doc.cards.map((card, index) => (
          <fieldset key={index} className={s.questionEdit}>
            <legend>
              {index + 1}번 카드
              {index === 0 && " · 부적합 고객 유형과 손실 사례"}
            </legend>
            <label className={s.field}>
              제목
              <input
                value={card.title}
                maxLength={100}
                onChange={(e) =>
                  edit((draft) => {
                    draft.cards[index].title = e.target.value;
                  })
                }
              />
            </label>
            <label className={s.field}>
              내용
              <textarea
                rows={3}
                maxLength={1000}
                value={card.text}
                onChange={(e) =>
                  edit((draft) => {
                    draft.cards[index].text = e.target.value;
                  })
                }
              />
            </label>
          </fieldset>
        ))}
      </section>
      <aside className={s.editorAside}>
        <section className={`${s.panel} ${s.pad}`}>
          <h2>검사</h2>
          {!showErrors && errors.length ? (
            <Notice>
              입력하면 검사 결과를 여기에 보여 줍니다. 원장에 등록을 누르면 빠진
              항목을 모두 보여 줍니다.
            </Notice>
          ) : errors.length ? (
            <Notice tone="danger">
              <ul className={s.errorList}>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Notice>
          ) : (
            <Notice>검사를 통과했습니다. 원장에 등록할 수 있습니다.</Notice>
          )}
          <Facts
            rows={[
              ["버전", `v${version}`],
              ["상품 ID", <code>{id ?? "—"}</code>],
              [
                "설명서 지문",
                errors.length ? (
                  "검사 통과 뒤 계산"
                ) : (
                  <code>{productDocumentHash(document)}</code>
                ),
              ],
            ]}
          />
          <Button
            busy={busy}
            blocked={showErrors && errors.length > 0}
            onClick={() =>
              errors.length ? setShowErrors(true) : void submit()
            }
          >
            원장에 등록
          </Button>
          <p className={s.small}>
            원장은 설명서 원문으로 지문을 다시 계산합니다. 위험등급과
            고난도·파생 여부도 함께 기록합니다.
          </p>
        </section>
      </aside>
      <ConfirmDialog
        open={confirmCancel}
        title="편집한 내용을 버릴까요?"
        text="편집한 내용이 모두 사라집니다. 되돌릴 수 없습니다."
        confirmLabel="편집 내용 버리기"
        cancelLabel="계속 편집하기"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          cancel();
        }}
      />
    </div>
  );
}

/** 판매 상품과 설명서 버전 등록, 버전 이력, 투자성향별 권유 가능 상품. */
export function Products({
  load,
  rules,
  products,
  busy,
  run,
  register,
}: {
  load: LoadState;
  rules: RuleEntryDto[];
  products: ProductEntryDto[];
  busy: boolean;
  run: Run;
  register: () => unknown;
}) {
  const groups = groupProducts(products);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState<ProductDocument>();
  const group =
    groups.find((entry) => entry.id.toLowerCase() === selected.toLowerCase()) ??
    groups[0];
  const anyRegistered = products.some((entry) => entry.registered);
  const seller =
    products.find((entry) => entry.registered)?.product.document.seller ?? "";
  return (
    <>
      <Heading
        title="판매 상품을 관리하세요"
        description="상품 유형, 위험등급, 고난도·파생결합증권 여부, 판매대상 고객군, 설명서를 버전으로 등록합니다. 등록한 버전은 고칠 수 없습니다."
      >
        {!form && (
          <Button blocked={busy} onClick={() => setForm(blankProduct(seller))}>
            <Plus size={16} />새 상품 만들기
          </Button>
        )}
      </Heading>
      {load === "ready" && !anyRegistered && !activeRule(rules) && (
        <RegisterNotice busy={busy} register={register} />
      )}
      {form ? (
        <ProductForm
          base={form}
          existing={products}
          busy={busy}
          run={run}
          cancel={() => setForm(undefined)}
          registered={(id) => {
            setForm(undefined);
            setSelected(id);
          }}
        />
      ) : (
        <>
          <section className={s.panel}>
            <TableScroll label="판매 상품">
              <table>
                <caption className={s.tableCaption}>판매 상품</caption>
                <thead>
                  <tr>
                    <th scope="col">상품</th>
                    <th scope="col">유형</th>
                    <th scope="col">위험등급</th>
                    <th scope="col">속성</th>
                    <th scope="col">최신 버전</th>
                    <th scope="col">원장 등록</th>
                    <th scope="col">보기</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(({ id, latest, versions }) => {
                    const { document } = latest.product;
                    return (
                      <tr
                        key={id}
                        className={group?.id === id ? s.selectedRow : ""}
                      >
                        <td className={s.wrapCell}>
                          <strong>{productName(document)}</strong>
                        </td>
                        <td>{document.type}</td>
                        <td>{gradeName(document.riskGrade)}</td>
                        <td>
                          {[
                            document.complex && "고난도",
                            document.derivative && "파생결합증권",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td>
                          v{latest.product.version}
                          {versions.length > 1 &&
                            ` · ${versions.length}개 버전`}
                        </td>
                        <td>
                          <Badge
                            tone={latest.registered ? "success" : "warning"}
                          >
                            {latest.registered ? "등록" : "등록 전"}
                          </Badge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={s.linkButton}
                            onClick={() => setSelected(id)}
                            aria-label={`보기 · ${document.name}`}
                            aria-current={group?.id === id ? "true" : undefined}
                          >
                            보기
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            {groups.length === 0 ? (
              <p className={s.empty}>
                {load === "ready"
                  ? "등록한 상품이 없습니다."
                  : load === "failed"
                    ? "상품을 불러오지 못했습니다. 연결을 확인하고 화면을 새로 고치세요."
                    : "상품을 불러오고 있습니다."}
              </p>
            ) : (
              <p className={s.tableNote}>청약에는 최신 등록 버전을 씁니다.</p>
            )}
          </section>
          {group && (
            <div className={`${s.detailGrid} ${s.spaced}`}>
              <section className={`${s.panel} ${s.pad}`}>
                <div className={s.row}>
                  <h2>
                    {productName(group.latest.product.document)} v
                    {group.latest.product.version}
                  </h2>
                  <Badge tone={group.latest.registered ? "success" : "warning"}>
                    {group.latest.registered ? "원장 등록" : "등록 전"}
                  </Badge>
                </div>
                <p className={s.lead}>
                  {group.latest.product.document.summary}
                </p>
                <ProductFacts document={group.latest.product.document} />
                <h3 className={s.subTitle}>핵심 설명 카드</h3>
                <ExplanationCards cards={group.latest.product.document.cards} />
              </section>
              <aside className={`${s.panel} ${s.pad}`}>
                <h2>버전 이력</h2>
                <ul className={s.versionList}>
                  {[...group.versions].reverse().map((entry) => (
                    <li key={entry.product.version}>
                      <div>
                        <span>
                          <strong>v{entry.product.version}</strong>{" "}
                          {gradeName(entry.product.document.riskGrade)}
                        </span>
                        <small>
                          설명서 지문 <code>{entry.product.documentHash}</code>
                        </small>
                        <small>
                          등록 거래{" "}
                          {entry.txHash ? <code>{entry.txHash}</code> : "—"}
                        </small>
                        <Badge
                          tone={
                            entry.latest
                              ? "success"
                              : entry.registered
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {entry.latest
                            ? "판매 중"
                            : entry.registered
                              ? "이전 버전"
                              : "등록 전"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  blocked={busy || !group.latest.registered}
                  onClick={() =>
                    setForm(structuredClone(group.latest.product.document))
                  }
                >
                  새 버전 만들기
                </Button>
                <p className={s.small}>
                  새 버전을 등록하면 다음 청약부터 새 설명서를 씁니다. 청약한
                  판매 건은 그때의 버전으로 남습니다.
                </p>
              </aside>
            </div>
          )}
        </>
      )}
      <section className={`${s.panel} ${s.pad} ${s.spaced}`}>
        <h2>투자성향별 권유 가능 상품</h2>
        <p>
          적용 중인 진단 기준(v{activeRule(rules)?.version ?? "—"})의 적합성
          기준으로 나눕니다. 진단 기준 화면에서 기준을 바꿀 수 있습니다.
        </p>
        <ProfileProducts
          rule={activeRule(rules)?.document}
          products={latestProducts(products)}
        />
      </section>
    </>
  );
}
