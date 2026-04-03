import { useTranslation } from "react-i18next";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";

export function meta() {
  return [
    { title: "Google Ads - Repraesent" },
    { name: "description", content: "Google Ads campaign analytics" },
  ];
}

export default function GoogleAdsPage() {
  const { t } = useTranslation();
  return (
    <CampaignAnalyticsDashboard
      title={t("campaigns.titleGoogle")}
      platform="google"
    />
  );
}
