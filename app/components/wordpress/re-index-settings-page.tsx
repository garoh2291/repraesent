import { useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Check,
  CircleSlash,
  Clock,
  FileText,
  Layers,
  Save,
  Search,
  Send,
} from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import { useWorkspaceReIndexRegenerateSitemap } from "~/lib/hooks/useWorkspaceReIndexSettings";
import type { ReIndexSettings } from "~/lib/wordpress/plugin-settings-types";
import { mergeRecordWithDefaults } from "~/lib/utils/deep-merge";
import { PluginSettingsBackLink } from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DEFAULT_SETTINGS,
  PLUGIN_VERSION,
  flash,
  hasVerificationCode,
  sitemapUrlFromSiteUrl,
  verificationForForm,
  type TabId,
} from "~/components/wordpress/re-index/constants";
import {
  InfoNote,
  PageShell,
  StatTile,
} from "~/components/wordpress/fields";
import { IndexingPanel } from "~/components/wordpress/re-index/indexing-panel";
import { SeoPanel } from "~/components/wordpress/re-index/seo-panel";

/**
 * re:index settings inside Repraesent. Behavior matches the WordPress plugin
 * admin (verification, SEO titles, identity, OG); chrome matches the rest of
 * the dashboard. Saving goes through the Repraesent API.
 */
function settingsFromApi(raw: unknown): ReIndexSettings {
  const merged = mergeRecordWithDefaults(DEFAULT_SETTINGS, raw);
  return {
    ...merged,
    // WP stores bare codes; the form shows the full meta tags.
    verification: verificationForForm(merged.verification),
  };
}

export function ReIndexSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const [tab, setTab] = useState<TabId>("indexing");
  const {
    settings,
    setSettings,
    reseed,
    skipNextSeed,
    site,
    hasSite,
    found,
    loading,
    saving,
    dirty,
    setSavedSettings,
    loadError,
    saveMutation,
  } = useWorkspacePluginSettingsForm<ReIndexSettings>(
    pluginUuid,
    DEFAULT_SETTINGS,
    { fromApi: settingsFromApi },
  );

  const regenerateMutation = useWorkspaceReIndexRegenerateSitemap(pluginUuid);
  const regenerating = regenerateMutation.isPending;

  const sitemapUrl = sitemapUrlFromSiteUrl(site?.url);
  const hasGsc = hasVerificationCode(settings.verification.google);

  function patchSettings(updater: (prev: ReIndexSettings) => ReIndexSettings) {
    setSettings(updater);
  }

  function handleSave() {
    saveMutation.mutate(settings as unknown as Record<string, unknown>, {
      onSuccess: (data) => {
        reseed(data.settings);
        flash(t("wordpress.reIndex.saved", "Settings saved."));
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleRegenerate() {
    // Arm before the mutation cache write so a sync query re-render cannot
    // reseed the form and wipe in-progress edits.
    skipNextSeed();
    regenerateMutation.mutate(undefined, {
      onSuccess: (data) => {
        const next = mergeRecordWithDefaults(DEFAULT_SETTINGS, data.settings);
        setSettings((prev) => ({
          ...prev,
          stats: next.stats,
        }));
        // Regenerate persists new stats server-side, so fold them into the saved
        // baseline too — otherwise they'd read as unsaved edits.
        setSavedSettings((prev) => ({
          ...prev,
          stats: next.stats,
        }));
        flash(
          t(
            "wordpress.reIndex.regenerated",
            "Sitemap regenerated successfully.",
          ),
        );
      },
      onError: (err) => {
        skipNextSeed(false);
        flash(extractErrorMessage(err), "error");
      },
    });
  }

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">
          {t("wordpress.reIndex.loading", "Loading…")}
        </p>
      </PageShell>
    );
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reIndex.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PluginSettingsBackLink
        label={t("wordpress.reIndex.backToPlugins", "Back to plugins")}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              re:index
            </h1>
            <Badge variant="outline">v{PLUGIN_VERSION}</Badge>
            {dirty ? (
              <Badge
                variant="secondary"
                className="gap-1.5 font-normal text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                {t("wordpress.reIndex.unsaved", "Unsaved changes")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {site?.url
              ? site.url.replace(/^https?:\/\//i, "")
              : t(
                  "wordpress.reIndex.subtitle",
                  "Technical SEO — meta, sitemap & Search Console",
                )}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          <Save className="h-4 w-4" />
          {saving
            ? t("wordpress.reIndex.saving", "Saving…")
            : t("wordpress.reIndex.save", "Save settings")}
        </Button>
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
            "wordpress.reIndex.notConfigured",
            "No re:index options in the database yet — saving will create them.",
          )}
        </InfoNote>
      ) : null}

      <div className="grid grid-cols-2 gap-3 app-fade-up app-fade-up-d1 sm:grid-cols-4 sm:gap-4">
        <StatTile
          icon={<FileText className="h-3.5 w-3.5" />}
          label={t("wordpress.reIndex.statPages", "Pages indexed")}
          value={
            <span className="tabular-nums">{settings.stats.page_count}</span>
          }
          tone="neutral"
        />
        <StatTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label={t("wordpress.reIndex.statGenerated", "Last generated")}
          value={
            <span className="text-sm font-medium sm:text-base">
              {settings.stats.last_generated ||
                t("wordpress.reIndex.never", "Never")}
            </span>
          }
          tone="muted"
        />
        <StatTile
          icon={<Send className="h-3.5 w-3.5" />}
          label={t("wordpress.reIndex.statPing", "Last Google ping")}
          value={
            <span className="text-sm font-medium sm:text-base">
              {settings.stats.last_ping ||
                t("wordpress.reIndex.never", "Never")}
            </span>
          }
          tone="muted"
        />
        <StatTile
          icon={
            hasGsc ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <CircleSlash className="h-3.5 w-3.5" />
            )
          }
          label={t("wordpress.reIndex.statGsc", "GSC status")}
          value={
            <Badge
              variant="outline"
              className={
                hasGsc
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : undefined
              }
            >
              {hasGsc
                ? t("wordpress.reIndex.active", "Active")
                : t("wordpress.reIndex.inactive", "Inactive")}
            </Badge>
          }
          tone={hasGsc ? "positive" : "muted"}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        className="app-fade-up app-fade-up-d2 gap-4"
      >
        <TabsList
          aria-label={t("wordpress.reIndex.tabs", "re:index settings")}
        >
          <TabsTrigger value="indexing" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {t(
              "wordpress.reIndex.tabIndexing",
              "Indexing & Verification",
            )}
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            {t("wordpress.reIndex.tabSeo", "SEO & Identity")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indexing" className="mt-0">
          <IndexingPanel
            settings={settings}
            sitemapUrl={sitemapUrl}
            regenerating={regenerating}
            patchSettings={patchSettings}
            onCopied={() =>
              flash(t("wordpress.reIndex.copied", "Copied."))
            }
            onRegenerate={handleRegenerate}
          />
        </TabsContent>

        <TabsContent value="seo" className="mt-0">
          <SeoPanel settings={settings} patchSettings={patchSettings} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
