import { useId, useState } from "react";
import { desktopAutoFocus } from "~/lib/utils/touch";
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
import { SearchSelect } from "~/components/notebook/search-select";

/** Dimensions offered in "Add a filter", in the order owners think of them. */
const FILTER_DIMS: StatsDimension[] = [
  "source",
  "channel",
  "ad_click",
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
  // What the field shows: the plain label of a picked value ("Germany"), or what was typed.
  const [shown, setShown] = useState("");
  const [picked, setPicked] = useState(false);
  const typeValue = (v: string) => {
    setShown(v);
    setValue(v);
    setPicked(false);
  };

  // Suggestions: the most common values of that dimension in the same range.
  const suggestDim = dim === "goal" ? null : dim;
  const { data } = useQuery({
    queryKey: statsKeys.breakdown(scope, { ...params, filters: [] }, dim, { limit: 50 }),
    queryFn: () => getStatsBreakdown(scope, { ...params, filters: [] }, suggestDim as Exclude<StatsDimension, "goal">, { limit: 50 }),
    enabled: !!suggestDim,
    staleTime: 60_000,
  });
  const suggestions = data?.rows.map((r) => r.value) ?? [];
  const needle = shown.trim().toLowerCase();
  const matches = picked
    ? []
    : suggestions
        .filter((s) => !needle || s.toLowerCase().includes(needle) || valueLabel(dim, s, t, i18n.language).text.toLowerCase().includes(needle))
        .slice(0, 8);

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
        {/* A div, not a label: a label forwards every click inside it to its first control. */}
        <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
          <span>{t("analytics.filterWhat", "What")}</span>
          <SearchSelect
            value={dim}
            ariaLabel={t("analytics.filterWhat", "What")}
            searchPlaceholder={t("analytics.filterWhatSearch", "Search, e.g. country")}
            options={FILTER_DIMS.map((d) => ({ value: d, label: dimensionLabel(d, t) }))}
            onChange={(v) => {
              setDim(v as StatsDimension);
              typeValue("");
            }}
          />
        </div>
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
        <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
          <label htmlFor={`${listId}-input`}>{t("analytics.filterValue", "Value")}</label>
          <input
            id={`${listId}-input`}
            value={shown}
            onChange={(e) => typeValue(e.target.value)}
            autoFocus={desktopAutoFocus()}
            enterKeyHint="done"
            autoComplete="off"
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls={listId}
            placeholder={op === "contains" ? t("analytics.filterContainsHint", "Part of the text, e.g. sale") : t("analytics.filterPick", "Pick or type a value")}
            className="h-11 rounded-lg border border-border bg-card px-3 text-[14px] font-normal max-sm:text-[16px]"
          />
          {/* Values seen in this period — tap one. Replaces <datalist> (unreliable on phones). */}
          {matches.length ? (
            <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card py-1">
              {matches.map((s) => (
                <li key={s} role="option" aria-selected={s === value}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue(s);
                      setShown(valueLabel(dim, s, t, i18n.language).text);
                      setPicked(true);
                    }}
                    className="flex min-h-11 w-full items-center px-3 text-left text-[14px] font-normal text-foreground hover:bg-muted"
                  >
                    <span className="truncate">{valueLabel(dim, s, t, i18n.language).text}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </form>
    </BottomSheet>
  );
}
