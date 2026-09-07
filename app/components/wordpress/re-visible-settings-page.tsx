import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { requestWpSsoLogin } from "~/lib/api/wordpress-hub";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import { useResolvePluginKind } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import { useAuthContext } from "~/providers/auth-provider";
import { formatPluginSettingsTitle } from "~/lib/utils/wordpress-plugin-kind";
import {
  PluginSettingsBackLink,
  PluginSettingsLoadingPage,
  ServiceActiveToggle,
} from "~/components/wordpress/plugin-settings-chrome";
import { InfoNote, PageShell } from "~/components/wordpress/fields";
import {
  DEFAULT_SETTINGS,
  TAB_PARAM,
  flash,
  skipReason,
  tabFromParam,
  type ReVisibleSettings,
  type TabId,
} from "~/components/wordpress/re-visible/constants";
import { CompetitorsPanel } from "~/components/wordpress/re-visible/competitors-panel";
import { ContentPanel } from "~/components/wordpress/re-visible/content-panel";
import { EngineScoreCard } from "~/components/wordpress/re-visible/engine-score-card";
import { OverviewPanel } from "~/components/wordpress/re-visible/overview-panel";
import { PromptsPanel } from "~/components/wordpress/re-visible/prompts-panel";
import { SettingsPanel } from "~/components/wordpress/re-visible/settings-panel";
import { SetupWizard } from "~/components/wordpress/re-visible/setup-wizard";
import { SitePanel } from "~/components/wordpress/re-visible/site-panel";
import { SourcesPanel } from "~/components/wordpress/re-visible/sources-panel";
import {
  useAcceptVisibilityPrompts,
  useAddVisibilityPrompts,
  useCreateVisibilityProject,
  useDeleteVisibilityPrompt,
  useGenerateVisibilityPrompts,
  useRefreshVisibilitySite,
  useRunVisibilityFix,
  useRunVisibilityNow,
  useSetSuggestionStatus,
  useUpdateVisibilityProject,
  useUpdateVisibilityPrompt,
  useVisibilityCompetitors,
  useVisibilityOverview,
  useVisibilityPrompts,
  useVisibilitySite,
  useVisibilitySources,
  useVisibilitySuggestions,
  useVisibilityTrend,
} from "~/lib/hooks/useWorkspaceReVisible";
import type { PromptCandidate, PromptIntent, Suggestion } from "~/lib/api/re-visible";

/**
 * AI Analytics, inside Repraesent.
 *
 * This is the settings screen of the managed plugin `re-visible`, reached like
 * every other managed service at `/website/settings/<pluginUuid>`. It is not a
 * separate product and has no route of its own: the tabs below are the whole
 * feature.
 *
 * Two save paths live on one page, which is why the Save button only applies to
 * the WordPress options. The tracking config (brand, competitors, engines,
 * caps) saves per field, because each of those changes what the next run costs
 * and holding them behind a Save invites a client to walk away thinking a cap
 * was applied when it was not.
 */
