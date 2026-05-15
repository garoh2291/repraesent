import { useTranslation } from "react-i18next";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: i18n.t("facebookAds.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("facebookAds.metaDescription") },
  ];
}

export default function FacebookAdsPage() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "facebookAds.metaTitle",
    descriptionKey: "facebookAds.metaDescription",
    titleSuffix: " - Repraesent",
  });
  return (
    <CampaignAnalyticsDashboard
      title={t("campaigns.titleFacebook")}
      platform="facebook"
    />
  );
}
