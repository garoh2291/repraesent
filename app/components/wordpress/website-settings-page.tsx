import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Clock,
  Code2,
  Cookie,
  FileText,
  Save,
  Search,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import { useWorkspacePluginPause } from "~/lib/hooks/useWorkspacePluginPause";
import { useWorkspaceReIndexRegenerateSitemap } from "~/lib/hooks/useWorkspaceReIndexSettings";
import { useWorkspaceWpPluginCatalog } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import { useWorkspaceWpPluginInstalls } from "~/lib/hooks/useWorkspaceWpPluginInstalls";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import {
  useWorkspaceWpSites,
  useWpSitesHosting,
} from "~/lib/hooks/useWorkspaceWpSites";
import type {
  ReCookieConsentMode,
  ReCookieSettings,
  ReIndexSettings,
} from "~/lib/wordpress/plugin-settings-types";
import { mergeRecordWithDefaults } from "~/lib/utils/deep-merge";
import { wordpressPluginSettingsPath } from "~/lib/utils/wordpress-plugin-kind";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { PluginSettingsLoadingPage } from "~/components/wordpress/plugin-settings-chrome";
import {
  CardBody,
  CardHeader,
  InfoNote,
  PageShell,
  SectionCard,
  StatTile,
} from "~/components/wordpress/fields";
import { DEFAULTS as COOKIE_DEFAULTS } from "~/components/wordpress/re-cookie/constants";
import {
  ID_INPUT,
  PROVIDER_LABEL,
  describeRejectedIds,
  invalidTrackingIds,
} from "~/components/wordpress/re-cookie/tracking-ids";
import { TrackingIntegrations } from "~/components/wordpress/re-cookie/tracking-tags";
import { WebsiteCodePanel } from "~/components/wordpress/website-code-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DEFAULT_SETTINGS as INDEX_DEFAULTS,
  flash,
  reIndexSettingsFromApi,
  sitemapUrlFromSiteUrl,
} from "~/components/wordpress/re-index/constants";
import {
  SitemapPanel,
  VerificationPanel,
} from "~/components/wordpress/re-index/indexing-panel";
import {
  NotHostedNotice,
  WebsiteSitePicker,
} from "~/components/wordpress/website-site-picker";

/**
 * Website settings: what belongs to the website rather than to one service,
 * in four tabs (`?tab=tracking|code|sitemap|verification`, so a refresh
 * reopens the tab).
 * One Save button above them saves every tab.
 *
 * - Tracking: Google & Meta tags, added to the site by re:cookie. Whether visitors are asked
 *   first (the cookie banner) is one choice here; the banner's look stays on
 *   the Cookie banner screen. Both screens edit the same `re_cookie_settings`
 *   row, so a tag added here is the tag the banner lists.
 * - Code: the customer's own code with its place on the page (re:cookie named
 *   scripts); only workspace admins may change it.
 * - Sitemap and Site verification: served by re:index but not paused with the
 *   SEO service.
 *
 * Saving writes only those slices (`consent_mode` + `integrations`,
 * `verification`), never the services' other settings.
 */
