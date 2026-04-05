import { useTranslation } from "react-i18next";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";

export function meta() {
  return [
    { title: "Social Ads - Repraesent" },
    { name: "description", content: "Social ads campaign analytics" },
  ];
}

export default function SocialAdsPage() {
  const { t } = useTranslation();
  return (
    <CampaignAnalyticsDashboard title={t("campaigns.titleSocial")} />
  );
}
