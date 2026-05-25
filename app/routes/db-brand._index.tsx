import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, ChevronDown, Download, Loader2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [{ title: i18n.t("db_brand.page_titles.dashboard") }];
}
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
import {
  CampaignsBasePathContext,
  type CampaignsContextValue,
} from "~/lib/campaigns-base-path-context";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import { BrandLeadsTable } from "~/components/db-brand/brand-leads-table";

export default function DbBrandIndex() {
  useDocumentMeta({ titleKey: "db_brand.page_titles.dashboard" });
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const isBrandWs = currentWorkspace?.type === "doorboost_brand";

  // Retailers query is still warmed here so the sidebar + bulk-export modal
  // see the same cached list as the embedded leads table below.
  const { data: retailers = [] } = useQuery<BrandRetailer[]>({
    queryKey: ["db-brand-retailers", currentWorkspace?.id],
    queryFn: listBrandRetailers,
    enabled: isBrandWs,
  });

  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  async function handleExportAll() {
    if (exportingAll) return;
    setExportingAll(true);
    try {
      // Empty arrays = every retailer + every campaign that belongs to the
      // workspace's doorboost brand. Same behavior as the old card view.
      await downloadBulkBrandLeadsXlsx([], []);
    } finally {
      setExportingAll(false);
    }
  }

  // Re-point the embedded CampaignAnalyticsDashboard at the brand-wide API
  // mount and rewrite the per-campaign "Show leads" link to deep-link into
  // the owning retailer's leads page filtered by that campaign. retailer_id
  // is included on the brand-wide /campaigns response; if it's somehow
  // missing we fall back to the in-page anchor filter.
  const campaignsCtx = useMemo<CampaignsContextValue>(
    () => ({
      basePath: `/users/me/workspace/doorboost-brand/campaigns`,
      buildLeadsLink: (campaign) => {
        const cid = encodeURIComponent(campaign.campaign_id);
        if (campaign.retailer_id) {
          return `/db-brand/retailers/${campaign.retailer_id}/leads?platform_campaign_id=${cid}`;
        }
        return `/db-brand?platform_campaign_id=${cid}#leads`;
      },
    }),
    []
  );

  if (!isBrandWs) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
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
                "db_brand.subtitle_combined",
                "Social ads & leads across every retailer in your brand."
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
              <DropdownMenuItem onSelect={() => setBulkExportOpen(true)}>
                <Download className="w-4 h-4" />
                {t("db_brand.export.selected", "Export Selected")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <section className="mt-8">
        <CampaignsBasePathContext.Provider value={campaignsCtx}>
          <CampaignAnalyticsDashboard
            title={t("db_brand.tabs.social_ads", "Social Ads")}
          />
        </CampaignsBasePathContext.Provider>
      </section>

      <section id="leads" className="mt-12 scroll-mt-24">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-amber-400/10 text-amber-400">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {t("db_brand.tabs.leads", "Leads")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "db_brand.leads.subtitle_combined",
                "All retailers — filter by retailer, campaign, status or source."
              )}
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
          <BrandLeadsTable />
        </div>
      </section>

      <BulkLeadsExportModal
        open={bulkExportOpen}
        onOpenChange={setBulkExportOpen}
        retailers={retailers}
      />
    </div>
  );
}
