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
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [{ title: i18n.t("db_brand.page_titles.retailer_campaign") }];
}

/**
 * Same social-ads page as `db-brand.retailers.$retailerId.social-ads.tsx` but
 * the dashboard is pre-filtered to a single campaign (driven by the `:campaignId`
 * URL segment). Used as the destination when a row is clicked on
 * `/brand-campaigns` or any other campaign-table view.
 */
export default function DbBrandRetailerSocialAdsByCampaign() {
  useDocumentMeta({ titleKey: "db_brand.page_titles.retailer_campaign" });
  const { retailerId, campaignId } = useParams<{
    retailerId: string;
    campaignId: string;
  }>();
  const { t } = useTranslation();
  const location = useLocation();

  // Click source can pass a friendly name + platform via navigation state so
  // the filter chip doesn't fall back to the raw id and the platform tabs
  // can be hidden immediately. On a deep-link both are looked up from the
  // retailer's campaign list (already cached by TanStack Query elsewhere).
  const navState = location.state as
    | { campaign_name?: string; platform?: string }
    | null;
  const stateName = navState?.campaign_name;
  const statePlatform = navState?.platform;

  const { data: retailerCampaigns = [] } = useQuery<BrandRetailerCampaign[]>({
    queryKey: ["db-brand-retailer-campaigns-list", retailerId],
    queryFn: () => listBrandRetailerCampaigns(retailerId!),
    enabled: !!retailerId && (!stateName || !statePlatform),
    staleTime: 60_000,
  });

  const campaignPlatform =
    statePlatform ||
    retailerCampaigns.find((c) => c.campaign_id === campaignId)?.platform;

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
      buildLeadsLink: (campaign) =>
        retailerId
          ? `/db-brand/retailers/${retailerId}/leads?platform_campaign_id=${encodeURIComponent(campaign.campaign_id)}`
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
          platform={campaignPlatform}
          initialCampaignIds={initialCampaignIds}
          initialCampaignNames={initialCampaignNames}
          lockCampaignFilter
        />
      </CampaignsBasePathContext.Provider>
    </RetailerTabsLayout>
  );
}
