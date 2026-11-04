import { useParams, useSearchParams } from "react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Save, Search } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import type { ReIndexSettings } from "~/lib/wordpress/plugin-settings-types";
import { PluginSettingsLoadingPage, ServicePauseToggle } from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DEFAULT_SETTINGS,
  TAB_PARAM,
  flash,
  reIndexSettingsFromApi,
  tabFromParam,
} from "~/components/wordpress/re-index/constants";
import { InfoNote, PageShell } from "~/components/wordpress/fields";
import { BulkSeoBar } from "~/components/wordpress/re-index/bulk-seo-bar";
import { PageSeoPanel } from "~/components/wordpress/re-index/page-seo-panel";
import { SeoPanel } from "~/components/wordpress/re-index/seo-panel";

/**
 * re:index settings inside Repraesent: titles, descriptions, social previews
 * and per-page SEO. The sitemap and search engine verification live under
 * Website settings. Saving goes through the Repraesent API.
 */

export function ReIndexSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const pageTitle = t("wordpress.reIndex.titleFallback", "SEO Optimization");
  // The open tab lives in the URL, so a refresh (or a pasted link) reopens it.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get(TAB_PARAM));

  function selectTab(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set(TAB_PARAM, next);
        return params;
      },
      // Replace, so switching tabs doesn't stack up history entries.
      // Tab is UI state only — don't revalidate the root locale loader.
      { replace: true, preventScrollReset: true, unstable_defaultShouldRevalidate: false },
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
  } = useWorkspacePluginSettingsForm<ReIndexSettings>(
    pluginUuid,
    DEFAULT_SETTINGS,
    { fromApi: reIndexSettingsFromApi },
  );

  const overlaySaveRef = useRef<(() => Promise<void>) | null>(null);
  const [overlayDirty, setOverlayDirty] = useState(false);

  function patchSettings(updater: (prev: ReIndexSettings) => ReIndexSettings) {
    setSettings(updater);
  }

  async function handleSave() {
    const overlaySave = overlaySaveRef.current;
    if (overlaySave) {
      try {
        await overlaySave();
        flash(t("wordpress.reIndex.saved", "Settings saved."));
      } catch (err) {
        flash(extractErrorMessage(err), "error");
      }
      return;
    }
    saveMutation.mutate(settings as unknown as Record<string, unknown>, {
      onSuccess: (data) => {
        reseed(data.settings);
        flash(t("wordpress.reIndex.saved", "Settings saved."));
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
            "wordpress.reIndex.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">
              {pageTitle}
            </h1>
            {dirty || overlayDirty ? (
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
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <ServicePauseToggle
            pluginUuid={pluginUuid}
            pauseHint={t(
              "wordpress.reIndex.pauseHintTitles",
              "Switch off to pause. Your page titles, descriptions and social previews stop on your website until you switch back on. The sitemap and search engine codes in Website settings keep working. Nothing is deleted.",
            )}
          />
          <Button onClick={() => void handleSave()} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving
              ? t("wordpress.reIndex.saving", "Saving…")
              : t("wordpress.reIndex.save", "Save settings")}
          </Button>
        </div>
      </div>

      {tab !== "pages" ? (
        <BulkSeoBar settings={settings} pluginUuid={pluginUuid} />
      ) : null}

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
            "No settings saved yet — saving will create them.",
          )}
        </InfoNote>
      ) : null}


      <Tabs
        value={tab}
        onValueChange={selectTab}
        className="app-fade-up app-fade-up-d2 gap-4"
      >
        <TabsList
          aria-label={t("wordpress.reIndex.tabs", "SEO settings")}
        >
          <TabsTrigger value="seo" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            {t("wordpress.reIndex.tabSeo", "SEO & Identity")}
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t("wordpress.reIndex.tabPages", "Page SEO")}
          </TabsTrigger>
        </TabsList>


        <TabsContent value="seo" className="mt-0">
          <SeoPanel
            settings={settings}
            patchSettings={patchSettings}
            onOverlaySaveReady={(handle) => {
              overlaySaveRef.current = handle?.save ?? null;
              setOverlayDirty(handle?.dirty ?? false);
            }}
          />
        </TabsContent>

        <TabsContent value="pages" className="mt-0">
          <PageSeoPanel
            pluginUuid={pluginUuid}
            active={tab === "pages"}
            settings={settings}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
