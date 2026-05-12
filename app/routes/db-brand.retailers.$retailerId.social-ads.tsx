import { useMemo } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import i18n from "~/i18n";

export function meta() {
  return [{ title: i18n.t("db_brand.page_titles.retailer_social_ads") }];
}
import {
  CampaignsBasePathContext,
  type CampaignsContextValue,
} from "~/lib/campaigns-base-path-context";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import { RetailerTabsLayout } from "~/components/db-brand/retailer-tabs";

export default function DbBrandRetailerSocialAds() {
  const { retailerId } = useParams<{ retailerId: string }>();
  const { t } = useTranslation();

  // Point all the campaign API calls inside CampaignAnalyticsDashboard at the
  // retailer-scoped backend mount instead of the workspace's own campaigns,
  // and rewrite the per-campaign "Show leads" link to deep-link into the
  // brand workspace's per-retailer leads page.
  const ctx = useMemo<CampaignsContextValue>(
    () => ({
      basePath: `/users/me/workspace/doorboost-brand/retailers/${retailerId}/campaigns`,
      buildLeadsLink: (campaignId) =>
        retailerId
          ? `/db-brand/retailers/${retailerId}/leads?platform_campaign_id=${encodeURIComponent(campaignId)}`
          : null,
    }),
    [retailerId],
  );

  if (!retailerId) {
    return null;
  }

  return (
    <RetailerTabsLayout>
      <CampaignsBasePathContext.Provider value={ctx}>
        <CampaignAnalyticsDashboard
          title={t("db_brand.tabs.social_ads", "Social Ads")}
        />
      </CampaignsBasePathContext.Provider>
    </RetailerTabsLayout>
  );
}
