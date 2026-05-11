import { useMemo } from "react";
import { useLocation, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  CampaignsBasePathContext,
  type CampaignsContextValue,
} from "~/lib/campaigns-base-path-context";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import { RetailerTabsLayout } from "~/components/db-brand/retailer-tabs";
import {
  listBrandRetailerCampaigns,
  type BrandRetailerCampaign,
} from "~/lib/api/doorboost-brand";

export function meta() {
  return [{ title: "Doorboost Brand Dashboard" }];
}

/**
 * Same social-ads page as `db-brand.retailers.$retailerId.social-ads.tsx` but
 * the dashboard is pre-filtered to a single campaign (driven by the `:campaignId`
 * URL segment). Used as the destination when a row is clicked on
 * `/brand-campaigns` or any other campaign-table view.
 */
export default function DbBrandRetailerSocialAdsByCampaign() {
  const { retailerId, campaignId } = useParams<{
    retailerId: string;
    campaignId: string;
  }>();
  const { t } = useTranslation();
  const location = useLocation();

  // Click source can pass a friendly name via navigation state so the filter
  // chip doesn't fall back to the raw id. When absent (deep-link), look it up
  // from the retailer's campaign list — already cached by TanStack Query.
  const stateName = (location.state as { campaign_name?: string } | null)
    ?.campaign_name;

  const { data: retailerCampaigns = [] } = useQuery<BrandRetailerCampaign[]>({
    queryKey: ["db-brand-retailer-campaigns-list", retailerId],
    queryFn: () => listBrandRetailerCampaigns(retailerId!),
    enabled: !!retailerId && !stateName,
    staleTime: 60_000,
  });

  const initialCampaignIds = useMemo(
    () => (campaignId ? [campaignId] : []),
    [campaignId],
  );

  const initialCampaignNames = useMemo(() => {
    if (!campaignId) return new Map<string, string>();
    const name =
      stateName ||
      retailerCampaigns.find((c) => c.campaign_id === campaignId)
        ?.campaign_name ||
      campaignId;
    return new Map([[campaignId, name]]);
  }, [campaignId, stateName, retailerCampaigns]);

  const ctx = useMemo<CampaignsContextValue>(
    () => ({
      basePath: `/users/me/workspace/doorboost-brand/retailers/${retailerId}/campaigns`,
      buildLeadsLink: (cid) =>
        retailerId
          ? `/db-brand/retailers/${retailerId}/leads?platform_campaign_id=${encodeURIComponent(cid)}`
          : null,
    }),
    [retailerId],
  );

  if (!retailerId || !campaignId) return null;

  return (
    <RetailerTabsLayout>
      <CampaignsBasePathContext.Provider value={ctx}>
        <CampaignAnalyticsDashboard
          title={t("db_brand.tabs.social_ads", "Social Ads")}
          initialCampaignIds={initialCampaignIds}
          initialCampaignNames={initialCampaignNames}
          lockCampaignFilter
        />
      </CampaignsBasePathContext.Provider>
    </RetailerTabsLayout>
  );
}