export function WebsiteSettingsPage() {
  const { t } = useTranslation();
  const catalog = useWorkspaceWpPluginCatalog();
  const siteQuery = useWorkspaceWpSite(true);
  // Started here, alongside the settings, so the picker in the header is ready
  // when the page is rather than appearing after it.
  useWorkspaceWpSites(true);
  const isElsewhere = useWpSitesHosting(!!siteQuery.data);
  // A site we don't host has nothing to read here: don't ask, explain instead.
  const elsewhere = isElsewhere(siteQuery.data?.id);
  const pluginUuid = (name: string) =>
    elsewhere ? "" : (catalog.data?.find((p) => p.name === name)?.id ?? "");
  const cookieUuid = pluginUuid("re-cookie");
  const indexUuid = pluginUuid("re-index");

  const cookie = useWorkspacePluginSettingsForm<ReCookieSettings>(
    cookieUuid,
    COOKIE_DEFAULTS,
  );
  const index = useWorkspacePluginSettingsForm<ReIndexSettings>(
    indexUuid,
    INDEX_DEFAULTS,
    { fromApi: reIndexSettingsFromApi },
  );
  const installs = useWorkspaceWpPluginInstalls(siteQuery.data?.id);
  const cookiePause = useWorkspacePluginPause(cookieUuid);
  const regenerate = useWorkspaceReIndexRegenerateSitemap(indexUuid);
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const cookieInstall =
    installs.data?.plugins.find((p) => p.name === "re-cookie") ?? null;
  // A site already running the banner keeps asking until someone says
  // otherwise; a site that never had it doesn't get one just by adding a tag.
  const consentMode: ReCookieConsentMode =
    cookie.settings.consent_mode ?? (cookieInstall ? "ask" : "off");

  const site = cookie.site;
  const sitemapUrl = sitemapUrlFromSiteUrl(site?.url);
  const plausible = index.settings.plausible;
  const dirty = cookie.dirty || index.dirty;
  // Which tabs hold the unsaved changes, for the dot on each tab.
  const codeDirty =
    JSON.stringify(cookie.settings.integrations.named_scripts) !==
    JSON.stringify(cookie.savedSettings.integrations.named_scripts);
  const trackingDirty =
    cookie.dirty &&
    ((cookie.settings.consent_mode ?? null) !==
      (cookie.savedSettings.consent_mode ?? null) ||
      JSON.stringify({ ...cookie.settings.integrations, named_scripts: null }) !==
        JSON.stringify({ ...cookie.savedSettings.integrations, named_scripts: null }));

  function setConsentMode(next: ReCookieConsentMode) {
    cookie.setSettings((prev) => ({ ...prev, consent_mode: next }));
  }

  async function handleSave() {
    // WordPress keeps the old ID when a new one has the wrong shape, so the
    // typed value would be lost: save nothing until it's fixed.
    const invalid = cookie.dirty ? invalidTrackingIds(cookie.settings) : [];
    if (invalid.length > 0) {
      selectTab("tracking");
      flash(
        t(
          "wordpress.websiteSettings.fixIdsFirst",
          "Nothing was saved. Check the {{names}} ID: the red note under it says what it should look like.",
          { names: invalid.map((p) => PROVIDER_LABEL[p]).join(", ") },
        ),
        "error",
      );
      // After the tab switch renders, put the cursor in the first bad field.
      requestAnimationFrame(() => {
        const field = document.getElementById(ID_INPUT[invalid[0]]);
        field?.focus();
        field?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setSaving(true);
    const errors: string[] = [];
    try {
      if (cookie.dirty) {
        const submitted = { ...cookie.settings, consent_mode: consentMode };
        try {
          const data = await cookie.saveMutation.mutateAsync({
            consent_mode: consentMode,
            integrations: submitted.integrations,
          });
          const applied = cookie.reseed(data.settings);
          errors.push(...describeRejectedIds(submitted, applied));
        } catch (err) {
          errors.push(extractErrorMessage(err));
        }
      }
      if (index.dirty) {
        try {
          const data = await index.saveMutation.mutateAsync({
            verification: index.settings.verification,
          });
          index.reseed(data.settings);
        } catch (err) {
          errors.push(extractErrorMessage(err));
        }
      }
    } finally {
      setSaving(false);
    }
    if (errors.length > 0) flash(errors.join(" "), "error");
    else flash(t("wordpress.websiteSettings.saved", "Website settings saved."));
  }

  function handleRegenerate() {
    // Arm before the mutation writes the cache, so the open form isn't reseeded.
    index.skipNextSeed();
    regenerate.mutate(undefined, {
      onSuccess: (data) => {
        const next = mergeRecordWithDefaults(INDEX_DEFAULTS, data.settings);
        index.setSettings((prev) => ({ ...prev, stats: next.stats }));
        index.setSavedSettings((prev) => ({ ...prev, stats: next.stats }));
        flash(
          t(
            "wordpress.reIndex.regenerated",
            "Sitemap regenerated successfully.",
          ),
        );
      },
      onError: (err) => {
        index.skipNextSeed(false);
        flash(extractErrorMessage(err), "error");
      },
    });
  }

  // Full-page skeleton only for the first paint. A site switch sets the open
  // site at once, so from then on the header (and its picker) stays put and
  // only the content below reloads.
  if (catalog.isLoading || siteQuery.isLoading) {
    return <PluginSettingsLoadingPage />;
  }

  if (!siteQuery.data) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.websiteSettings.noSite",
            "Your website isn't connected here yet. Once it is, its tracking tags and search engine settings show up here.",
          )}
        </div>
      </PageShell>
    );
  }

  const openSite = siteQuery.data;
  // The installed-services list keeps the previous site's rows on screen while
  // the new one loads; the banner default depends on it, so wait for it too.
  const bodyLoading =
    !elsewhere &&
    (cookie.loading ||
      index.loading ||
      installs.isLoading ||
      installs.isPlaceholderData);
  const loadError =
    cookie.loadError ??
    index.loadError ??
    (catalog.isError ? extractErrorMessage(catalog.error) : null);

  // Only the tabs whose service the site has; an unknown ?tab= opens the first.
  const tabs: SettingsTab[] = [
    ...(cookieUuid ? (["tracking", "code"] as const) : []),
    ...(indexUuid ? (["sitemap", "verification"] as const) : []),
  ];
  // `search` was the one tab both used to share; old links open the sitemap.
  const rawTab = searchParams.get("tab");
  const asked = (rawTab === "search" ? "sitemap" : rawTab) as SettingsTab | null;
  const tab: SettingsTab = asked && tabs.includes(asked) ? asked : (tabs[0] ?? "tracking");

  function selectTab(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("tab", next);
        return params;
      },
      // Replace, so switching tabs doesn't stack up history entries.
      // Tab is UI state only — don't revalidate the root locale loader.
      { replace: true, preventScrollReset: true, unstable_defaultShouldRevalidate: false },
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">
              {t("wordpress.websiteSettings.title", "Website settings")}
            </h1>
            {dirty && !bodyLoading ? (
              <Badge
                variant="secondary"
                className="gap-1.5 font-normal text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                {t("wordpress.websiteSettings.unsaved", "Unsaved changes")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "wordpress.websiteSettings.subtitleTabs",
              "Tracking tags, your own code and search engines for your whole website.",
            )}
          </p>
          <div className="mt-2 max-w-full">
            {/* Locked while writing: the answer belongs to the site it was
                sent to, and must not land in the next site's form. */}
            <WebsiteSitePicker
              dirty={dirty}
              busy={saving || regenerate.isPending}
            />
          </div>
        </div>
        {elsewhere ? null : (
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !dirty || bodyLoading}
            className="shrink-0 max-sm:h-11 max-sm:w-full"
          >
            {saving ? <Spinner className="size-4" /> : <Save className="size-4" />}
            {saving
              ? t("wordpress.websiteSettings.saving", "Saving…")
              : t("wordpress.websiteSettings.save", "Save")}
          </Button>
        )}
      </div>

      {elsewhere ? (
        <NotHostedNotice site={openSite} showPicker={false} />
      ) : bodyLoading ? (
        <BodySkeleton />
      ) : (
        <>

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {tabs.length > 0 ? (
        <Tabs
          value={tab}
          onValueChange={selectTab}
          className="app-fade-up app-fade-up-d1 gap-4"
        >
          {/* Four tabs don't fit one row on a phone: two by two there. */}
          <TabsList
            aria-label={t("wordpress.websiteSettings.tabs", "Website settings")}
            className="max-w-full max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:gap-1 max-sm:group-data-[orientation=horizontal]/tabs:h-auto"
          >
            {cookieUuid ? (
              <TabsTrigger value="tracking" className="gap-1.5 max-sm:h-11">
                <Tag className="h-3.5 w-3.5" />
                {t("wordpress.websiteSettings.tabTracking", "Tracking")}
                <DirtyDot show={trackingDirty} />
              </TabsTrigger>
            ) : null}
            {cookieUuid ? (
              <TabsTrigger value="code" className="gap-1.5 max-sm:h-11">
                <Code2 className="h-3.5 w-3.5" />
                {t("wordpress.websiteSettings.tabCode", "Code")}
                <DirtyDot show={codeDirty} />
              </TabsTrigger>
            ) : null}
            {indexUuid ? (
              <TabsTrigger value="sitemap" className="gap-1.5 max-sm:h-11">
                <Search className="h-3.5 w-3.5" />
                {t("wordpress.websiteSettings.tabSitemap", "Sitemap")}
              </TabsTrigger>
            ) : null}
            {indexUuid ? (
              <TabsTrigger value="verification" className="gap-1.5 max-sm:h-11">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("wordpress.websiteSettings.tabVerification", "Site verifications")}
                <DirtyDot show={index.dirty} />
              </TabsTrigger>
            ) : null}
          </TabsList>

          {cookieUuid ? (
            <TabsContent value="tracking" className="mt-0 space-y-4">
              <SectionCard>
                <CardHeader
                  icon={<Cookie className="size-4" />}
                  title={t(
                    "wordpress.websiteSettings.consentTitle",
                    "Ask visitors first?",
                  )}
                  subtitle={t(
                    "wordpress.websiteSettings.consentSubtitle",
                    "Decide whether the cookie banner asks before these tags load.",
                  )}
                />
                <CardBody className="space-y-4">
                  <div
                    role="radiogroup"
                    aria-label={t(
                      "wordpress.websiteSettings.consentTitle",
                      "Ask visitors first?",
                    )}
                    className="grid gap-3 md:grid-cols-3"
                  >
                    <ConsentOption
                      selected={consentMode === "ask"}
                      onSelect={() => setConsentMode("ask")}
                      title={t(
                        "wordpress.websiteSettings.consentAsk",
                        "Yes, show the cookie banner",
                      )}
                      description={t(
                        "wordpress.websiteSettings.consentAskDesc",
                        "Tags wait until a visitor agrees.",
                      )}
                    />
                    <ConsentOption
                      selected={consentMode === "region"}
                      onSelect={() => setConsentMode("region")}
                      title={t(
                        "wordpress.websiteSettings.consentRegion",
                        "Only for visitors in Europe",
                      )}
                      description={t(
                        "wordpress.websiteSettings.consentRegionDesc",
                        "Visitors in Europe see the banner. Everyone else gets the tags right away.",
                      )}
                    />
                    <ConsentOption
                      selected={consentMode === "off"}
                      onSelect={() => setConsentMode("off")}
                      title={t(
                        "wordpress.websiteSettings.consentOff",
                        "No, load tags right away",
                      )}
                      description={t(
                        "wordpress.websiteSettings.consentOffDesc",
                        "No cookie banner. Every tag loads for every visitor.",
                      )}
                    />
                  </div>

                  {cookiePause.query.data?.paused ? (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                      {t(
                        "wordpress.websiteSettings.cookiePaused",
                        "The cookie banner service is paused, so none of these tags load right now. Switch it back on on the cookie banner page.",
                      )}
                    </p>
                  ) : null}

                  {consentMode === "region" ? (
                    <InfoNote>
                      {t(
                        "wordpress.websiteSettings.consentRegionNote",
                        "We check the visitor's IP address against a country list kept on your website's server, so nothing is sent to anyone else. If it's in Europe, or we can't tell, the banner shows. If your business is in the EU, the rules may cover all your visitors; then keep the banner for everyone.",
                      )}
                    </InfoNote>
                  ) : null}

                  {consentMode === "off" ? (
                    <InfoNote>
                      {t(
                        "wordpress.websiteSettings.consentOffNote",
                        "In the EU, tags that set cookies (Google Analytics, Google Ads, Meta Pixel) usually need a visitor's consent. Choose this only if your privacy setup covers it.",
                      )}
                    </InfoNote>
                  ) : cookieInstall ? (
                    <InfoNote>
                      {t(
                        "wordpress.websiteSettings.bannerLookPrefix",
                        "To change the banner's look and wording, open",
                      )}{" "}
                      <Link
                        to={wordpressPluginSettingsPath(cookieInstall.plugin_uuid)}
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        {cookieInstall.display_name}
                      </Link>
                      .
                    </InfoNote>
                  ) : (
                    <InfoNote>
                      {t(
                        "wordpress.websiteSettings.bannerStandard",
                        "The banner uses standard wording. To change its look and text, ask us about the cookie banner service.",
                      )}
                    </InfoNote>
                  )}
                </CardBody>
              </SectionCard>

              <SectionCard>
                <CardHeader
                  icon={<Tag className="size-4" />}
                  title={t("wordpress.websiteSettings.googleMetaTitle", "Google & Meta")}
                  subtitle={t(
                    "wordpress.websiteSettings.googleMetaSubtitle",
                    "Paste the ID and switch it on.",
                  )}
                />
                <CardBody>
                  <TrackingIntegrations
                    settings={cookie.settings}
                    patch={cookie.setSettings}
                  />
                </CardBody>
              </SectionCard>

            </TabsContent>
          ) : null}

          {cookieUuid ? (
            <TabsContent value="code" className="mt-0 space-y-4">
              {plausible?.enabled ? <PlausibleRow /> : null}
              <WebsiteCodePanel
                siteId={openSite.id}
                settings={cookie.settings}
                patch={cookie.setSettings}
                consentMode={consentMode}
                bannerPaused={!!cookiePause.query.data?.paused}
                plausibleOn={!!plausible?.enabled}
              />
            </TabsContent>
          ) : null}

          {indexUuid ? (
            <TabsContent value="sitemap" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <StatTile
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label={t("wordpress.reIndex.statPagesInSitemap", "Pages in sitemap")}
                  value={
                    <span className="tabular-nums">
                      {index.settings.stats.page_count}
                    </span>
                  }
                  tone="neutral"
                />
                <StatTile
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label={t("wordpress.reIndex.statGenerated", "Last generated")}
                  value={
                    <span className="text-sm font-medium sm:text-base">
                      {index.settings.stats.last_generated ||
                        t("wordpress.reIndex.never", "Never")}
                    </span>
                  }
                  tone="muted"
                />
              </div>

              <SitemapPanel
                sitemapUrl={sitemapUrl}
                regenerating={regenerate.isPending}
                onCopied={() => flash(t("wordpress.reIndex.copied", "Copied."))}
                onRegenerate={handleRegenerate}
              />
            </TabsContent>
          ) : null}

          {indexUuid ? (
            <TabsContent value="verification" className="mt-0 space-y-4">
              <VerificationPanel
                settings={index.settings}
                patchSettings={index.setSettings}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : loadError ? null : (
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.websiteSettings.noServices",
            "There's nothing to set here yet. Tracking tags and search engine settings show up once your website has the cookie banner or the SEO service. Ask us to add them.",
          )}
        </div>
      )}
        </>
      )}
    </PageShell>
  );
}

type SettingsTab = "tracking" | "code" | "sitemap" | "verification";

/** Marks a tab that holds unsaved changes. */
function DirtyDot({ show }: { show: boolean }) {
  if (!show) return null;
  return <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />;
}

/** Stand-in for the sections while the open site's settings load. */
function BodySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <div className="space-y-2 border-b p-5">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-3 p-5">
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConsentOption({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-foreground/40 bg-primary/[0.04]"
          : "bg-card hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-foreground" : "border-muted-foreground/40",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-foreground" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

/** Repraesent's own visitor statistics: shown, not editable — staff set it up. */
function PlausibleRow() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/20 px-4 py-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <BarChart3 className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {t("wordpress.websiteSettings.plausibleTitle", "Visitor statistics")}
          </span>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          >
            {t("wordpress.websiteSettings.plausibleOn", "On")}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {t(
            "wordpress.websiteSettings.plausibleDesc",
            "Set up by Repraesent for your Results page. It counts visits without cookies, so it always loads and the cookie banner lists it under Always on.",
          )}
        </p>
      </div>
    </div>
  );
}
