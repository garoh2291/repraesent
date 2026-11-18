import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { auditKeys, searchAuditWorkspaces } from "~/lib/api/audit";
import { cn } from "~/lib/utils";

type Option = { id: string; name: string };

/**
 * Activity log → which business (AGENCY_MODE_PLAN.md §5). One picker for both
 * cases:
 *  - an agency: its own businesses, searched in place;
 *  - re:praesent (root): the most recently active workspaces until you type,
 *    then a name search on the server.
 * "Everyone" is always first. The chosen name comes from the caller (it may
 * come from the URL after a refresh).
 */
export function WorkspaceFilter({
  value,
  valueName,
  onChange,
  local,
  scopeKey,
  label,
  allLabel,
}: {
  value: string;
  valueName: string | null;
  onChange: (id: string, name: string | null) => void;
  /** Agency: the businesses to pick from. Root: undefined (server search). */
  local?: Option[];
  /** Part of the cache key (current workspace). */
  scopeKey: string | undefined;
  label: string;
  allLabel: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = useDebounce(query.trim(), 200);
  const remote = useQuery({
    queryKey: auditKeys.search(scopeKey, q),
    queryFn: () => searchAuditWorkspaces(q),
    enabled: open && !local,
    staleTime: 30_000,
  });

  const options: Option[] = local
    ? local.filter((o) => !query.trim() || o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : (remote.data ?? []);
  const shown = value ? (valueName ?? (local?.find((o) => o.id === value)?.name ?? "…")) : allLabel;

  const pick = (id: string, name: string | null) => {
    onChange(id, name);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o ? undefined : setQuery(""))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${shown}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "press flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors sm:w-56",
            "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            open && "border-foreground/40",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-foreground")}>{shown}</span>
          <ChevronDown className={cn("size-4 shrink-0 opacity-50 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={t("audit.filters.searchBusinesses")} />
          <CommandList className="max-h-[min(300px,50vh)]">
            {/* While searching, the first match is what Enter picks. */}
            {!query.trim() ? (
              <CommandGroup>
                <CommandItem value="__all" onSelect={() => pick("", null)} className="min-h-10 max-sm:min-h-11">
                  <span className="flex-1">{allLabel}</span>
                  {!value ? <Check className="size-4" aria-hidden /> : null}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {!local && remote.isFetching && !remote.data ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
              </div>
            ) : options.length ? (
              <CommandGroup heading={!local && !q ? t("audit.filters.recent") : undefined}>
                {options.map((o) => (
                  <CommandItem key={o.id} value={o.id} onSelect={() => pick(o.id, o.name)} className="min-h-10 max-sm:min-h-11">
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    {value === o.id ? <Check className="size-4" aria-hidden /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground">{t("audit.filters.noBusiness")}</p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
