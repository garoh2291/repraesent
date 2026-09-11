import { Braces, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { CatalogField } from "~/lib/api/workflows";
import { buildVariableGroups, filterGroups } from "~/lib/workflows/variables";

/**
 * Insert a value into a template, by name.
 *
 * Replaces a wrapping row of up to forty monospace chips whose label *was* the
 * token. Three things changed and each fixes a different failure:
 *
 *  - **The human label leads.** The catalogue has always carried "Email (from
 *    contact)" and "Expected close date"; the builder threw them away and
 *    rendered the raw path. The path is still shown, dim and small, because it
 *    is what ends up in the box — but it is no longer what you have to read to
 *    choose.
 *  - **Grouped by where the value comes from**, so "the person" and "this
 *    record" are distinguishable. `recipient.*` has resolved since workflow
 *    emails shipped and was never offered anywhere.
 *  - **One button, not forty.** Forty chips above a text box is a wall; a
 *    button that opens a searchable list is a decision.
 */
export function VariablePicker({
  fields,
  disabled,
  includePrevious = true,
  onInsert,
}: {
  fields: CatalogField[];
  disabled?: boolean;
  /** Off where a previous value makes no sense (a recipient address). */
  includePrevious?: boolean;
  /** Receives the bare path; the caller wraps it in braces. */
  onInsert: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(
    () => buildVariableGroups(fields, { includePrevious }),
    [fields, includePrevious],
  );
  const shown = useMemo(() => filterGroups(groups, query), [groups, query]);

  if (groups.length === 0) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Braces className="h-3.5 w-3.5" aria-hidden />
          {t("workflows.variables.insert", { defaultValue: "Insert a value" })}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        // Keep the caret where it was: the whole point is to splice into the
        // field the author was typing in.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("workflows.variables.search", {
              defaultValue: "Search values…",
            })}
            className="h-7 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("workflows.variables.noMatch", {
                defaultValue: "Nothing matches that.",
              })}
            </p>
          ) : (
            shown.map((group) => (
              <div key={group.key} className="mb-1 last:mb-0">
                <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {t(`workflows.variables.group_${group.key}`, {
                    defaultValue: group.key,
                  })}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      onInsert(item.path);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {item.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {item.path}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
