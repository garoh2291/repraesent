import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { WebsiteOverviewPage } from "~/components/wordpress/website-overview-page";

export function meta() {
  return [
    { title: i18n.t("wordpress.metaTitle", "Website") + " - Repraesent" },
    {
      name: "description",
      content: i18n.t(
        "wordpress.metaDescription",
        "Manage your website, services, and content.",
      ),
    },
  ];
}

/** URL: /website — Website › Production, the live site. */
export default function WordPressPage() {
  useDocumentMeta({
    titleKey: "wordpress.metaTitle",
    descriptionKey: "wordpress.metaDescription",
    titleSuffix: " - Repraesent",
  });
  return <WebsiteOverviewPage stage="live" />;
}
