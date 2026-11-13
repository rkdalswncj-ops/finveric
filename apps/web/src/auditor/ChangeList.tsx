// 버전 사이의 차이 목록. 추가·삭제·변경은 상태가 아니라 종류다. 중립 배지와 글자로 표시한다.
import { Badge } from "../shared/components.tsx";
import ui from "../shared/ui.module.css";
import local from "./auditor.module.css";
import { CHANGE_LABELS, type Change } from "./diff.ts";

const s = { ...ui, ...local };

export function ChangeList({
  changes,
  from,
  to,
}: {
  changes: Change[];
  from: string;
  to: string;
}) {
  if (!changes.length)
    return (
      <p className={s.intro}>
        {from}, {to} 두 버전의 내용이 같습니다.
      </p>
    );
  return (
    <>
      <p className={s.small}>
        {from} → {to} · 바뀐 항목 {changes.length}개
      </p>
      <ul className={s.diff}>
        {changes.map((change, index) => (
          <li key={index}>
            <Badge>{CHANGE_LABELS[change.kind]}</Badge>
            <div>
              <strong>{change.label}</strong>
              {change.before !== undefined && (
                <p>
                  {from}: <del>{change.before}</del>
                </p>
              )}
              {change.after !== undefined && (
                <p>
                  {to}: <ins>{change.after}</ins>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
