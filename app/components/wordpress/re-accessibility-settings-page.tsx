import { useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CircleDot, Globe, ListChecks, PanelRight, Save } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import {
  PluginSettingsLoadingPage,
  ServicePauseToggle,
} from "~/components/wordpress/plugin-settings-chrome";
import { PageShell } from "~/components/wordpress/re-cookie/fields";
import { flash } from "~/components/wordpress/re-cookie/constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DEFAULTS,
  rejectedFields,
  type ReAccessibilitySettings,
} from "~/components/wordpress/re-accessibility/settings";
import { ButtonPanel } from "~/components/wordpress/re-accessibility/button-panel";
import { MenuPanel } from "~/components/wordpress/re-accessibility/menu-panel";
import { FeaturesPanel } from "~/components/wordpress/re-accessibility/features-panel";
import { WebsitePanel } from "~/components/wordpress/re-accessibility/website-panel";
import { MenuPreview } from "~/components/wordpress/re-accessibility/menu-preview";
import { BrandColors } from "~/components/wordpress/re-accessibility/brand-colors";

type TabId = "button" | "menu" | "features" | "website";

/**
 * re:accessibility (accessibility menu) inside Repraesent: every part of the button
 * and the menu, which adjustments it offers, the site-wide help and the
 * statement's contact details — with a live preview drawn by the plugin's own
 * stylesheet. There is no wp-admin screen.
 */
export function ReAccessibilitySettingsPage() {
  const { t, i18n } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const pageTitle = t("wordpress.reAccessibility.titleFallback", "Accessibility Menu");
  const [tab, setTab] = useState<TabId>("button");

  const {
    settings,
    setSettings,
    reseed,
    dirty,
    site,
    hasSite,
    loading,
    saving,
    loadError,
    saveMutation,
  } = useWorkspacePluginSettingsForm<ReAccessibilitySettings>(pluginUuid, DEFAULTS);

  function handleSave() {
    const submitted = settings;
    saveMutation.mutate(submitted as unknown as Record<string, unknown>, {
      onSuccess: (data) => {
        // Re-seed from what WordPress stored: the plugin puts a value it can't
        // use back to its default, and the form must show that, not our copy.
        const applied = reseed(data.settings);
        const rejected = rejectedFields(submitted, applied);
        if (rejected.length > 0) {
          flash(
            rejected
              .map((field) =>
                field === "contact_email"
                  ? t(
                      "wordpress.reAccessibility.rejectedEmail",
                      "The email address isn't valid, so it wasn't saved.",
                    )
                  : field === "contact_phone"
                    ? t(
                        "wordpress.reAccessibility.rejectedPhone",
                        "Only digits, spaces and + ( ) - / . are kept in the phone number.",
                      )
                    : field === "statement_url"
                      ? t(
                          "wordpress.reAccessibility.rejectedUrl",
                          "The statement page address must start with https:// or http://, so it wasn't saved.",
                        )
                      : t(
                          "wordpress.reAccessibility.rejectedColor",
                          "A color wasn't a color code like #0b57d0 and went back to its original.",
                        ),
              )
              .join(" "),
            "error",
          );
          return;
        }
        flash(
          t(
            "wordpress.reAccessibility.saved",
            "Saved. Your website shows the new menu now.",
          ),
        );
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  if (loading) {
    return <PluginSettingsLoadingPage />;
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reAccessibility.noSite",
            "This workspace doesn't have a website connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 app-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">
                {pageTitle}
              </h1>
              {dirty ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 font-normal text-muted-foreground"
                >
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {t("wordpress.reAccessibility.unsaved", "Unsaved changes")}
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {site?.url
                ? site.url.replace(/^https?:\/\//i, "")
                : t(
                    "wordpress.reAccessibility.subtitle",
                    "Accessibility help for your visitors",
                  )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <ServicePauseToggle
              pluginUuid={pluginUuid}
              pauseHint={t(
                "wordpress.reAccessibility.pauseHint",
                "Switch off to pause. The accessibility button, the skip link and the focus outline leave your website until you switch back on. Nothing is deleted.",
              )}
            />
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="shrink-0"
            >
              {saving ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {saving
                ? t("wordpress.reAccessibility.saving", "Saving…")
                : t("wordpress.reAccessibility.save", "Save")}
            </Button>
          </div>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-6 app-fade-up app-fade-up-d1">
          <BrandColors settings={settings} patch={setSettings} />
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabId)}
            className="min-w-0 gap-4"
          >
            <TabsList
              aria-label={t(
                "wordpress.reAccessibility.tabs",
                "Accessibility menu settings",
              )}
              className="max-w-full overflow-x-auto"
            >
              <TabsTrigger value="button" className="gap-1.5">
                <CircleDot className="size-3.5" />
                {t("wordpress.reAccessibility.tabButton", "Button")}
              </TabsTrigger>
              <TabsTrigger value="menu" className="gap-1.5">
                <PanelRight className="size-3.5" />
                {t("wordpress.reAccessibility.tabMenu", "Menu")}
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-1.5">
                <ListChecks className="size-3.5" />
                {t("wordpress.reAccessibility.tabFeatures", "Adjustments")}
              </TabsTrigger>
              <TabsTrigger value="website" className="gap-1.5">
                <Globe className="size-3.5" />
                {t("wordpress.reAccessibility.tabWebsite", "Website")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="button" className="mt-0">
              <ButtonPanel settings={settings} patch={setSettings} />
            </TabsContent>
            <TabsContent value="menu" className="mt-0">
              <MenuPanel settings={settings} patch={setSettings} />
            </TabsContent>
            <TabsContent value="features" className="mt-0">
              <FeaturesPanel settings={settings} patch={setSettings} />
            </TabsContent>
            <TabsContent value="website" className="mt-0">
              <WebsitePanel settings={settings} patch={setSettings} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 app-fade-up app-fade-up-d2">
          <MenuPreview
            settings={settings}
            defaultLang={i18n.language?.startsWith("en") ? "en" : "de"}
          />
        </div>
      </div>
    </PageShell>
  );
}
