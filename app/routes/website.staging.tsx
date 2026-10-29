import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { WebsiteOverviewPage } from "~/components/wordpress/website-overview-page";

export function meta() {
  return [
    {
      title:
        i18n.t("wordpress.staging.metaTitle", "Staging website") +
        " - Repraesent",
    },
    {
      name: "description",
      content: i18n.t(
        "wordpress.staging.metaDescription",
        "The copy of your website where changes are checked before they go live.",
      ),
    },
  ];
}

/** URL: /website/staging — Website › Staging, the copies of the production site. */
export default function WebsiteStagingRoute() {
  useDocumentMeta({
    titleKey: "wordpress.staging.metaTitle",
    descriptionKey: "wordpress.staging.metaDescription",
    titleSuffix: " - Repraesent",
  });
  return <WebsiteOverviewPage stage="staging" />;
}
