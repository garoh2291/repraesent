import { Check, ChevronDown, Variable } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  RELATIVE_DATE_OPERATORS,
  type CatalogField,
  type Condition,
} from "~/lib/api/workflows";

/**
 * The right-hand side of a condition.
 *
 * Which editor appears is decided by the operator first and the field's kind
 * second — "more than N days ago" wants a number even though the field is a
 * date, and `is one of` wants multi-select even though `is` wants a single
 * value. Getting this wrong is what made the old builder feel poor: a date
 * compared against a free-text string nobody could type correctly.
 */
export function ConditionValue({
  condition,
  field,
  fields,
  disabled,
  onChange,
}: {
  condition: Condition;
  field: CatalogField | undefined;
  fields: CatalogField[];
  disabled?: boolean;
  onChange: (patch: Partial<Condition>) => void;
}) {
  const { t } = useTranslation();

  // Comparing against another field wins over every value editor.
  if (condition.valueField !== undefined) {
    return (
      <div className="flex items-center gap-1">
        <Select
          value={condition.valueField || ""}
          disabled={disabled}
          onValueChange={(valueField) => onChange({ valueField })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder={t("workflows.condition.pickField")} />
          </SelectTrigger>
          <SelectContent>
            {fields
              // Only same-kind fields: comparing a date to a name is never
              // what anyone means, and offering it invites a silent false.
              .filter((f) => f.kind === field?.kind && f.path !== condition.path)
              .map((f) => (
                <SelectItem key={f.path} value={f.path}>
                  {f.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <ToggleFieldMode active onClick={() => onChange({ valueField: undefined })} />
      </div>
    );
  }

  const isRelative = RELATIVE_DATE_OPERATORS.includes(condition.operator);

  // "more than N days ago" — a count, not a date.
  if (isRelative) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          className="h-9"
          disabled={disabled}
          value={Number(condition.value ?? 7)}
          onChange={(e) => onChange({ value: e.target.valueAsNumber || 0 })}
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("workflows.delay.days").toLowerCase()}
        </span>
      </div>
    );
  }

  if (field?.kind === "date") {
    return <DateValue condition={condition} disabled={disabled} onChange={onChange} />;
  }

  if (field?.options?.length) {
    const multi = condition.operator === "in" || condition.operator === "not_in";
    return multi ? (
      <MultiEnumValue
        options={field.options}
        value={Array.isArray(condition.value) ? condition.value : []}
        disabled={disabled}
        onChange={(value) => onChange({ value })}
      />
    ) : (
      <Select
        value={String(condition.value ?? "")}
        disabled={disabled}
        onValueChange={(value) => onChange({ value })}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder={t("workflows.condition.pickValue")} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field?.kind === "boolean") {
    return (
      <Select
        value={String(condition.value ?? "true")}
        disabled={disabled}
        onValueChange={(v) => onChange({ value: v === "true" })}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t("common.yes", { defaultValue: "Yes" })}</SelectItem>
          <SelectItem value="false">{t("common.no", { defaultValue: "No" })}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-9"
        disabled={disabled}
        type={field?.kind === "number" ? "number" : "text"}
        value={String(condition.value ?? "")}
        placeholder={t("workflows.condition.valuePlaceholder")}
        onChange={(e) =>
          onChange({
            value:
              field?.kind === "number" ? e.target.valueAsNumber : e.target.value,
          })
        }
      />
      {/* Only offered when there is something to compare against. */}
      {fields.some((f) => f.kind === field?.kind && f.path !== condition.path) ? (
        <ToggleFieldMode onClick={() => onChange({ valueField: "" })} />
      ) : null}
    </div>
  );
}

function ToggleFieldMode({
  active,
  onClick,
}: {
  active?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t("workflows.condition.compareToField")}
      aria-label={t("workflows.condition.compareToField")}
      aria-pressed={!!active}
      className={`shrink-0 rounded-md border p-2 transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Variable className="h-3.5 w-3.5" />
    </button>
  );
}

function DateValue({
  condition,
  disabled,
  onChange,
}: {
  condition: Condition;
  disabled?: boolean;
  onChange: (patch: Partial<Condition>) => void;
}) {
  const { t, i18n } = useTranslation();
  const raw = condition.value;
  const selected =
    typeof raw === "string" && raw ? new Date(raw) : undefined;
  const valid = selected && !Number.isNaN(selected.getTime());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className={valid ? "" : "text-muted-foreground"}>
            {valid
              ? selected!.toLocaleDateString(i18n.language, { dateStyle: "medium" })
              : t("workflows.condition.pickDate")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={valid ? selected : undefined}
          onSelect={(date) =>
            // Date-only ISO: comparisons are chronological, and a time nobody
            // chose would make "on this day" behave unpredictably.
            onChange({ value: date ? date.toISOString().slice(0, 10) : null })
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function MultiEnumValue({
  options,
  value,
  disabled,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className={value.length ? "truncate" : "text-muted-foreground"}>
            {value.length
              ? t("workflows.condition.nSelected", { count: value.length })
              : t("workflows.condition.pickValues")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                  on ? "border-foreground bg-foreground text-background" : "border-border"
                }`}
              >
                {on ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
