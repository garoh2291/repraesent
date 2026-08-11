import { Braces, Plus, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  NULLARY_OPERATORS,
  type CatalogField,
  type Condition,
  type ConditionGroup,
  type ConditionOperator,
} from "~/lib/api/workflows";
import { ConditionValue } from "./ConditionValue";

/** Nesting deeper than this stops being readable in a side panel. */
const MAX_DEPTH = 1;

/**
 * Field → operator → value, with optional nested groups.
 *
 * The `all`/`any` toggle sits on a rail down the left of its rows rather than
 * floating above them, so at a glance you can see which conditions a given
 * combinator actually governs — the thing that makes nested boolean logic
 * readable instead of a wall of selects.
 */
export function ConditionBuilder({
  group,
  fields,
  disabled,
  depth = 0,
  onChange,
}: {
  group: ConditionGroup;
  fields: CatalogField[];
  disabled?: boolean;
  depth?: number;
  onChange: (next: ConditionGroup) => void;
}) {
  const { t } = useTranslation();
  const conditions = group?.conditions ?? [];
  const groups = group?.groups ?? [];
  const rowCount = conditions.length + groups.length;

  const patch = (index: number, next: Partial<Condition>) =>
    onChange({
      ...group,
      conditions: conditions.map((c, i) => (i === index ? { ...c, ...next } : c)),
    });

  const columns = fields.filter((f) => !f.dynamic);
  const dynamic = fields.filter((f) => f.dynamic);

  return (
    <div className="space-y-2">
      {rowCount > 1 ? (
        <MatchToggle
          value={group.match}
          disabled={disabled}
          onChange={(match) => onChange({ ...group, match })}
        />
      ) : null}

      <div
        className={
          rowCount > 1
            ? "space-y-2 border-l-2 border-border pl-3"
            : "space-y-2"
        }
      >
        {conditions.map((condition, index) => {
          const field = fields.find((f) => f.path === condition.path);
          const needsValue = !NULLARY_OPERATORS.includes(condition.operator);

          return (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,150px)_minmax(0,1.1fr)_auto]"
            >
              <Select
                value={condition.path}
                disabled={disabled}
                onValueChange={(path) => {
                  const next = fields.find((f) => f.path === path);
                  // Keep the operator only if the new field supports it,
                  // otherwise the row lands in an impossible state.
                  const operator = next?.operators.includes(condition.operator)
                    ? condition.operator
                    : (next?.operators[0] ?? "eq");
                  patch(index, {
                    path,
                    operator,
                    value: undefined,
                    valueField: undefined,
                  });
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={t("workflows.condition.pickField")} />
                </SelectTrigger>
                <SelectContent>
                  {columns.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>{t("workflows.condition.groupFields")}</SelectLabel>
                      {columns.map((f) => (
                        <SelectItem key={f.path} value={f.path}>
                          <span className="flex items-center gap-1.5">
                            {f.label}
                            {/* Resolved from a related table, not a column —
                                worth saying so it isn't mistaken for one. */}
                            {f.resolved ? (
                              <Sparkles className="h-3 w-3 text-muted-foreground" />
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {dynamic.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>{t("workflows.condition.groupMetadata")}</SelectLabel>
                      {dynamic.map((f) => (
                        <SelectItem key={f.path} value={f.path}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>

              <Select
                value={condition.operator}
                disabled={disabled || !field}
                onValueChange={(op) =>
                  patch(index, {
                    operator: op as ConditionOperator,
                    value: NULLARY_OPERATORS.includes(op as ConditionOperator)
                      ? undefined
                      : condition.value,
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(field?.operators ?? []).map((op) => (
                    <SelectItem key={op} value={op}>
                      {t(`workflows.operator.${op}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {needsValue ? (
                <ConditionValue
                  condition={condition}
                  field={field}
                  fields={fields}
                  disabled={disabled}
                  onChange={(next) => patch(index, next)}
                />
              ) : (
                <span className="hidden sm:block" />
              )}

              <RemoveButton
                label={t("workflows.condition.remove")}
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...group,
                    conditions: conditions.filter((_, i) => i !== index),
                  })
                }
              />
            </div>
          );
        })}

        {groups.map((child, index) => (
          <div
            key={`g${index}`}
            className="relative rounded-xl border border-dashed border-border bg-muted/20 p-2.5"
          >
            <RemoveButton
              label={t("workflows.condition.removeGroup")}
              disabled={disabled}
              className="absolute right-2 top-2"
              onClick={() =>
                onChange({
                  ...group,
                  groups: groups.filter((_, i) => i !== index),
                })
              }
            />
            <ConditionBuilder
              group={child}
              fields={fields}
              disabled={disabled}
              depth={depth + 1}
              onChange={(next) =>
                onChange({
                  ...group,
                  groups: groups.map((g, i) => (i === index ? next : g)),
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <AddButton
          disabled={disabled || fields.length === 0}
          onClick={() =>
            onChange({
              match: group?.match ?? "all",
              groups,
              conditions: [
                ...conditions,
                {
                  path: fields[0]?.path ?? "",
                  operator: fields[0]?.operators[0] ?? "eq",
                },
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          {t("workflows.condition.add")}
        </AddButton>

        {depth < MAX_DEPTH ? (
          <AddButton
            disabled={disabled || fields.length === 0}
            onClick={() =>
              onChange({
                ...group,
                conditions,
                groups: [
                  ...groups,
                  // Opposite combinator by default: nesting an `all` inside an
                  // `all` changes nothing, so the useful default is the other.
                  {
                    match: group.match === "all" ? "any" : "all",
                    conditions: [
                      {
                        path: fields[0]?.path ?? "",
                        operator: fields[0]?.operators[0] ?? "eq",
                      },
                    ],
                  },
                ],
              })
            }
          >
            <Braces className="h-3.5 w-3.5" />
            {t("workflows.condition.addGroup")}
          </AddButton>
        ) : null}
      </div>
    </div>
  );
}

function MatchToggle({
  value,
  disabled,
  onChange,
}: {
  value: "all" | "any";
  disabled?: boolean;
  onChange: (next: "all" | "any") => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
      {(["all", "any"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`rounded-md px-2 py-1 font-medium transition-colors disabled:opacity-50 ${
            value === option
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`workflows.condition.match${option === "all" ? "All" : "Any"}`)}
        </button>
      ))}
    </div>
  );
}

function AddButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function RemoveButton({
  label,
  disabled,
  className,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 ${
        className ?? "justify-self-end"
      }`}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
