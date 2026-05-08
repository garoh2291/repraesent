import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Search,
  Store,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import {
  downloadBulkBrandLeadsXlsx,
  listBrandRetailers,
  type BrandRetailer,
} from "~/lib/api/doorboost-brand";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { BulkLeadsExportModal } from "~/components/db-brand/bulk-leads-export-modal";

const lastIdSegment = (id: string) => id.split("-").pop() ?? id;

export default function DbBrandIndex() {
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isBrandWs = currentWorkspace?.type === "doorboost_brand";

  const { data: retailers = [], isLoading } = useQuery<BrandRetailer[]>({
    queryKey: ["db-brand-retailers", currentWorkspace?.id],
    queryFn: listBrandRetailers,
    enabled: isBrandWs,
  });

  const [search, setSearch] = useState("");
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  async function handleExportAll() {
    if (exportingAll) return;
    setExportingAll(true);
    try {
      // Empty arrays = backend uses every retailer + every campaign that
      // belongs to this workspace's doorboost brand.
      await downloadBulkBrandLeadsXlsx([], []);
    } finally {
      setExportingAll(false);
    }
  }
  const filteredRetailers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return retailers;
    return retailers.filter(
      (r) =>
        (r.retailer_name || "").toLowerCase().includes(needle) ||
        r.retailer_id.toLowerCase().includes(needle),
    );
  }, [retailers, search]);

  // Auto-jump to first retailer when there's exactly one — saves a click.
  useEffect(() => {
    if (!isLoading && retailers.length === 1 && isBrandWs) {
      navigate(`/db-brand/retailers/${retailers[0].retailer_id}/social-ads`, {
        replace: true,
      });
    }
  }, [isLoading, retailers, isBrandWs, navigate]);

  if (!isBrandWs) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="space-y-6">
        <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400">
              <Boxes className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {currentWorkspace.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t(
                  "db_brand.subtitle",
                  "Pick a retailer from the sidebar to view its Social Ads & Leads.",
                )}
              </p>
            </div>
          </div>
          {retailers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={exportingAll}
                  className="gap-2 self-stretch sm:self-auto"
                >
                  {exportingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {t("db_brand.export.button", "Export")}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void handleExportAll();
                  }}
                  disabled={exportingAll}
                >
                  <Download className="w-4 h-4" />
                  {t("db_brand.export.all", "Export All Leads")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setBulkExportOpen(true)}
                >
                  <Download className="w-4 h-4" />
                  {t("db_brand.export.selected", "Export Selected")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-xl border bg-card h-20 animate-pulse"
              />
            ))}
          </div>
        ) : retailers.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              {t(
                "db_brand.no_retailers",
                "No retailers attached to this brand yet.",
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  "db_brand.search_placeholder",
                  "Search retailers…",
                )}
                className="w-full rounded-xl border bg-card pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring"
              />
            </div>
            {filteredRetailers.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center">
                <p className="text-muted-foreground text-sm">
                  {t("common.noResults", "No matches")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRetailers.map((r) => {
                  const tag = lastIdSegment(r.retailer_id);
                  return (
                    <button
                      key={r.retailer_id}
                      onClick={() =>
                        navigate(
                          `/db-brand/retailers/${r.retailer_id}/social-ads`,
                        )
                      }
                      className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400/40 hover:bg-amber-400/[0.04] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="grid place-items-center w-10 h-10 shrink-0 rounded-lg bg-amber-400/10 text-amber-500 transition-transform group-hover:scale-105">
                        <Store className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">
                          {r.retailer_name || tag}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground/70 mt-0.5">
                          #{tag}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/70" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <BulkLeadsExportModal
        open={bulkExportOpen}
        onOpenChange={setBulkExportOpen}
        retailers={retailers}
      />
    </div>
  );
}
