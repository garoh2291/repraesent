import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronDown, Search, UserRound } from "lucide-react";
import { cn } from "~/lib/utils";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import type { BatchCandidate, BatchCandidates } from "~/lib/api/deal-batches";

/** Rows shown before "Show more" (a 5,000-line import stays fast on a phone). */
const PAGE = 200;
const ANY = "";

export interface PickerFilter {
  search: string;
  kind: "" | "person" | "company";
  /** column key → value ("" = any) */
  values: Record<string, string>;
}

export const EMPTY_FILTER: PickerFilter = { search: "", kind: "", values: {} };

export function matchesFilter(r: BatchCandidate, f: PickerFilter): boolean {
  if (f.kind && (f.kind === "company") !== (r.kind === "company")) return false;
  for (const [k, v] of Object.entries(f.values)) {
    if (v !== ANY && (r.values[k] ?? "") !== v) return false;
  }
  const q = f.search.trim().toLowerCase();
  if (!q) return true;
  return [r.name, r.company, r.email, r.phone, ...Object.values(r.values)]
    .filter(Boolean)
    .some((s) => s!.toLowerCase().includes(q));
}

/**
 * Who gets a deal. Everyone is ticked except people who already have an
 * open deal (they say which one, and can be ticked anyway). Filters come
 * from the import's own columns, so "only region Nord" is one tap.
 */
export function ContactPicker({
  data,
  picked,
  onPicked,
  filter,
  onFilter,
}: {
  data: BatchCandidates;
  picked: Set<string>;
  onPicked: (next: Set<string>) => void;
  filter: PickerFilter;
  onFilter: (f: PickerFilter) => void;
}) {
  const { t } = useTranslation();
  const { ref: searchRef, withHint } = useSearchShortcut();
  const [shown, setShown] = useState(PAGE);

  // Columns worth filtering by: a handful of different values (not names or notes).
  const filterColumns = useMemo(
    () =>
      data.columns
        .map((col) => {
          const vals = new Map<string, number>();
          for (const r of data.rows) {
            const v = r.values[col.key];
            if (v) vals.set(v, (vals.get(v) ?? 0) + 1);
          }
          return { ...col, options: [...vals.entries()].sort((a, b) => b[1] - a[1]) };
        })
        .filter((c) => c.options.length >= 2 && c.options.length <= 30),
    [data],
  );
  const hasBothKinds = useMemo(
    () => data.rows.some((r) => r.kind === "company") && data.rows.some((r) => r.kind !== "company"),
    [data],
  );

  const visible = useMemo(() => data.rows.filter((r) => matchesFilter(r, filter)), [data, filter]);
  const visiblePicked = visible.filter((r) => picked.has(r.contact_id)).length;
  const allShownPicked = visible.length > 0 && visiblePicked === visible.length;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    onPicked(next);
  };
  const setShownAll = (on: boolean) => {
    const next = new Set(picked);
    for (const r of visible) {
      if (on) next.add(r.contact_id);
      else next.delete(r.contact_id);
    }
    onPicked(next);
  };
  const filtered = filter.search.trim() !== "" || filter.kind !== "" || Object.values(filter.values).some((v) => v !== ANY);

  return (
    <section aria-label={t("dealBatch.pick.label", "Who gets a deal")} className="min-w-0 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={filter.search}
            onChange={(e) => onFilter({ ...filter, search: e.target.value })}
            placeholder={withHint(t("dealBatch.pick.search", "Search name, email, phone…"))}
            className="h-10 pl-9"
            type="search"
            enterKeyHint="search"
            aria-label={t("dealBatch.pick.search", "Search name, email, phone…")}
          />
        </div>
        {hasBothKinds ? (
          <FilterSelect
            label={t("dealBatch.pick.kind", "Who")}
            value={filter.kind}
            onChange={(v) => onFilter({ ...filter, kind: v as PickerFilter["kind"] })}
            options={[
              { value: ANY, label: t("dealBatch.pick.kindAll", "People and companies") },
              { value: "person", label: t("dealBatch.pick.kindPeople", "Only people") },
              { value: "company", label: t("dealBatch.pick.kindCompanies", "Only companies") },
            ]}
          />
        ) : null}
      </div>

      {filterColumns.length ? (
        <div className="flex flex-wrap gap-2">
          {filterColumns.map((col) => (
            <FilterSelect
              key={col.key}
              label={col.label}
              value={filter.values[col.key] ?? ANY}
              onChange={(v) => onFilter({ ...filter, values: { ...filter.values, [col.key]: v } })}
              options={[
                { value: ANY, label: t("dealBatch.pick.anyValue", { defaultValue: "{{column}}: all", column: col.label }) },
                ...col.options.map(([v, n]) => ({ value: v, label: `${col.label}: ${v} (${n})` })),
              ]}
            />
          ))}
        </div>
      ) : null}

      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border pb-2">
        <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-[14px] font-medium text-foreground">
          <Checkbox
            checked={allShownPicked ? true : visiblePicked > 0 ? "indeterminate" : false}
            onCheckedChange={(v) => setShownAll(v === true)}
            disabled={!visible.length}
            aria-label={filtered ? t("dealBatch.pick.tickShown", "Tick everyone shown") : t("dealBatch.pick.tickAll", "Tick everyone")}
          />
          {filtered ? t("dealBatch.pick.tickShown", "Tick everyone shown") : t("dealBatch.pick.tickAll", "Tick everyone")}
        </label>
        <span className="num shrink-0 text-[13px] text-muted-foreground">
          {filtered
            ? t("dealBatch.pick.shownCount", { defaultValue: "{{shown}} of {{total}} shown", shown: visible.length, total: data.rows.length })
            : t("dealBatch.pick.totalCount", { defaultValue: "{{count}} contacts", count: data.rows.length })}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted-foreground">
          {filtered
            ? t("dealBatch.pick.noneMatch", "Nobody matches. Clear the search or a filter.")
            : t("dealBatch.pick.empty", "There are no contacts here to make deals for.")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {visible.slice(0, shown).map((r) => (
            <PickRow key={r.contact_id} row={r} picked={picked.has(r.contact_id)} onToggle={(on) => toggle(r.contact_id, on)} />
          ))}
        </ul>
      )}
      {visible.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="press flex min-h-11 w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border text-[14px] font-medium text-foreground hover:bg-muted/40"
        >
          <ChevronDown className="size-4" aria-hidden />
          {t("dealBatch.pick.showMore", { defaultValue: "Show {{count}} more", count: Math.min(PAGE, visible.length - shown) })}
        </button>
      ) : null}
    </section>
  );
}

