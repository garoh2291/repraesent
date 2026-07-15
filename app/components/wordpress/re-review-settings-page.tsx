import { useTranslation } from "react-i18next";
import {
  Clock,
  Copy,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import {
  useWorkspaceReReviewClearCache,
  useWorkspaceReReviewTestFetch,
} from "~/lib/hooks/useWorkspaceReReviewSettings";
import type { ReReviewSettings } from "~/lib/wordpress/plugin-settings-types";
import { PluginSettingsBackLink } from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  DEFAULT_SETTINGS,
  PLUGIN_VERSION,
  SHORTCODE_ATTRS,
  SHORTCODE_EXAMPLES,
  flash,
} from "~/components/wordpress/re-review/constants";
import {
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  PageShell,
  SectionCard,
  StatTile,
} from "~/components/wordpress/fields";
import { cn } from "~/lib/utils";

/**
 * re:reviews settings inside Repraesent. Behavior matches the WordPress
 * plugin admin (Place ID, cache TTL, test fetch, clear cache, shortcode docs).
 */
export function ReReviewSettingsPage() {
  const { t } = useTranslation();
  const {
    settings,
    setSettings,
    reseed: applySettings,
    site,
    hasSite,
    loading,
    saving,
    dirty,
    loadError,
    saveMutation,
  } = useWorkspacePluginSettingsForm<ReReviewSettings>(
    "re-review",
    DEFAULT_SETTINGS,
  );

  const testFetchMutation = useWorkspaceReReviewTestFetch();
  const clearCacheMutation = useWorkspaceReReviewClearCache();
  const testing = testFetchMutation.isPending;
  const clearing = clearCacheMutation.isPending;

  function handleSave() {
    // Only the two writable options go up; everything else on this screen is
    // server-derived cache diagnostics.
    saveMutation.mutate(
      {
        place_id: settings.place_id,
        cache_ttl: settings.cache_ttl,
      },
      {
        onSuccess: (data) => {
          applySettings(data.settings);
          flash(t("wordpress.reReview.saved", "Settings saved."));
        },
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  function handleTestFetch() {
    testFetchMutation.mutate(undefined, {
      onSuccess: (data) => {
        applySettings(data.settings);
        flash(
          data.message ||
            t("wordpress.reReview.fetched", "Fetched rating successfully."),
        );
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleClearCache() {
    clearCacheMutation.mutate(undefined, {
      onSuccess: (data) => {
        applySettings(data.settings);
        flash(
          data.message ||
            t("wordpress.reReview.cacheCleared", "Cache cleared."),
        );
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function copyShortcode(value: string) {
    void navigator.clipboard.writeText(value).then(
      () => flash(t("wordpress.reReview.copied", "Copied.")),
      () => flash(t("wordpress.reReview.copyFailed", "Could not copy."), "error"),
    );
  }

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">
          {t("wordpress.reReview.loading", "Loading…")}
        </p>
      </PageShell>
    );
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reReview.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  const { cache } = settings;
  const ratingDisplay =
    cache.rating != null ? Number(cache.rating).toFixed(1) : "—";
  const countDisplay =
    cache.review_count != null
      ? Number(cache.review_count).toLocaleString()
      : "—";
  const ttlDisplay = `${settings.cache_ttl}h`;
  const canTest = Boolean(settings.place_id.trim()) && !testing;
  const canClear = cache.present && !clearing;

  return (
    <PageShell>
      <PluginSettingsBackLink
        label={t("wordpress.reReview.backToPlugins", "Back to plugins")}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              re:reviews
            </h1>
            <Badge variant="outline">v{PLUGIN_VERSION}</Badge>
            <Badge
              variant="outline"
              className={cn(
                settings.is_configured
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : undefined,
              )}
            >
              {settings.is_configured
                ? t("wordpress.reReview.connected", "Connected")
                : t("wordpress.reReview.notConfiguredBadge", "Not configured")}
            </Badge>
            {dirty ? (
              <Badge
                variant="secondary"
                className="gap-1.5 font-normal text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                {t("wordpress.reReview.unsaved", "Unsaved changes")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {site?.url
              ? site.url.replace(/^https?:\/\//i, "")
              : t(
                  "wordpress.reReview.subtitle",
                  "Google Business star ratings via [gmb_stars]",
                )}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          <Save className="h-4 w-4" />
          {saving
            ? t("wordpress.reReview.saving", "Saving…")
            : t("wordpress.reReview.save", "Save settings")}
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

      <div className="grid grid-cols-2 gap-3 app-fade-up app-fade-up-d1 sm:grid-cols-4 sm:gap-4">
        <StatTile
          icon={<Star className="h-3.5 w-3.5" />}
          label={t("wordpress.reReview.statRating", "Rating")}
          value={<span className="tabular-nums">{ratingDisplay}</span>}
          tone={cache.present ? "positive" : "neutral"}
        />
        <StatTile
          icon={<Users className="h-3.5 w-3.5" />}
          label={t("wordpress.reReview.statReviews", "Reviews")}
          value={<span className="tabular-nums">{countDisplay}</span>}
          tone={cache.present ? "positive" : "neutral"}
        />
        <StatTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label={t("wordpress.reReview.statTtl", "Cache TTL")}
          value={<span className="tabular-nums">{ttlDisplay}</span>}
          tone="neutral"
        />
        <StatTile
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          label={t("wordpress.reReview.statLastFetched", "Last fetched")}
          value={
            <span className="text-sm font-medium">
              {cache.last_fetched_display || "—"}
            </span>
          }
          tone="muted"
        />
      </div>

      <div className="grid gap-4 app-fade-up app-fade-up-d1 lg:grid-cols-2">
        <SectionCard>
          <CardHeader
            title={t(
              "wordpress.reReview.connectionTitle",
              "Google Places connection",
            )}
            subtitle={t(
              "wordpress.reReview.connectionSubtitle",
              "Target a specific business listing",
            )}
          />
          <div className="space-y-4 p-5 sm:p-6">
            <Field>
              <Label htmlFor="re-review-place-id">
                {t("wordpress.reReview.placeId", "Place ID")}
              </Label>
              <FieldHint>
                {t(
                  "wordpress.reReview.placeIdHint",
                  "Look it up with the Place ID Finder from Google.",
                )}{" "}
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {t("wordpress.reReview.placeIdLink", "Place ID Finder")}
                </a>
              </FieldHint>
              <Input
                id="re-review-place-id"
                value={settings.place_id}
                placeholder="ChIJ…"
                onChange={(e) =>
                  setSettings((p) => ({ ...p, place_id: e.target.value }))
                }
              />
            </Field>
            <Field>
              <Label htmlFor="re-review-cache-ttl">
                {t(
                  "wordpress.reReview.cacheTtl",
                  "Cache duration (hours)",
                )}
              </Label>
              <FieldHint>
                {t(
                  "wordpress.reReview.cacheTtlHint",
                  "How long to cache the rating before fetching again. Default 12 hours.",
                )}
              </FieldHint>
              <Input
                id="re-review-cache-ttl"
                type="number"
                min={1}
                max={720}
                className="max-w-40"
                value={settings.cache_ttl}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setSettings((p) => ({
                    ...p,
                    cache_ttl: Number.isFinite(n)
                      ? Math.max(1, Math.min(720, n))
                      : p.cache_ttl,
                  }));
                }}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard>
          <CardHeader
            title={t(
              "wordpress.reReview.cacheTitle",
              "Cache & diagnostics",
            )}
            subtitle={t(
              "wordpress.reReview.cacheSubtitle",
              "Force a live fetch or wipe the cached rating",
            )}
          />
          <div className="space-y-4 p-5 sm:p-6">
            {cache.present ? (
              <div className="rounded-xl border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {t("wordpress.reReview.cachedBusiness", "Cached business")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {cache.business_name || "—"}
                </p>
                {cache.url ? (
                  <a
                    href={cache.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {cache.url}
                  </a>
                ) : null}
              </div>
            ) : (
              <InfoNote>
                {t(
                  "wordpress.reReview.noCache",
                  "No cached data yet. Save your settings, then run a test fetch.",
                )}
              </InfoNote>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canTest}
                onClick={handleTestFetch}
              >
                <RefreshCw
                  className={cn("h-4 w-4", testing && "animate-spin")}
                />
                {testing
                  ? t("wordpress.reReview.testing", "Fetching…")
                  : t("wordpress.reReview.testFetch", "Test fetch now")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canClear}
                onClick={handleClearCache}
              >
                <Trash2 className="h-4 w-4" />
                {clearing
                  ? t("wordpress.reReview.clearing", "Clearing…")
                  : t("wordpress.reReview.clearCache", "Clear cache")}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="app-fade-up app-fade-up-d2">
        <CardHeader
          title={t(
            "wordpress.reReview.shortcodeTitle",
            "Shortcode reference",
          )}
          subtitle={t(
            "wordpress.reReview.shortcodeSubtitle",
            "Drop the shortcode anywhere — page, post, widget, or template via do_shortcode().",
          )}
        />
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg border bg-muted/40 px-3 py-1.5 font-mono text-sm">
              [gmb_stars]
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyShortcode("[gmb_stars]")}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("wordpress.reReview.copy", "Copy")}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-lg text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("wordpress.reReview.attr", "Attribute")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("wordpress.reReview.default", "Default")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("wordpress.reReview.description", "Description")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SHORTCODE_ATTRS.map((row) => (
                  <tr key={row.attr} className="border-b last:border-0">
                    <td className="px-3 py-2.5 align-top">
                      <code className="font-mono text-xs">{row.attr}</code>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <code className="font-mono text-xs text-muted-foreground">
                        {row.default}
                      </code>
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground">
                      {t(
                        `wordpress.reReview.shortcodeAttrs.${row.attr}`,
                        row.description,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("wordpress.reReview.examples", "Examples")}
            </p>
            <ul className="space-y-2">
              {SHORTCODE_EXAMPLES.map((ex) => (
                <li key={ex} className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs">
                    {ex}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => copyShortcode(ex)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
