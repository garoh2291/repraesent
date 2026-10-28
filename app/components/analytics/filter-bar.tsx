import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ListFilter, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import {
  getStatsBreakdown,
  statsKeys,
  type FilterOp,
  type StatsDimension,
  type StatsFilter,
  type StatsParams,
  type StatsScope,
} from "~/lib/api/website-stats";
import { dimensionLabel, valueLabel } from "./labels";

/** Dimensions offered in "Add a filter", in the order owners think of them. */
const FILTER_DIMS: StatsDimension[] = [
  "source",
  "channel",
  "utm_campaign",
  "utm_source",
  "utm_medium",
  "utm_content",
  "utm_term",
  "page",
  "entry_page",
  "exit_page",
  "country",
  "region",
  "device",
  "browser",
  "os",
  "goal",
];

function opLabel(op: FilterOp, t: (k: string, f: string) => string) {
  if (op === "is_not") return t("analytics.op.isNot", "is not");
  if (op === "contains") return t("analytics.op.contains", "contains");
  return t("analytics.op.is", "is");
}

export function FilterBar({
  filters,
  onChange,
  params,
  scope,
}: {
  filters: StatsFilter[];
  onChange: (filters: StatsFilter[]) => void;
  params: StatsParams;
  scope: StatsScope;
}) {
  const { t, i18n } = useTranslation();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f, i) => (
        <span
          key={`${f.dim}:${i}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-[13px]"
        >
          <span className="text-muted-foreground">{dimensionLabel(f.dim, t)}</span>
          <span className="text-muted-foreground">{opLabel(f.op, t)}</span>
          <strong className="min-w-0 truncate font-semibold text-foreground">
            {f.values
              .map((v) => (f.dim === "goal" || f.op === "contains" ? v : valueLabel(f.dim, v, t, i18n.language).text))
              .join(", ")}
          </strong>
          <button
            type="button"
            onClick={() => onChange(filters.filter((_, j) => j !== i))}
            aria-label={t("analytics.removeFilter", "Remove filter")}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground hover:bg-foreground/10 max-sm:size-8"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-foreground/40 px-3 text-[13px] font-semibold text-foreground hover:bg-muted max-sm:min-h-11"
      >
        <ListFilter className="size-3.5" aria-hidden />
        {t("analytics.addFilter", "Add a filter")}
      </button>
      {filters.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="px-2 text-[13px] font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground max-sm:min-h-11"
        >
          {t("analytics.clearFilters", "Clear all")}
        </button>
      ) : (
        <span className="text-[12.5px] text-muted-foreground max-sm:hidden">
          {t("analytics.filterTip", "Tip: click any row below to see only those visitors.")}
        </span>
      )}
      {adding ? (
        <AddFilter
          open={adding}
          onOpenChange={setAdding}
          params={params}
          scope={scope}
          onAdd={(f) => {
            onChange([...filters.filter((x) => !(x.dim === f.dim && x.op === f.op)), f]);
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

function AddFilter({
  open,
  onOpenChange,
  params,
  scope,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: StatsParams;
  scope: StatsScope;
  onAdd: (f: StatsFilter) => void;
}) {
  const { t, i18n } = useTranslation();
  const listId = useId();
  const [dim, setDim] = useState<StatsDimension>("source");
  const [op, setOp] = useState<FilterOp>("is");
  const [value, setValue] = useState("");

  // Suggestions: the most common values of that dimension in the same range.
  const suggestDim = dim === "goal" ? null : dim;
  const { data } = useQuery({
    queryKey: statsKeys.breakdown(scope, { ...params, filters: [] }, dim, { limit: 50 }),
    queryFn: () => getStatsBreakdown(scope, { ...params, filters: [] }, suggestDim as Exclude<StatsDimension, "goal">, { limit: 50 }),
    enabled: !!suggestDim,
    staleTime: 60_000,
  });
  const suggestions = data?.rows.map((r) => r.value) ?? [];

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd({ dim, op, values: [v] });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("analytics.addFilter", "Add a filter")}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="h-11 w-full rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background disabled:opacity-40 sm:w-auto"
        >
          {t("analytics.applyFilter", "Show these visitors")}
        </button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
          {t("analytics.filterWhat", "What")}
          <select
            value={dim}
            onChange={(e) => {
              setDim(e.target.value as StatsDimension);
              setValue("");
            }}
            className="h-11 rounded-lg border border-border bg-card px-3 text-[14px] font-normal max-sm:text-[16px]"
          >
            {FILTER_DIMS.map((d) => (
              <option key={d} value={d}>
                {dimensionLabel(d, t)}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label={t("analytics.filterHow", "How")} className="flex gap-2">
          {(["is", "is_not", "contains"] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={op === o}
              onClick={() => setOp(o)}
              className={cn(
                "h-10 flex-1 rounded-lg border text-[13.5px] font-medium",
                op === o ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
              )}
            >
              {opLabel(o, t)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
          {t("analytics.filterValue", "Value")}
          <input
            list={listId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            placeholder={op === "contains" ? t("analytics.filterContainsHint", "Part of the text, e.g. sale") : t("analytics.filterPick", "Pick or type a value")}
            className="h-11 rounded-lg border border-border bg-card px-3 text-[14px] font-normal max-sm:text-[16px]"
          />
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s}>
                {valueLabel(dim, s, t, i18n.language).text}
              </option>
            ))}
          </datalist>
        </label>
      </form>
    </BottomSheet>
  );
}
