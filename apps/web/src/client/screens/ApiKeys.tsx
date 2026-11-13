import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import {
  MAX_ACTIVE_API_KEYS,
  type ApiKeyDto,
  type IssueApiKeyRequest,
  type IssuedApiKeyDto,
} from "@finveric/core/api";
import { Button } from "../../shared/button.tsx";
import { api, type LoadState } from "../../shared/api.ts";
import {
  Badge,
  ConfirmDialog,
  FieldError,
  Heading,
  TableScroll,
} from "../../shared/components.tsx";
import { focusElement } from "../../shared/focus.ts";
import { dateTime } from "../../shared/format.ts";
import { API_DOCS_HREF } from "../../shared/links.ts";
import ui from "../../shared/ui.module.css";
import local from "./keys.module.css";
import type { Run } from "../App.tsx";

const s = { ...ui, ...local };

/**
 * 증권사 앱 서버가 `판매 채널 연동` API를 부를 때 쓰는 키를 발급하고 폐기한다.
 * 키 원문은 발급 응답에만 있다. 이 화면을 떠나면 다시 볼 수 없다.
 * 누른 버튼이 사라지면(폐기, 저장했습니다) 초점을 그 구역의 제목으로 옮긴다.
 */
export function ApiKeys({
  keys,
  load,
  busy,
  run,
}: {
  keys: ApiKeyDto[];
  load: LoadState;
  busy: boolean;
  run: Run;
}) {
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<IssuedApiKeyDto>();
  const [copy, setCopy] = useState<"" | "done" | "failed">("");
  /** 폐기를 묻는 키. 확인 창이 열려 있다. */
  const [revoking, setRevoking] = useState<ApiKeyDto>();
  /** 발급 버튼이 처리 중인지. 다른 처리(폐기) 중에는 발급 버튼을 막기만 한다. */
  const [issuing, setIssuing] = useState(false);
  /** 이름 없이 발급을 눌렀다. 입력 칸 아래에 이유를 보여 준다. */
  const [nameMissing, setNameMissing] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const active = keys.filter((key) => !key.revokedAt).length;
  const full = active >= MAX_ACTIVE_API_KEYS;
  // 새 키를 발급하면 키 원문을 보여 주는 구역으로 초점을 옮긴다.
  useEffect(() => {
    if (issued) focusElement("issued-key-title");
  }, [issued]);

  const issue = async () => {
    if (!name.trim()) {
      setNameMissing(true);
      nameInput.current?.focus();
      return;
    }
    setIssuing(true);
    const created = await run(
      "API 키를 발급하고 있습니다",
      () =>
        api<IssuedApiKeyDto>("/keys", {
          name: name.trim(),
        } satisfies IssueApiKeyRequest),
      "API 키를 발급했습니다. 이 화면을 떠나면 다시 볼 수 없습니다.",
    );
    setIssuing(false);
    if (!created) return;
    setIssued(created);
    setCopy("");
    setName("");
  };
  const revoke = async (key: ApiKeyDto) => {
    const revoked = await run(
      `${key.name} 키를 폐기하고 있습니다`,
      () => api<ApiKeyDto>(`/keys/${key.id}/revoke`, {}),
      `${key.name} 키를 폐기했습니다.`,
    );
    if (issued?.id === key.id) setIssued(undefined);
    // 폐기한 행의 버튼이 사라진다. 초점은 키 목록 제목으로 옮긴다.
    if (revoked) focusElement("key-list-title");
  };
  const copyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopy("done");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <>
      <Heading
        title="API 키"
        description="증권사 앱 서버가 판매 채널 연동 API를 부를 때 쓰는 키입니다. 키는 서버에만 두고 고객 앱이나 브라우저에 넣지 마세요."
      >
        <Button variant="outline" asChild>
          <a href={API_DOCS_HREF} target="_blank" rel="noreferrer">
            API 문서
            <span className={s.srOnly}> (새 탭에서 열기)</span>
            <ExternalLink size={14} aria-hidden="true" data-icon="end" />
          </a>
        </Button>
      </Heading>
      <div className={s.stack}>
        {issued && (
          <section
            className={`${s.panel} ${s.pad} ${s.secret}`}
            aria-labelledby="issued-key-title"
          >
            <h2 id="issued-key-title" tabIndex={-1}>
              <KeyRound size={18} aria-hidden />
              {issued.name} 키를 발급했습니다
            </h2>
            <p>
              지금 복사해 증권사 앱 서버에 저장하세요. 이 화면을 떠나면 키를
              다시 볼 수 없습니다. 요청 헤더에{" "}
              <code>Authorization: Bearer 키</code>를 넣습니다.
            </p>
            <div className={s.secretValue}>
              <code>{issued.key}</code>
              <Button
                variant="outline"
                onClick={() => void copyKey(issued.key)}
              >
                {copy === "done" ? <Check size={16} /> : <Copy size={16} />}
                {copy === "done" ? "복사했습니다" : "복사"}
              </Button>
            </div>
            <p role="status" className={s.small}>
              {copy === "failed"
                ? "복사하지 못했습니다. 키를 직접 선택해 복사하세요."
                : ""}
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setIssued(undefined);
                focusElement("issue-key-title");
              }}
            >
              저장했습니다
            </Button>
          </section>
        )}

        <section
          className={`${s.panel} ${s.pad}`}
          aria-labelledby="issue-key-title"
        >
          <h2 id="issue-key-title" tabIndex={-1}>
            새 키 발급
          </h2>
          <form
            className={s.issueForm}
            onSubmit={(event) => {
              event.preventDefault();
              void issue();
            }}
          >
            <label className={s.field}>
              키 이름
              <input
                ref={nameInput}
                value={name}
                maxLength={40}
                placeholder="예: 증권사 앱 운영 서버"
                onChange={(event) => {
                  setName(event.target.value);
                  setNameMissing(false);
                }}
                aria-invalid={nameMissing ? true : undefined}
                aria-describedby="issue-key-error issue-key-help"
              />
            </label>
            {/* 키가 가득 차면 정말 쓸 수 없다(disabled). 처리 중은 초점을 지키도록 aria-disabled다. 빈 이름은 누르면 알려 준다. */}
            <Button
              type="submit"
              disabled={full}
              busy={issuing}
              blocked={busy && !issuing}
            >
              발급하기
            </Button>
          </form>
          <FieldError id="issue-key-error">
            {nameMissing ? "키 이름을 쓰세요." : ""}
          </FieldError>
          <p id="issue-key-help" className={s.small}>
            {full
              ? `사용 중인 키가 ${MAX_ACTIVE_API_KEYS}개입니다. 쓰지 않는 키를 폐기한 뒤 발급하세요.`
              : `사용 중인 키 ${active}개 · 최대 ${MAX_ACTIVE_API_KEYS}개. 키를 쓰는 서버마다 따로 발급하면 하나만 폐기할 수 있습니다.`}
          </p>
        </section>

        <section className={s.panel} aria-labelledby="key-list-title">
          <h2 id="key-list-title" tabIndex={-1} className={s.listTitle}>
            발급한 키
          </h2>
          {load === "loading" ? (
            <p className={s.tableNote}>키 목록을 불러오고 있습니다.</p>
          ) : load === "failed" && !keys.length ? (
            <p className={s.tableNote}>
              키 목록을 불러오지 못했습니다. 연결을 확인하고 화면을 새로
              고치세요.
            </p>
          ) : keys.length ? (
            <TableScroll label="API 키 목록">
              <table>
                <caption className={s.srOnly}>API 키 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">키</th>
                    <th scope="col">범위</th>
                    <th scope="col">만든 시각</th>
                    <th scope="col">마지막 사용</th>
                    <th scope="col">상태</th>
                    <th scope="col">
                      <span className={s.srOnly}>동작</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id}>
                      <td>{key.name}</td>
                      <td>
                        <code>{key.prefix}…</code>
                      </td>
                      <td>판매 채널 연동</td>
                      <td>{dateTime(key.createdAt)}</td>
                      <td>{dateTime(key.lastUsedAt)}</td>
                      <td>
                        {key.revokedAt ? (
                          <span className={s.revoked}>
                            <Badge>폐기</Badge>
                            {dateTime(key.revokedAt)}
                          </span>
                        ) : (
                          <Badge tone="success">사용 중</Badge>
                        )}
                      </td>
                      <td className={s.rowAction}>
                        {key.revokedAt ? null : (
                          <Button
                            variant="outline"
                            blocked={busy}
                            onClick={() => setRevoking(key)}
                            aria-label={`${key.name} 키 폐기`}
                          >
                            폐기
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : (
            <p className={s.tableNote}>
              아직 발급한 키가 없습니다. 위에서 키를 발급하세요.
            </p>
          )}
        </section>
      </div>
      {/* 되돌릴 수 없는 동작이다. 안전한 선택(취소)이 주요 버튼이고 처음 초점을 받는다. */}
      <ConfirmDialog
        open={!!revoking}
        title="API 키를 폐기할까요?"
        text={`${revoking?.name ?? ""} 키로 보낸 요청이 바로 거절됩니다. 되돌릴 수 없습니다.`}
        confirmLabel="폐기하기"
        cancelLabel="취소"
        onCancel={() => setRevoking(undefined)}
        onConfirm={() => {
          const key = revoking;
          setRevoking(undefined);
          if (key) void revoke(key);
        }}
      />
    </>
  );
}
