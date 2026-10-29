import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { PluginSettingsLoadingPage } from "~/components/wordpress/plugin-settings-chrome";
import { ReCookieSettingsPage } from "~/components/wordpress/re-cookie-settings-page";
import { ReIndexSettingsPage } from "~/components/wordpress/re-index-settings-page";
import { ReMaintenanceSettingsPage } from "~/components/wordpress/re-maintenance-settings-page";
import { ReReviewSettingsPage } from "~/components/wordpress/re-review-settings-page";
import { ReAppointmentSettingsPage } from "~/components/wordpress/re-appointment-settings-page";
import { ReTranslateSettingsPage } from "~/components/wordpress/re-translate-settings-page";
import { ReVisibleSettingsPage } from "~/components/wordpress/re-visible-settings-page";
import { ReBannerSettingsPage } from "~/components/wordpress/re-banner-settings-page";
import { useResolvePluginKind } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import { useWpSitesHosting } from "~/lib/hooks/useWorkspaceWpSites";
import { PageShell } from "~/components/wordpress/fields";
import { NotHostedNotice } from "~/components/wordpress/website-site-picker";

export function meta() {
  return [
    {
      title:
        i18n.t("wordpress.pluginSettings.metaTitle", "Service settings") +
        " - Repraesent",
    },
    {
      name: "description",
      content: i18n.t(
        "wordpress.pluginSettings.metaDescription",
        "Configure a Repraesent-managed service for your website.",
      ),
    },
  ];
}

/**
 * URL: /website/settings/:pluginUuid
 *
 * The plugin is named by its opaque catalog UUID; we resolve it to a kind
 * through the catalog to pick which admin screen to render against the
 * workspace's WordPress site. An unknown UUID sends the user back to the plugin
 * list rather than showing a half-built page.
 */
export default function WordPressPluginSettingsRoute() {
  const { t } = useTranslation();
  const { pluginUuid } = useParams<{ pluginUuid: string }>();

  useDocumentMeta({
    titleKey: "wordpress.pluginSettings.metaTitle",
    descriptionKey: "wordpress.pluginSettings.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const { kind, isLoading } = useResolvePluginKind(pluginUuid);
  const siteQuery = useWorkspaceWpSite(true);
  const isElsewhere = useWpSitesHosting(!!siteQuery.data);

  if (isLoading || kind === undefined || siteQuery.isLoading) {
    return <PluginSettingsLoadingPage />;
  }

  // A site we don't host: none of its services can be read or saved from here.
  if (siteQuery.data && isElsewhere(siteQuery.data.id)) {
    return (
      <PageShell>
        <NotHostedNotice site={siteQuery.data} />
      </PageShell>
    );
  }

  if (kind === null) {
    return (
      <div className="min-h-full w-full bg-background">
        <div className="mx-auto w-full max-w-[1280px] space-y-3 p-4 py-10! sm:p-6">
          <p className="text-sm text-muted-foreground">
            {t(
              "wordpress.pluginSettings.unknownKind",
              "This service can't be managed from Repraesent yet.",
            )}
          </p>
          <Link
            to="/website"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("wordpress.pluginSettings.back", "Back to website")}
          </Link>
        </div>
      </div>
    );
  }

  const page = (() => {
    switch (kind) {
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
      case "re-translate":
        return <ReTranslateSettingsPage />;
      case "re-visible":
        return <ReVisibleSettingsPage />;
      case "re-banner":
        return <ReBannerSettingsPage />;
    }
  })();

  // No activate step: an installed service is switched on in WordPress, and
  // the API switches it on before any save if it somehow isn't.
  return page;
}
