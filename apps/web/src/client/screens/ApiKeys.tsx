import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import {
  MAX_ACTIVE_API_KEYS,
  type ApiKeyDto,
  type IssueApiKeyRequest,
  type IssuedApiKeyDto,
} from "../../../../../packages/core/src/api.ts";
import { Button } from "../../../../../packages/ui/src/button.tsx";
import { api } from "../../../../../packages/ui/src/api.ts";
import { Badge, Heading } from "../../../../../packages/ui/src/components.tsx";
import { dateTime } from "../../../../../packages/ui/src/format.ts";
import { API_DOCS_HREF } from "../../../../../packages/ui/src/links.ts";
import ui from "../../../../../packages/ui/src/ui.module.css";
import local from "./keys.module.css";
import type { Run } from "../App.tsx";

const s = { ...ui, ...local };

/**
 * 증권사 앱 서버가 `판매 채널 연동` API를 부를 때 쓰는 키를 발급하고 폐기한다.
 * 키 원문은 발급 응답에만 있다. 이 화면을 떠나면 다시 볼 수 없다.
 */
export function ApiKeys({
  keys,
  loaded,
  busy,
  run,
}: {
  keys: ApiKeyDto[];
  loaded: boolean;
  busy: boolean;
  run: Run;
}) {
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<IssuedApiKeyDto>();
  const [copy, setCopy] = useState<"" | "done" | "failed">("");
  const [revoking, setRevoking] = useState("");
  const active = keys.filter((key) => !key.revokedAt).length;
  const full = active >= MAX_ACTIVE_API_KEYS;

  const issue = async () => {
    const created = await run("API 키를 발급하고 있습니다", () =>
      api<IssuedApiKeyDto>("/keys", {
        name: name.trim(),
      } satisfies IssueApiKeyRequest),
    );
    if (!created) return;
    setIssued(created);
    setCopy("");
    setName("");
  };
  const revoke = async (key: ApiKeyDto) => {
    setRevoking("");
    await run(`${key.name} 키를 폐기하고 있습니다`, () =>
      api<ApiKeyDto>(`/keys/${key.id}/revoke`, {}),
    );
    if (issued?.id === key.id) setIssued(undefined);
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
            <ExternalLink size={14} aria-label="새 탭에서 열기" />
          </a>
        </Button>
      </Heading>
      <div className={s.stack}>
        {issued && (
          <section
            className={`${s.panel} ${s.pad} ${s.secret}`}
            aria-labelledby="issued-key-title"
          >
            <h2 id="issued-key-title">
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
            <Button variant="ghost" onClick={() => setIssued(undefined)}>
              저장했습니다
            </Button>
          </section>
        )}

        <section
          className={`${s.panel} ${s.pad}`}
          aria-labelledby="issue-key-title"
        >
          <h2 id="issue-key-title">새 키 발급</h2>
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
                value={name}
                maxLength={40}
                placeholder="예: 증권사 앱 운영 서버"
                onChange={(event) => setName(event.target.value)}
                aria-describedby="issue-key-help"
              />
            </label>
            <Button type="submit" disabled={busy || full || !name.trim()}>
              발급하기
            </Button>
          </form>
          <p id="issue-key-help" className={s.small}>
            {full
              ? `사용 중인 키가 ${MAX_ACTIVE_API_KEYS}개입니다. 쓰지 않는 키를 폐기한 뒤 발급하세요.`
              : `사용 중인 키 ${active}개 · 최대 ${MAX_ACTIVE_API_KEYS}개. 키를 쓰는 서버마다 따로 발급하면 하나만 폐기할 수 있습니다.`}
          </p>
        </section>

        <section className={s.panel} aria-labelledby="key-list-title">
          <h2 id="key-list-title" className={s.listTitle}>
            발급한 키
          </h2>
          {!loaded ? (
            <p className={s.tableNote}>키 목록을 불러오고 있습니다.</p>
          ) : keys.length ? (
            <div className={s.tableWrap}>
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
                          <Badge>폐기 · {dateTime(key.revokedAt)}</Badge>
                        ) : (
                          <Badge tone="success">사용 중</Badge>
                        )}
                      </td>
                      <td className={s.rowAction}>
                        {key.revokedAt ? null : revoking === key.id ? (
                          <span className={s.confirm}>
                            <Button
                              disabled={busy}
                              onClick={() => void revoke(key)}
                            >
                              폐기하기
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setRevoking("")}
                            >
                              취소
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setRevoking(key.id)}
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
            </div>
          ) : (
            <p className={s.tableNote}>
              아직 발급한 키가 없습니다. 위에서 키를 발급하세요.
            </p>
          )}
          {revoking && (
            <p role="status" className={s.tableNote}>
              폐기하면 이 키로 보낸 요청이 바로 거절됩니다. 되돌릴 수 없습니다.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
