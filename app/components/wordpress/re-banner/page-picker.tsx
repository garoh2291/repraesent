import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Search, StickyNote, X } from "lucide-react";
import type { ReBannerLinkTarget } from "~/lib/wordpress/plugin-settings-types";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Pick pages and posts by ticking them.
 *
 * Replaces a native `<select multiple>`, which needs ctrl/cmd-click to keep
 * a second selection and gives no way to see what is picked once the list
 * scrolls. Rows stay in the site's own order whatever is ticked: pinning
 * selected rows to the top made the list rearrange itself under the cursor
 * on every click, which reads as the wrong row having been ticked. The
 * "Clear N" count in the header is how many are picked.
 */
export function PagePicker({
  targets,
  value,
  onChange,
  disabled,
}: {
  targets: ReBannerLinkTarget[];
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value), [value]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? targets.filter((target) => target.title.toLowerCase().includes(q))
      : targets;
  }, [targets, query]);

  function toggle(id: number, next: boolean) {
    if (next) onChange([...value, id]);
    else onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2.5 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("wordpress.reBanner.pagesSearch", "Search pages and posts…")}
          aria-label={t("wordpress.reBanner.pagesSearch", "Search pages and posts…")}
          disabled={disabled}
          className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {value.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onChange([])}
            disabled={disabled}
            className="shrink-0 text-muted-foreground"
          >
            <X aria-hidden />
            {t("wordpress.reBanner.pagesClear", "Clear {{count}}", { count: value.length })}
          </Button>
        ) : null}
      </div>

      <ul className="max-h-64 divide-y overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t("wordpress.reBanner.pagesNoMatch", "Nothing matches that.")}
          </li>
        ) : null}
        {rows.map((target) => {
          const checked = selected.has(target.id);
          const id = `rebnr-page-${target.id}`;
          const Icon = target.type === "page" ? FileText : StickyNote;
          return (
            <li key={target.id}>
              <label
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                  checked && "bg-primary/[0.04]",
                  disabled && "pointer-events-none opacity-60",
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(next) => toggle(target.id, next === true)}
                />
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{target.title}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {target.type === "page"
                    ? t("wordpress.reBanner.typePage", "Page")
                    : t("wordpress.reBanner.typePost", "Post")}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
