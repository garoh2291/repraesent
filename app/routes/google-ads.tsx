import { useTranslation } from "react-i18next";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: i18n.t("googleAds.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("googleAds.metaDescription") },
  ];
}

export default function GoogleAdsPage() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "googleAds.metaTitle",
    descriptionKey: "googleAds.metaDescription",
    titleSuffix: " - Repraesent",
  });
  return (
    <CampaignAnalyticsDashboard
      title={t("campaigns.titleGoogle")}
      platform="google"
    />
  );
}
