import { useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Globe,
  Languages as LanguagesIcon,
  LayoutDashboard,
  MousePointerClick,
  Percent,
  Save,
  Settings2,
  TriangleAlert,
  Type,
} from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import { useResolvePluginKind } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import type { ReTranslateSettings } from "~/lib/wordpress/plugin-settings-types";
import { formatPluginSettingsTitle } from "~/lib/utils/wordpress-plugin-kind";
import {
  PluginSettingsBackLink,
  PluginSettingsLoadingPage,
} from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  InfoNote,
  PageShell,
  StatTile,
} from "~/components/wordpress/fields";
import {
  DEFAULT_SETTINGS,
  PLUGIN_VERSION,
  TAB_PARAM,
  flash,
  summariseStats,
  tabFromParam,
  type TabId,
} from "~/components/wordpress/re-translate/constants";
import { OverviewPanel } from "~/components/wordpress/re-translate/overview-panel";
import { TranslatePanel } from "~/components/wordpress/re-translate/translate-panel";
import { GeneralPanel } from "~/components/wordpress/re-translate/general-panel";
import { SwitcherPanel } from "~/components/wordpress/re-translate/switcher-panel";
import { SwitcherPreview } from "~/components/wordpress/re-translate/switcher-preview";
import { previewLanguage } from "~/components/wordpress/re-translate/constants";

/**
 * re:translate settings inside Repraesent. Full parity with the WordPress plugin
 * admin (Overview, Translate, Switcher, Settings) via the ops API + bridge.
 * Languages are managed on Overview. Chrome matches the dashboard.
 */
export function ReTranslateSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const { catalogItem } = useResolvePluginKind(pluginUuid);
  const pageTitle = formatPluginSettingsTitle(
    catalogItem?.display_name,
    "re:translate",
  );
  const version = catalogItem?.version || PLUGIN_VERSION;

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get(TAB_PARAM));

  function selectTab(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set(TAB_PARAM, next);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  const {
    settings,
    setSettings,
    reseed,
    site,
    hasSite,
    found,
    loading,
    saving,
    dirty,
    loadError,
    saveMutation,
  } = useWorkspacePluginSettingsForm<ReTranslateSettings>(
    pluginUuid,
    DEFAULT_SETTINGS,
  );

  function patchSettings(
    updater: (prev: ReTranslateSettings) => ReTranslateSettings,
  ) {
    setSettings(updater);
  }

  function handleSave() {
    saveMutation.mutate(settings as unknown as Record<string, unknown>, {
      onSuccess: (data) => {
        reseed(data.settings);
        flash(t("wordpress.reTranslate.saved", "Settings saved."));
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
            "wordpress.reTranslate.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  const stats = summariseStats(settings);
  const previewLanguages = [
    previewLanguage({ code: settings.source_language || "en" }, true),
    ...settings.languages.map((language) => previewLanguage(language)),
  ];

  const showSave = tab === "switcher" || tab === "settings";

  return (
    <PageShell width="md">
      <PluginSettingsBackLink
        label={t("wordpress.reTranslate.backToPlugins", "Back to plugins")}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {pageTitle}
            </h1>
            <Badge variant="outline">v{version}</Badge>
            {settings.kill_switch ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/30 bg-amber-500/10 font-normal text-amber-800 dark:text-amber-300"
              >
                {t("wordpress.reTranslate.paused", "Paused")}
              </Badge>
            ) : null}
            {dirty ? (
              <Badge
                variant="secondary"
                className="gap-1.5 font-normal text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                {t("wordpress.reTranslate.unsaved", "Unsaved changes")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {site?.url
              ? site.url.replace(/^https?:\/\//i, "")
              : t(
                  "wordpress.reTranslate.subtitle",
                  "Multilingual content by re:praesent",
                )}
          </p>
        </div>
        {showSave ? (
          <Button onClick={handleSave} disabled={saving} className="shrink-0">
            {saving ? (
              <Spinner className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving
              ? t("wordpress.reTranslate.saving", "Saving\u2026")
              : t("wordpress.reTranslate.save", "Save settings")}
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {!found ? (
        <InfoNote>
          {t(
            "wordpress.reTranslate.notConfigured",
            "No re:translate options in the database yet \u2014 saving will create them.",
          )}
        </InfoNote>
      ) : null}

      <div className="grid grid-cols-2 gap-3 app-fade-up app-fade-up-d1 sm:grid-cols-4 sm:gap-4">
        <StatTile
          icon={<LanguagesIcon className="size-3.5" />}
          label={t("wordpress.reTranslate.statLanguages", "Languages")}
          value={stats.languageCount}
          size="lg"
          tone={stats.languageCount > 0 ? "positive" : "muted"}
        />
        <StatTile
          icon={<Percent className="size-3.5" />}
          label={t("wordpress.reTranslate.statTranslated", "Translated")}
          value={`${stats.translatedPercent}%`}
          size="lg"
          tone={stats.translatedPercent > 0 ? "positive" : "muted"}
        />
        <StatTile
          icon={<TriangleAlert className="size-3.5" />}
          label={t("wordpress.reTranslate.statNeedsUpdating", "Needs updating")}
          value={stats.needsUpdating}
          size="lg"
          tone={stats.needsUpdating > 0 ? "neutral" : "muted"}
        />
        <StatTile
          icon={<Type className="size-3.5" />}
          label={t("wordpress.reTranslate.statUntranslated", "Untranslated")}
          value={stats.untranslated.toLocaleString()}
          size="lg"
          tone="muted"
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={selectTab}
        className="app-fade-up app-fade-up-d2 gap-4"
      >
        <TabsList
          aria-label={t("wordpress.reTranslate.tabs", "re:translate settings")}
        >
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="size-3.5" />
            {t("wordpress.reTranslate.tabOverview", "Overview")}
          </TabsTrigger>
          <TabsTrigger value="translate" className="gap-1.5">
            <Globe className="size-3.5" />
            {t("wordpress.reTranslate.tabTranslate", "Translate")}
          </TabsTrigger>
          <TabsTrigger value="switcher" className="gap-1.5">
            <MousePointerClick className="size-3.5" />
            {t("wordpress.reTranslate.tabSwitcher", "Switcher")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="size-3.5" />
            {t("wordpress.reTranslate.tabSettings", "Settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewPanel
            settings={settings}
            pluginUuid={pluginUuid}
            onNavigate={(next) => selectTab(next)}
          />
        </TabsContent>

        <TabsContent value="translate" className="mt-0">
          <TranslatePanel settings={settings} pluginUuid={pluginUuid} />
        </TabsContent>

        <TabsContent value="switcher" className="mt-0">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <SwitcherPanel settings={settings} patchSettings={patchSettings} />
            <div className="lg:sticky lg:top-6">
              <SwitcherPreview
                switcher={settings.switcher}
                languages={previewLanguages}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <GeneralPanel
            settings={settings}
            patchSettings={patchSettings}
            pluginUuid={pluginUuid}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
