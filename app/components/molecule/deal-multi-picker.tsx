import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Check, Search, X } from "lucide-react";
import { getDeals, type DealListItem } from "~/lib/api/deals";
import { useAuthContext } from "~/providers/auth-provider";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { formatCurrency } from "~/lib/utils/format";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";

/** A deal picked in a form, with just enough to show it as a chip. */
export interface PickedDeal {
  id: string;
  label: string;
}

interface DealMultiPickerProps {
  id?: string;
  value: PickedDeal[];
  onChange: (value: PickedDeal[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Pick one or more existing deals in a form (the Deals field of New contact).
 * Same typeahead shape as CompanyPicker: the field searches, the list sits
 * under it, and what is picked stays visible below as removable chips.
 */
export function DealMultiPicker({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: DealMultiPickerProps) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(search.trim(), 250);

  // Phones: keep the list between the sheet top and the keyboard (`--kb`).
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    if (!open) return;
    const read = () =>
      setKeyboard(
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--kb"),
        ) || 0,
      );
    read();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", read);
    return () => viewport?.removeEventListener("resize", read);
  }, [open]);

  const query = useQuery({
    queryKey: ["deals", "deal-multi-picker", debounced],
    queryFn: () =>
      getDeals({ page: 1, limit: 8, search: debounced || undefined }),
    enabled: !!currentWorkspace && open && !disabled,
    staleTime: 30 * 1000,
  });
  const rows = query.data?.data ?? [];
  const picked = new Set(value.map((d) => d.id));

  const labelOf = (d: DealListItem) =>
    d.title?.trim() ||
    d.contact_full_name?.trim() ||
    t("contacts.dealsPanel.untitled", { defaultValue: "Untitled deal" });

  const toggle = (d: DealListItem) => {
    onChange(
      picked.has(d.id)
        ? value.filter((v) => v.id !== d.id)
        : [...value, { id: d.id, label: labelOf(d) }],
    );
    // The pick shows as a chip below; leftover search text would read as
    // something still to be saved.
    setSearch("");
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative" ref={wrapperRef}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={id}
              value={search}
              disabled={disabled}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                setOpen(true);
                window.setTimeout(
                  () =>
                    wrapperRef.current?.scrollIntoView({ block: "nearest" }),
                  300,
                );
              }}
              onClick={() => setOpen(true)}
              placeholder={placeholder}
              autoComplete="off"
              enterKeyHint="search"
              className="px-9 max-sm:pr-11"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("common.clearSearch", { defaultValue: "Clear" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground max-sm:right-0 max-sm:flex max-sm:size-11 max-sm:items-center max-sm:justify-center max-sm:[&>svg]:size-4"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          collisionPadding={{ top: 8, left: 8, right: 8, bottom: keyboard + 8 }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Keep the list open while the owner types in the field above it.
            if (
              e.target instanceof Node &&
              wrapperRef.current?.contains(e.target)
            ) {
              e.preventDefault();
            }
          }}
          className="w-(--radix-popover-trigger-width) p-0 flex flex-col overflow-hidden"
        >
          <div className="min-h-0 max-h-[min(220px,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
            {query.isFetching && rows.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground max-sm:text-[13px]">
                {t("contacts.deals.noneFound", {
                  defaultValue: "No deal matches that.",
                })}
              </div>
            ) : (
              rows.map((d) => {
                const isPicked = picked.has(d.id);
                const sub = [
                  d.title?.trim() ? d.contact_full_name?.trim() : null,
                  d.value != null && d.value !== ""
                    ? formatCurrency(Number(d.value), d.currency)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="option"
                    aria-selected={isPicked}
                    onClick={() => toggle(d)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted max-sm:min-h-11 max-sm:text-[15px] active:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {labelOf(d)}
                      </span>
                      {sub ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {sub}
                        </span>
                      ) : null}
                    </span>
                    {isPicked ? (
                      <Check className="size-4 shrink-0 text-foreground" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((d) => (
            <li
              key={d.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-foreground max-sm:min-h-9 max-sm:text-[13px]"
            >
              <Briefcase className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{d.label}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.id !== d.id))}
                aria-label={t("contacts.deals.removeOne", {
                  defaultValue: "Remove {{name}}",
                  name: d.label,
                })}
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground max-sm:size-8"
              >
                <X className="size-3 max-sm:size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