function PickRow({ row, picked, onToggle }: { row: BatchCandidate; picked: boolean; onToggle: (on: boolean) => void }) {
  const { t } = useTranslation();
  const Icon = row.kind === "company" ? Building2 : UserRound;
  const sub = [row.company, row.email ?? row.phone].filter(Boolean).join(" · ");
  return (
    <li>
      <label
        className={cn(
          "flex min-h-14 cursor-pointer touch-manipulation select-none items-start gap-3 px-3 py-2.5 transition-colors sm:px-4",
          !picked && "bg-muted/25",
        )}
      >
        <Checkbox checked={picked} onCheckedChange={(v) => onToggle(v === true)} className="mt-1" aria-label={row.name} />
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[14.5px] font-medium", picked ? "text-foreground" : "text-muted-foreground")}>
            {row.name}
          </span>
          {sub ? <span className="block truncate text-[13px] text-muted-foreground">{sub}</span> : null}
          {row.open_deal ? (
            <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-foreground/15 px-2 py-0.5 text-[12px] text-foreground/80">
              <span className="truncate">
                {t("dealBatch.pick.hasOpenDeal", { defaultValue: "Already has a deal: {{title}}", title: row.open_deal.title })}
              </span>
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

/** A filter as a native select: the phone opens its own wheel, no popover to fight. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative max-sm:w-full">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full appearance-none rounded-full border bg-card pl-3.5 pr-9 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:text-[16px] sm:max-w-[16rem]",
          value ? "border-foreground font-medium" : "border-border",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}
