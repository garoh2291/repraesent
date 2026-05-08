import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Search,
  X,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { useDebounce } from "~/lib/hooks/useDebounce";
import {
  type BrandPlatformCampaignsPage,
  type BrandRetailer,
  listBrandPlatformCampaignsForRetailers,
  downloadBulkBrandLeadsXlsx,
} from "~/lib/api/doorboost-brand";

const CAMPAIGNS_PAGE_SIZE = 50;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Brand retailers — used only to resolve human-readable retailer names
   * next to each campaign row. The campaigns query itself is scoped to the
   * whole brand server-side (empty retailer list = all retailers).
   */
  retailers: BrandRetailer[];
}

/**
 * Single-step bulk export modal. Lists every platform campaign attached to
 * the brand (server-paginated + debounced search), default selection is
 * empty so the user opts in to exactly what they want. Generate streams
 * the leads XLSX.
 *
 * `selectedCampaignIds` is a `Set<string>` that survives across pages and
 * search queries — toggling 1 of 4 000 stays O(1).
 */
export function BulkLeadsExportModal({ open, onOpenChange, retailers }: Props) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Reset state only on the false → true transition.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSearchInput("");
      setPage(1);
      setExportError(null);
      setSelectedCampaignIds(new Set());
    }
    wasOpenRef.current = open;
  }, [open]);

  // Whenever the user changes their search query, snap back to page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const retailerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of retailers) m.set(r.retailer_id, r.retailer_name);
    return m;
  }, [retailers]);

  const {
    data: campaignsPage,
    isLoading: campaignsLoading,
    isFetching: campaignsFetching,
  } = useQuery<BrandPlatformCampaignsPage>({
    queryKey: ["bulk-leads-campaigns", debouncedSearch, page],
    queryFn: () =>
      // Empty retailer list = backend expands to all brand retailers.
      listBrandPlatformCampaignsForRetailers([], {
        q: debouncedSearch || undefined,
        page,
        limit: CAMPAIGNS_PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const campaigns = campaignsPage?.data ?? [];
  const totalCampaigns = campaignsPage?.total ?? 0;
  const totalPages = campaignsPage?.totalPages ?? 1;

  function toggleCampaign(id: string) {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      for (const c of campaigns) next.add(c.campaign_id);
      return next;
    });
  }

  function clearAllSelected() {
    setSelectedCampaignIds(new Set());
  }

  async function handleGenerate() {
    if (selectedCampaignIds.size === 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      // Empty retailer list — backend uses every retailer in the brand
      // and intersects with the user-picked campaign ids.
      await downloadBulkBrandLeadsXlsx([], Array.from(selectedCampaignIds));
      onOpenChange(false);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : t("common.somethingWentWrong"),
      );
    } finally {
      setIsExporting(false);
    }
  }

  const canGenerate = selectedCampaignIds.size > 0 && !isExporting;
  const showSpinner =
    campaignsLoading || (campaignsFetching && campaigns.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{t("db_brand.bulk_export.title")}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t("db_brand.bulk_export.subtitle")}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 pt-4 pb-3 space-y-3 border-b">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder={t("db_brand.bulk_export.search_campaigns")}
              trailing={
                campaignsFetching && !campaignsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : null
              }
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("db_brand.bulk_export.selected_campaigns_total", {
                  selected: selectedCampaignIds.size,
                  total: totalCampaigns,
                })}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={selectAllOnPage}
                  disabled={campaigns.length === 0}
                  className="h-7 px-2 text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  {t("db_brand.bulk_export.select_page")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearAllSelected}
                  disabled={selectedCampaignIds.size === 0}
                  className="h-7 px-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  {t("db_brand.bulk_export.clear_selected")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {showSpinner ? (
              <div className="grid place-items-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyRow
                text={
                  debouncedSearch
                    ? t("common.noResults")
                    : t("db_brand.bulk_export.no_campaigns")
                }
              />
            ) : (
              <ul className="divide-y">
                {campaigns.map((c) => {
                  const checked = selectedCampaignIds.has(c.campaign_id);
                  const retailerName =
                    retailerNameById.get(c.retailer_id) ?? c.retailer_id;
                  return (
                    <li key={`${c.platform}-${c.campaign_id}`}>
                      <label className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-md">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            toggleCampaign(c.campaign_id)
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {c.campaign_name || c.campaign_id}
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 truncate flex items-center gap-1.5">
                            {c.platform && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold">
                                {c.platform}
                              </span>
                            )}
                            <span className="truncate">{retailerName}</span>
                            <span className="font-mono text-muted-foreground/60 truncate">
                              #{c.campaign_id}
                            </span>
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("db_brand.bulk_export.page_of", {
                  page,
                  totalPages,
                })}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!campaignsPage?.hasPrev || campaignsFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!campaignsPage?.hasNext || campaignsFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {exportError && (
          <div className="mx-6 mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {exportError}
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="bg-amber-500 text-white hover:bg-amber-500/90"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {t("db_brand.bulk_export.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  trailing?: React.ReactNode;
}

function SearchInput({
  value,
  onChange,
  placeholder,
  trailing,
}: SearchInputProps) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Prevent implicit form submission if the modal ever ends up
          // inside one — Enter would otherwise navigate to /db-brand.data.
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-ring"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {trailing}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label={t("common.clearSearch")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="grid place-items-center py-10 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
