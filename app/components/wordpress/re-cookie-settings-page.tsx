import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Palette, Save, Settings } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import type {
  ReCookieLang,
  ReCookieSettings,
} from "~/lib/wordpress/plugin-settings-types";
import { PluginSettingsBackLink } from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DEFAULTS,
  flash,
  PLUGIN_VERSION,
  type TabId,
} from "~/components/wordpress/re-cookie/constants";
import { BannerPreview } from "~/components/wordpress/re-cookie/banner-preview";
import { ContentPanel } from "~/components/wordpress/re-cookie/content-panel";
import { DesignPanel } from "~/components/wordpress/re-cookie/design-panel";
import { FunctionalityPanel } from "~/components/wordpress/re-cookie/functionality-panel";
import { PageShell } from "~/components/wordpress/re-cookie/fields";

/**
 * re:cookie settings inside Repraesent. Behavior matches the WordPress plugin
 * admin (design, functionality, content tabs); chrome matches the dashboard.
 *
 * Laid out as an editor rather than a form: controls on the left, a live
 * preview of the banner pinned on the right, and a single sticky save bar.
 */
export function ReCookieSettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("design");
  const [activeLang, setActiveLang] = useState<ReCookieLang>("de");
  /** Last state known to be on the server, so "unsaved changes" is truthful. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  const {
    settings,
    setSettings,
    site,
    hasSite,
    loading,
    saving,
    loadError,
    saveMutation,
  } = useWorkspacePluginSettingsForm<ReCookieSettings>("re-cookie", DEFAULTS, {
    // This screen tracks its own dirty state, and the language tabs follow
    // whatever the site has configured.
    onSeeded: (merged) => {
      setSavedSnapshot(JSON.stringify(merged));
      setActiveLang(merged.default_language || "de");
    },
  });

  const dirty = useMemo(
    () => savedSnapshot !== null && JSON.stringify(settings) !== savedSnapshot,
    [settings, savedSnapshot],
  );

  function patch(updater: (prev: ReCookieSettings) => ReCookieSettings) {
    setSettings(updater);
  }

  function handleSave() {
    const submitted = settings;
    saveMutation.mutate(submitted as unknown as Record<string, unknown>, {
      onSuccess: () => {
        setSavedSnapshot(JSON.stringify(submitted));
        flash(t("wordpress.reCookie.saved", "Settings saved successfully."));
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t("wordpress.reCookie.loading", "Loading settings…")}
        </div>
      </PageShell>
    );
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reCookie.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PluginSettingsBackLink
        label={t("wordpress.reCookie.back", "Back to plugins")}
      />

      {/* Sticky action bar — replaces the duplicate save button that used to sit
          at the bottom of a very long page. */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 app-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                re:cookie
              </h1>
              <Badge variant="outline">v{PLUGIN_VERSION}</Badge>
              {dirty ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 font-normal text-muted-foreground"
                >
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {t("wordpress.reCookie.unsaved", "Unsaved changes")}
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {site?.url
                ? site.url.replace(/^https?:\/\//i, "")
                : t(
                    "wordpress.reCookie.subtitle",
                    "Cookie consent & compliance by re:praesent",
                  )}
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="shrink-0">
            {saving ? (
              <Spinner className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving
              ? t("wordpress.reCookie.saving", "Saving…")
              : t("wordpress.reCookie.save", "Save Settings")}
          </Button>
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
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabId)}
          className="min-w-0 gap-4 app-fade-up app-fade-up-d1"
        >
          <TabsList
            aria-label={t("wordpress.reCookie.tabs", "re:cookie settings")}
          >
            <TabsTrigger value="design" className="gap-1.5">
              <Palette className="size-3.5" />
              {t("wordpress.reCookie.tabDesign", "Design")}
            </TabsTrigger>
            <TabsTrigger value="functionality" className="gap-1.5">
              <Settings className="size-3.5" />
              {t("wordpress.reCookie.tabFunctionality", "Functionality")}
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-1.5">
              <FileText className="size-3.5" />
              {t("wordpress.reCookie.tabContent", "Content")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="mt-0">
            <DesignPanel settings={settings} patch={patch} />
          </TabsContent>

          <TabsContent value="functionality" className="mt-0">
            <FunctionalityPanel settings={settings} patch={patch} />
          </TabsContent>

          <TabsContent value="content" className="mt-0">
            <ContentPanel
              settings={settings}
              activeLang={activeLang}
              onActiveLangChange={setActiveLang}
              patch={patch}
            />
          </TabsContent>
        </Tabs>

        <div className="lg:sticky lg:top-24 app-fade-up app-fade-up-d2">
          <BannerPreview settings={settings} lang={activeLang} />
        </div>
      </div>
    </PageShell>
  );
}