export function ReVisibleSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const { catalogItem } = useResolvePluginKind(pluginUuid);
  const { currentWorkspace } = useAuthContext();

  const pageTitle = formatPluginSettingsTitle(
    catalogItem?.display_name,
    t("wordpress.reVisible.titleFallback", "AI Analytics"),
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get(TAB_PARAM));
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [fixingCheck, setFixingCheck] = useState<string | null>(null);

  function selectTab(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set(TAB_PARAM, next);
        return params;
      },
      // Tab is UI state only: replace so it does not stack history, and skip
      // the root locale revalidation.
      {
        replace: true,
        preventScrollReset: true,
        unstable_defaultShouldRevalidate: false,
      },
    );
  }

  /* --- WordPress options ------------------------------------------- */
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
  } = useWorkspacePluginSettingsForm<ReVisibleSettings>(
    pluginUuid,
    DEFAULT_SETTINGS,
  );

  /* --- Tracking ----------------------------------------------------- */
  const overviewQuery = useVisibilityOverview(pluginUuid, hasSite);
  const promptsQuery = useVisibilityPrompts(
    pluginUuid,
    hasSite && !!overviewQuery.data,
  );
  const trendQuery = useVisibilityTrend(
    pluginUuid,
    12,
    hasSite && !!overviewQuery.data,
  );
  const competitorsQuery = useVisibilityCompetitors(
    pluginUuid,
    hasSite && tab === "competitors",
  );
  const sourcesQuery = useVisibilitySources(
    pluginUuid,
    hasSite && tab === "sources",
  );
  const siteQuery = useVisibilitySite(pluginUuid, 30, hasSite);
  const suggestionsQuery = useVisibilitySuggestions(
    pluginUuid,
    hasSite && tab === "content",
  );

  const createProject = useCreateVisibilityProject(pluginUuid);
  const updateProject = useUpdateVisibilityProject(pluginUuid);
  const addPrompts = useAddVisibilityPrompts(pluginUuid);
  const generatePrompts = useGenerateVisibilityPrompts(pluginUuid);
  const acceptPrompts = useAcceptVisibilityPrompts(pluginUuid);
  const updatePrompt = useUpdateVisibilityPrompt(pluginUuid);
  const deletePrompt = useDeleteVisibilityPrompt(pluginUuid);
  const runNow = useRunVisibilityNow(pluginUuid);
  const refreshSite = useRefreshVisibilitySite(pluginUuid);
  const runFix = useRunVisibilityFix(pluginUuid);
  const setSuggestionStatus = useSetSuggestionStatus(pluginUuid);

  const overview = overviewQuery.data ?? null;
  const project = overview
    ? {
        id: overview.project.id,
        brand_name: overview.project.brand_name,
        brand_aliases: [] as string[],
        competitors: [] as { name: string; domains: string[] }[],
        site_domains: overview.project.site_domains,
        locale: overview.project.locale,
        country: overview.project.country,
        engines: overview.project.engines,
        runs_per_prompt: 3,
        weekly_run_cap: overview.weekly_run_cap,
        monthly_cost_cap_micro_usd: overview.monthly_cost_cap_micro_usd,
        status: overview.project.status as "active" | "paused",
        next_run_at: overview.project.next_run_at,
        last_run_at: overview.project.last_run_at,
      }
    : null;

  // Workspace admins own the fields that cost money.
  const isAdmin = currentWorkspace?.member_role === "admin";

  async function handleSave() {
    saveMutation.mutate(settings as unknown as Record<string, unknown>, {
      onSuccess: (data) => {
        reseed(data.settings);
        flash(t("wordpress.reVisible.saved", "Settings saved."));
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleProjectChange(patch: Record<string, unknown>) {
    updateProject.mutate(patch, {
      onSuccess: () => flash(t("wordpress.reVisible.updated", "Updated.")),
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleRunNow() {
    runNow.mutate(undefined, {
      onSuccess: (result) => {
        const reason = skipReason(result.skipped, t);

        if (reason) {
          // A spent budget is information, not a failure.
          flash(reason);
          return;
        }

        flash(
          t(
            "wordpress.reVisible.runComplete",
            "Asked the engines {{count}} times.",
            { count: result.runs_total },
          ),
        );
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  async function handleGenerate(): Promise<PromptCandidate[]> {
    try {
      const result = await generatePrompts.mutateAsync();

      if (!result.used_site_content) {
        flash(
          t(
            "wordpress.reVisible.generatedWithoutSite",
            "Suggested from your brand only — the site content could not be read.",
          ),
        );
      }

      return result.candidates;
    } catch (err) {
      flash(extractErrorMessage(err), "error");
      return [];
    }
  }

  async function openWordPress(path: string) {
    try {
      const url = await requestWpSsoLogin({ redirect: path });
      // Full navigation, not a fetch: WordPress has to set its auth cookie on
      // its own domain.
      window.location.href = url;
    } catch (err) {
      flash(extractErrorMessage(err), "error");
    }
  }

  if (loading) {
    return <PluginSettingsLoadingPage />;
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reVisible.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="lg">
      <PluginSettingsBackLink
        label={t("wordpress.reVisible.backToWebsite", "Back to website")}
      />

      <div className="app-fade-up flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {pageTitle}
            </h1>
            {dirty ? (
              <Badge
                variant="secondary"
                className="gap-1.5 font-normal text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                {t("wordpress.reVisible.unsaved", "Unsaved changes")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {site?.url
              ? site.url.replace(/^https?:\/\//i, "")
              : t(
                  "wordpress.reVisible.subtitle",
                  "Whether AI search engines cite this site",
                )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <ServiceActiveToggle pluginUuid={pluginUuid} name={pageTitle} />
          {tab === "settings" ? (
            <Button onClick={() => void handleSave()} disabled={saving}>
              <Save className="size-4" aria-hidden />
              {saving
                ? t("wordpress.reVisible.saving", "Saving…")
                : t("wordpress.reVisible.save", "Save settings")}
            </Button>
          ) : null}
        </div>
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
            "wordpress.reVisible.notConfigured",
            "The plugin has not saved its settings on the site yet — saving here will create them.",
          )}
        </InfoNote>
      ) : null}

      <Tabs value={tab} onValueChange={selectTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">
            {t("wordpress.reVisible.tabOverview", "Overview")}
          </TabsTrigger>
          <TabsTrigger value="prompts">
            {t("wordpress.reVisible.tabPrompts", "Questions")}
          </TabsTrigger>
          <TabsTrigger value="competitors">
            {t("wordpress.reVisible.tabCompetitors", "Competitors")}
          </TabsTrigger>
          <TabsTrigger value="sources">
            {t("wordpress.reVisible.tabSources", "Sources")}
          </TabsTrigger>
          <TabsTrigger value="content">
            {t("wordpress.reVisible.tabContent", "Content")}
          </TabsTrigger>
          <TabsTrigger value="site">
            {t("wordpress.reVisible.tabSite", "Site")}
          </TabsTrigger>
          <TabsTrigger value="settings">
            {t("wordpress.reVisible.tabSettings", "Settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {overviewQuery.isPending ? (
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          ) : !overview ? (
            <SetupWizard
              defaultBrandName={settings.entity.name || settings.site.site_title}
              defaultLocale={settings.site.site_url ? "en" : "en"}
              creating={createProject.isPending}
              onCreate={(input) => {
                createProject.mutate(input, {
                  onSuccess: () => {
                    flash(
                      t(
                        "wordpress.reVisible.setupDone",
                        "Set up. Now add the questions to track.",
                      ),
                    );
                    selectTab("prompts");
                  },
                  onError: (err) => flash(extractErrorMessage(err), "error"),
                });
              }}
            />
          ) : (
            <OverviewPanel
              overview={overview}
              trend={trendQuery.data?.weeks ?? []}
              trendLoading={trendQuery.isPending}
              onRunNow={handleRunNow}
              running={runNow.isPending}
              canRun={overview.prompts_active > 0}
              onOpenPrompt={(promptId) => {
                setOpenPromptId(promptId);
                selectTab("prompts");
              }}
              onGoToSources={() => selectTab("sources")}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overview.engines.map((rates) => (
                  <EngineScoreCard key={rates.engine} rates={rates} />
                ))}
              </div>
            </OverviewPanel>
          )}
        </TabsContent>

        <TabsContent value="prompts" className="mt-6">
          {!overview ? (
            <NeedsSetup onGo={() => selectTab("overview")} />
          ) : (
            <PromptsPanel
              pluginUuid={pluginUuid}
              prompts={promptsQuery.data?.prompts ?? []}
              loading={promptsQuery.isPending}
              openPromptId={openPromptId}
              onOpenPrompt={setOpenPromptId}
              onAdd={(text, intent: PromptIntent) =>
                addPrompts.mutate([{ text, intent }], {
                  onError: (err) => flash(extractErrorMessage(err), "error"),
                })
              }
              onUpdate={(promptId, patch) =>
                updatePrompt.mutate(
                  { promptId, ...patch },
                  {
                    onError: (err) => flash(extractErrorMessage(err), "error"),
                  },
                )
              }
              onDelete={(promptId) =>
                deletePrompt.mutate(promptId, {
                  onError: (err) => flash(extractErrorMessage(err), "error"),
                })
              }
              onGenerate={handleGenerate}
              onAccept={(candidates) =>
                acceptPrompts.mutate(candidates, {
                  onSuccess: (result) =>
                    flash(
                      t(
                        "wordpress.reVisible.promptsAdded",
                        "Added {{count}} questions.",
                        { count: result.added },
                      ),
                    ),
                  onError: (err) => flash(extractErrorMessage(err), "error"),
                })
              }
              generating={generatePrompts.isPending}
              saving={
                addPrompts.isPending ||
                acceptPrompts.isPending ||
                updatePrompt.isPending ||
                deletePrompt.isPending
              }
            />
          )}
        </TabsContent>

        <TabsContent value="competitors" className="mt-6">
          {!overview ? (
            <NeedsSetup onGo={() => selectTab("overview")} />
          ) : (
            <CompetitorsPanel
              data={competitorsQuery.data}
              loading={competitorsQuery.isPending}
              configured={(project?.competitors ?? []).map((c) => c.name)}
              saving={updateProject.isPending}
              onAddCompetitor={(name) =>
                handleProjectChange({
                  competitors: [
                    ...(project?.competitors ?? []),
                    { name, domains: [] },
                  ],
                })
              }
            />
          )}
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          {!overview ? (
            <NeedsSetup onGo={() => selectTab("overview")} />
          ) : (
            <SourcesPanel
              data={sourcesQuery.data}
              loading={sourcesQuery.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <ContentPanel
            suggestions={suggestionsQuery.data?.suggestions ?? []}
            loading={suggestionsQuery.isPending}
            saving={setSuggestionStatus.isPending}
            onSetStatus={(suggestionId, status: Suggestion["status"]) =>
              setSuggestionStatus.mutate(
                { suggestionId, status },
                { onError: (err) => flash(extractErrorMessage(err), "error") },
              )
            }
            onOpenWordPress={() => void openWordPress("/wp-admin/edit.php?post_type=page")}
          />
        </TabsContent>

        <TabsContent value="site" className="mt-6">
          <SitePanel
            data={siteQuery.data}
            loading={siteQuery.isPending}
            refreshing={refreshSite.isPending}
            fixing={fixingCheck}
            onRefresh={() =>
              refreshSite.mutate(undefined, {
                onSuccess: () =>
                  flash(t("wordpress.reVisible.rechecked", "Site re-checked.")),
                onError: (err) => flash(extractErrorMessage(err), "error"),
              })
            }
            onFix={(checkId) => {
              setFixingCheck(checkId);
              runFix.mutate(checkId, {
                onSuccess: () =>
                  flash(t("wordpress.reVisible.fixApplied", "Fixed.")),
                onError: (err) => flash(extractErrorMessage(err), "error"),
                onSettled: () => setFixingCheck(null),
              });
            }}
            onOpenWordPress={() => void openWordPress("/wp-admin/admin.php?page=re-visible")}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsPanel
            settings={settings}
            onSettingsChange={setSettings}
            project={project}
            onProjectChange={handleProjectChange}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function NeedsSetup({ onGo }: { onGo: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border bg-muted/30 px-4 py-6 text-center">
      <p className="text-sm text-muted-foreground">
        {t(
          "wordpress.reVisible.needsSetup",
          "Set up AI Analytics first to see this.",
        )}
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onGo}>
        {t("wordpress.reVisible.goToSetup", "Go to setup")}
      </Button>
    </div>
  );
}

export type { TabId };
