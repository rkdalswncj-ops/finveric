import { useId } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, type Tone } from "../shared/components.tsx";
import ui from "../shared/ui.module.css";
import s from "./auditor.module.css";

type RecordOption = {
  value: string;
  label: string;
  reference?: string;
  status?: { label: string; tone: Tone };
};

// 원장의 판매 ID와 고객 가명 ID에는 쓰이지 않는 값이다.
const CLEAR_VALUE = "clear";

export function RecordSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: RecordOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const selected = options.find((option) => option.value === value);

  return (
    <div className={ui.field}>
      <label htmlFor={id}>{label}</label>
      <Select.Root
        value={selected?.value ?? ""}
        disabled={disabled || options.length === 0}
        onValueChange={(next) => onChange(next === CLEAR_VALUE ? "" : next)}
      >
        <Select.Trigger id={id} className={s.recordSelectTrigger}>
          <span className={s.recordSelectValue}>
            <Select.Value placeholder={placeholder}>
              {selected?.label}
            </Select.Value>
          </span>
          <Select.Icon asChild>
            <ChevronDown size={18} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            aria-label={label}
            className={s.recordSelectContent}
            position="popper"
            align="start"
            sideOffset={6}
            collisionPadding={16}
          >
            <Select.ScrollUpButton className={s.recordSelectScroll}>
              <ChevronUp size={16} aria-hidden="true" />
            </Select.ScrollUpButton>
            <Select.Viewport className={s.recordSelectViewport}>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  className={s.recordSelectOption}
                  value={option.value}
                  textValue={option.label}
                >
                  <Select.ItemText>
                    <span className={s.recordSelectName}>{option.label}</span>
                    {option.reference && (
                      <span className={s.recordSelectMeta}>
                        <code>{option.reference}</code>
                        {option.status && (
                          <Badge tone={option.status.tone}>
                            {option.status.label}
                          </Badge>
                        )}
                      </span>
                    )}
                  </Select.ItemText>
                  <Select.ItemIndicator className={s.recordSelectCheck}>
                    <Check size={16} aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
              {selected && (
                <Select.Item
                  className={s.recordSelectOption}
                  value={CLEAR_VALUE}
                >
                  <Select.ItemText>선택 지우기</Select.ItemText>
                </Select.Item>
              )}
            </Select.Viewport>
            <Select.ScrollDownButton className={s.recordSelectScroll}>
              <ChevronDown size={16} aria-hidden="true" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
