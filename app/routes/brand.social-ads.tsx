import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search, Store } from "lucide-react";
import i18n from "~/i18n";
import { cn } from "~/lib/utils";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import {
  CampaignsBasePathContext,
  type CampaignsContextValue,
} from "~/lib/campaigns-base-path-context";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import {
  getBrandSocialAdsPartnerHouses,
  type BrandSocialAdsPartnerHouse,
} from "~/lib/api/brand";

export function meta() {
  return [{ title: i18n.t("brand.socialAdsMetaTitle") }];
}

const ALL_HOUSES = "all";

export default function BrandSocialAdsPage() {
  useDocumentMeta({ titleKey: "brand.socialAdsMetaTitle" });

  // `ALL_HOUSES` (the default) aggregates every enabled partner house; any other
  // value scopes to a single house. A real house id is a uuid, so it never
  // collides with the sentinel.
  const [houseValue, setHouseValue] = useState<string>(ALL_HOUSES);

  const { data: houses = [], isLoading } = useQuery({
    queryKey: ["brand", "social-ads", "partner-houses"],
    queryFn: getBrandSocialAdsPartnerHouses,
  });

  // Point every campaign API call inside CampaignAnalyticsDashboard at the
  // brand-scoped backend mount, and drop the per-campaign "Show leads" link
  // (returning null hides it) — the brand view is read-only.
  const ctx = useMemo<CampaignsContextValue>(
    () => ({
      basePath:
        houseValue === ALL_HOUSES
          ? "/brands/me/social-ads/campaigns"
          : `/brands/me/social-ads/partner-houses/${houseValue}/campaigns`,
      buildLeadsLink: () => null,
    }),
    [houseValue]
  );

  const selector = (
    <PartnerHouseSelector
      houses={houses}
      value={houseValue}
      onChange={setHouseValue}
      isLoading={isLoading}
    />
  );

  return (
    // Remount on house change so all campaign queries refetch cleanly
    // (the dashboard's query keys don't include basePath).
    <CampaignsBasePathContext.Provider value={ctx}>
      <CampaignAnalyticsDashboard key={houseValue} title={selector} />
    </CampaignsBasePathContext.Provider>
  );
}

/* ─── Searchable partner-house selector (rendered in place of the page title) ─── */

function PartnerHouseSelector({
  houses,
  value,
  onChange,
  isLoading,
}: {
  houses: BrandSocialAdsPartnerHouse[];
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus the search field and reset the query whenever the menu opens
  useEffect(() => {
    if (open) {
      setSearch("");
      inputRef.current?.focus();
    }
  }, [open]);

  const selectedName =
    value === ALL_HOUSES
      ? t("brand.socialAdsSelectAllHouses")
      : (houses.find((h) => h.id === value)?.name ??
        t("brand.socialAdsSelectAllHouses"));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return houses;
    return houses.filter((h) => h.name.toLowerCase().includes(q));
  }, [houses, search]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "group -mx-1.5 flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left",
          "hover:bg-muted/60 transition-colors duration-150",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <span className="whitespace-nowrap text-xl font-bold tracking-tight text-foreground">
          {isLoading ? t("common.loading") : selectedName}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[70] mt-1.5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("brand.socialAdsSelectPlaceholder")}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Options */}
          <div className="max-h-72 overflow-y-auto p-1">
            {/* All partner houses (aggregate) */}
            <OptionRow
              label={t("brand.socialAdsSelectAllHouses")}
              selected={value === ALL_HOUSES}
              onClick={() => select(ALL_HOUSES)}
            />

            <div className="my-1 h-px bg-border" />

            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t("brand.socialAdsNoHouses")}
              </p>
            ) : (
              filtered.map((h) => {
                const enabled = h.socialAdsEnabled && h.hasCampaigns;
                return (
                  <OptionRow
                    key={h.id}
                    label={h.name}
                    hint={
                      enabled ? undefined : t("brand.socialAdsDisabledHint")
                    }
                    disabled={!enabled}
                    selected={value === h.id}
                    onClick={() => select(h.id)}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  label,
  hint,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
        disabled
          ? "cursor-not-allowed text-muted-foreground/60"
          : "text-foreground hover:bg-muted/60",
        selected &&
          !disabled &&
          "bg-amber-400/10 text-amber-700 dark:text-amber-300"
      )}
    >
      <Store className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <span className="shrink-0 text-[11px] text-muted-foreground/70">
          {hint}
        </span>
      )}
      {selected && !disabled && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}
