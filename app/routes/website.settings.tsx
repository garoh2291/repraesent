import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { WebsiteSettingsPage } from "~/components/wordpress/website-settings-page";

export function meta() {
  return [
    {
      title:
        i18n.t("wordpress.websiteSettings.metaTitle", "Website settings") +
        " - Repraesent",
    },
    {
      name: "description",
      content: i18n.t(
        "wordpress.websiteSettings.metaDescription",
        "Tracking tags, cookie banner choice and search engine settings for your website.",
      ),
    },
  ];
}

/** URL: /website/settings — the Settings tab in the Website strip. */
export default function WebsiteSettingsRoute() {
  useDocumentMeta({
    titleKey: "wordpress.websiteSettings.metaTitle",
    descriptionKey: "wordpress.websiteSettings.metaDescription",
    titleSuffix: " - Repraesent",
  });
  return <WebsiteSettingsPage />;
}
