import { useTranslation } from "react-i18next";
import { CampaignAnalyticsDashboard } from "~/components/campaigns/campaign-analytics-dashboard";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: i18n.t("socialAds.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("socialAds.metaDescription") },
  ];
}

export default function SocialAdsPage() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "socialAds.metaTitle",
    descriptionKey: "socialAds.metaDescription",
    titleSuffix: " - Repraesent",
  });
  return (
    <CampaignAnalyticsDashboard title={t("campaigns.titleSocial")} />
  );
}
