import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { getContacts } from "~/lib/api/contacts-crm";
import { getDeals } from "~/lib/api/deals";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { desktopAutoFocus } from "~/lib/utils/touch";

export interface PickedEntity {
  id: string;
  label: string;
  sub?: string | null;
  /** Contacts only. */
  kind?: "person" | "company";
  email?: string | null;
  phone?: string | null;
  /** Contacts only: the language they get emails in. Undefined = not loaded. */
  locale?: string | null;
}

/**
 * Search-and-pick for a customer (person or company) or a deal. One small
 * control instead of the three copies inside the task form.
 */
export function EntityPicker({
  type,
  value,
  onChange,
  placeholder,
  className,
}: {
  type: "contact" | "deal";
  value: PickedEntity | null;
  onChange: (value: PickedEntity | null) => void;
  placeholder: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const q = useDebounce(search, 250);

  const results = useQuery({
    queryKey: [type === "contact" ? "contacts-picker" : "deals-picker", q],
    queryFn: async (): Promise<PickedEntity[]> => {
      if (type === "contact") {
        const res = await getContacts({ search: q || undefined, limit: 20 });
        return res.data.map((c) => ({
          id: c.id,
          label: c.contact_full_name?.trim() || c.primary_email || "—",
          sub: c.kind === "company" ? t("appointmentBook.form.company", "Company") : (c.parent_full_name ?? c.primary_email ?? null),
          kind: c.kind === "company" ? "company" : "person",
          email: c.primary_email ?? null,
          phone: c.primary_phone ?? null,
          locale: c.locale ?? null,
        }));
      }
      const res = await getDeals({ search: q || undefined, limit: 20 });
      return res.data.map((d) => ({
        id: d.id,
        label: d.title?.trim() || t("appointmentBook.deal", "Deal"),
        sub: d.contact_full_name ?? null,
      }));
    },
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm transition-colors hover:bg-muted/50 max-sm:h-11 max-sm:text-[15px]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{value ? value.label : placeholder}</span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("common.clear", "Clear")}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(null);
                }
              }}
              className="relative text-muted-foreground hover:text-foreground max-sm:after:absolute max-sm:after:-inset-[15px]"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus={desktopAutoFocus()}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0"
          />
        </div>
        {/* The list is portaled outside the dialog / phone sheet, whose scroll
            lock cancels wheel and touch scrolling at the document. The wheel
            scrolls it by hand (same as create-deal-dialog); a touch move stops
            before the lock's document listener (React listens on the document
            too, and first); data-vaul-no-drag keeps the sheet from dragging. */}
        <div
          ref={listRef}
          data-vaul-no-drag
          onWheel={(e) => {
            const el = listRef.current;
            if (!el) return;
            const { scrollTop, scrollHeight, clientHeight } = el;
            if ((e.deltaY < 0 && scrollTop > 0) || (e.deltaY > 0 && scrollTop < scrollHeight - clientHeight)) {
              e.stopPropagation();
              el.scrollTop += e.deltaY;
            }
          }}
          onTouchMove={(e) => e.nativeEvent.stopImmediatePropagation()}
          className="max-h-[240px] overflow-y-auto overscroll-contain max-sm:max-h-[50dvh]"
        >
          {results.isFetching && !results.data ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">{t("common.loading", "Loading…")}</div>
          ) : (results.data ?? []).length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">{t("common.noResults", "No results")}</div>
          ) : (
            (results.data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted max-sm:min-h-11"
              >
                <span className="flex-1 truncate font-medium">{item.label}</span>
                {item.sub ? <span className="max-w-[160px] truncate text-xs text-muted-foreground">{item.sub}</span> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
