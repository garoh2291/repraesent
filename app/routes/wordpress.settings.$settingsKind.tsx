import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { ReCookieSettingsPage } from "~/components/wordpress/re-cookie-settings-page";
import { ReIndexSettingsPage } from "~/components/wordpress/re-index-settings-page";
import { ReMaintenanceSettingsPage } from "~/components/wordpress/re-maintenance-settings-page";
import { ReReviewSettingsPage } from "~/components/wordpress/re-review-settings-page";
import { ReAppointmentSettingsPage } from "~/components/wordpress/re-appointment-settings-page";
import { isPortedSettingsKind } from "~/lib/utils/wordpress-plugin-kind";

export function meta() {
  return [
    {
      title:
        i18n.t("wordpress.pluginSettings.metaTitle", "Plugin settings") +
        " - Repraesent",
    },
    {
      name: "description",
      content: i18n.t(
        "wordpress.pluginSettings.metaDescription",
        "Configure a Repraesent-managed plugin for your website.",
      ),
    },
  ];
}

/**
 * URL: /wordpress/settings/:settingsKind
 *
 * Renders a managed plugin's own admin screen against the workspace's
 * WordPress site. Only kinds whose admin has actually been ported render here;
 * everything else sends the user back to the plugin list rather than showing a
 * half-built page.
 */
export default function WordPressPluginSettingsRoute() {
  const { t } = useTranslation();
  const { settingsKind } = useParams<{ settingsKind: string }>();

  useDocumentMeta({
    titleKey: "wordpress.pluginSettings.metaTitle",
    descriptionKey: "wordpress.pluginSettings.metaDescription",
    titleSuffix: " - Repraesent",
  });

  if (!isPortedSettingsKind(settingsKind)) {
    return (
      <div className="min-h-full w-full bg-background">
        <div className="mx-auto w-full max-w-[1280px] space-y-3 p-4 py-10! sm:p-6">
          <p className="text-sm text-muted-foreground">
            {t(
              "wordpress.pluginSettings.unknownKind",
              "This plugin can't be managed from Repraesent yet.",
            )}
          </p>
          <Link
            to="/website"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("wordpress.reCookie.back", "Back to plugins")}
          </Link>
        </div>
      </div>
    );
  }

  switch (settingsKind) {
    case "re-cookie":
      return <ReCookieSettingsPage />;
    case "re-index":
      return <ReIndexSettingsPage />;
    case "re-maintenance":
      return <ReMaintenanceSettingsPage />;
    case "re-review":
      return <ReReviewSettingsPage />;
    case "re-appointment":
      return <ReAppointmentSettingsPage />;
  }
}
