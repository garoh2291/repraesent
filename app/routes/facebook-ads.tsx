import { useTranslation } from "react-i18next";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";

export function meta() {
  return [
    { title: "Facebook Ads - Repraesent" },
    { name: "description", content: "Facebook Ads campaign analytics" },
  ];
}

export default function FacebookAdsPage() {
  const { t } = useTranslation();
  return (
    <CampaignAnalyticsDashboard
      title={t("campaigns.titleFacebook")}
      platform="facebook"
    />
  );
}
