// 버전 사이의 차이 목록. 추가·삭제·변경을 색과 글자로 함께 표시한다.
import { Badge } from "../../../../packages/ui/src/components.tsx";
import ui from "../../../../packages/ui/src/ui.module.css";
import local from "./auditor.module.css";
import { CHANGE_LABELS, type Change } from "./diff.ts";

const s = { ...ui, ...local };
const TONES: Record<Change["kind"], string> = {
  added: "success",
  removed: "danger",
  changed: "warning",
};

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
        {from}, {to} 두 버전의 내용이 같아요.
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
            <Badge tone={TONES[change.kind]}>
              {CHANGE_LABELS[change.kind]}
            </Badge>
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
