import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, FlaskConical, Globe, LogIn, ShieldAlert } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import {
  useSwitchWpSite,
  useWorkspaceWpSites,
} from "~/lib/hooks/useWorkspaceWpSites";
import { requestWpSsoLogin, type WorkspaceWpSite } from "~/lib/api/wordpress-hub";
import { WEBSITE_STAGING_PATH } from "~/lib/utils/wordpress-plugin-kind";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Button } from "~/components/ui/button";
import { WebAnalyticsSection } from "~/components/wordpress/web-analytics-section";
import { usePreloadWebsiteOverviews } from "~/lib/hooks/useWorkspaceWebsiteOverview";
import { WebsiteSitePicker } from "~/components/wordpress/website-site-picker";
import {
  WebsiteDates,
  WebsitePreviewImage,
} from "~/components/wordpress/website-preview-card";

export type WebsiteStage = "live" | "staging";

/** Production is the live site; Staging is every copy of it (staging, test). */
export const STAGE_TYPES: Record<WebsiteStage, WorkspaceWpSite["type"][]> = {
  live: ["production"],
  staging: ["staging", "development"],
};

/**
 * Website › Production (/website) and Website › Staging (/website/staging): one
 * page each. Opening one makes its site the open site, so Settings and the
 * services that follow change that one. A workspace with only one kind of
 * site is sent to that kind's page.
 */
export function WebsiteOverviewPage({ stage }: { stage: WebsiteStage }) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const siteQuery = useWorkspaceWpSite(!!currentWorkspace);
  const sitesQuery = useWorkspaceWpSites(!!currentWorkspace);
  const switchSite = useSwitchWpSite();
  const navigate = useNavigate();
  // The other page's picture and dates too, so switching shows them at once.
  usePreloadWebsiteOverviews((sitesQuery.data ?? []).map((s) => s.id));
  const [signingIn, setSigningIn] = useState(false);

  const group = (sitesQuery.data ?? []).filter((s) =>
    STAGE_TYPES[stage].includes(s.type),
  );
  const open = siteQuery.data ?? null;
  const openInGroup = !!open && group.some((s) => s.id === open.id);
  const firstInGroup = group[0];
  // None of this page's kind, but a site of the other kind: show that page.
  const otherPage =
    !!sitesQuery.data && group.length === 0 && sitesQuery.data.length > 0
      ? stage === "live"
        ? WEBSITE_STAGING_PATH
        : "/website"
      : null;

  useEffect(() => {
    if (otherPage) navigate(otherPage, { replace: true });
  }, [otherPage, navigate]);

  // The open site belongs to the other page: open this page's site instead.
  useEffect(() => {
    if (siteQuery.isLoading || !sitesQuery.data) return;
    if (openInGroup || !firstInGroup) return;
    switchSite(firstInGroup);
  }, [siteQuery.isLoading, sitesQuery.data, openInGroup, firstInGroup, switchSite]);

  const site = openInGroup ? open : null;
  const loading =
    siteQuery.isLoading ||
    sitesQuery.isLoading ||
    !!otherPage ||
    (group.length > 0 && !openInGroup);

  async function handleSignIn() {
    if (!site) return;
    // Keep the button in its loading state while we mint the one-time SSO URL,
    // then open the admin straight into a new tab — no blank placeholder tab.
    // The click's user activation is still valid for the couple of seconds the
    // request takes, so the browser allows the new tab. This page stays mounted,
    // so the loader clears in `finally` and never sticks after the user returns.
    setSigningIn(true);
    try {
      const redirectUrl = await requestWpSsoLogin();
      const adminTab = window.open(redirectUrl, "_blank");
      if (!adminTab) {
        // Popup was blocked — fall back to same-tab navigation.
        window.location.href = redirectUrl;
      }
    } catch (err) {
      toast.error(
        extractErrorMessage(err) ||
          t(
            "wordpress.signInError",
            "Couldn't start site admin login. Check your access to this site.",
          ),
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-4 sm:py-10! sm:space-y-8 sm:p-6 app-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1 app-fade-up">
        <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">
          {stage === "live"
            ? t("wordpress.title", "Website")
            : t("wordpress.staging.title", "Staging")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {stage === "live"
            ? t(
                "wordpress.subtitlePlain",
                "Your website and everything connected to it.",
              )
            : t(
                "wordpress.staging.subtitle",
                "A copy of your website to check changes before they go live.",
              )}
        </p>
      </div>

      <div className="border-t border-border app-fade-up" />

      {siteQuery.isError || sitesQuery.isError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm app-fade-up">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-destructive">
            {t(
              "wordpress.loadError",
              "Couldn't load your website. Please try again.",
            )}
          </p>
        </div>
      ) : loading ? (
        <SiteHeroSkeleton />
      ) : !site ? (
        stage === "live" ? (
          <EmptyState />
        ) : (
          <StagingEmptyState />
        )
      ) : (
        <div className="grid overflow-hidden rounded-xl border bg-card shadow-xs app-fade-up lg:grid-cols-2">
          {/* Half the card each: the picture runs to the card's edges. Below
              desktop width it sits on top, full width. */}
          <WebsitePreviewImage site={site} />

          <div className="flex min-w-0 flex-col gap-5 border-t p-5 sm:p-7 lg:border-t-0 lg:border-l lg:p-8">
            <div className="min-w-0 space-y-2">
              {/* The site's type. With several sites on this page, it's the
                switch between them too — the other page's sites aren't in it.
                Fixed height, so the line never moves as the site list arrives. */}
              <div className="flex min-h-9 flex-wrap items-center gap-2 max-sm:min-h-11">
                <WebsiteSitePicker compact types={STAGE_TYPES[stage]} />
              </div>
              {/* The whole domain, wrapped if it must — never cut off. */}
              <h2 className="title-display text-[22px] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-[26px]">
                {siteHostname(site.url)}
              </h2>
            </div>

            <WebsiteDates site={site} />

            {/* Both ways into the site, side by side at the bottom. Admin
                sign-in needs SSO; opening the site never does. */}
            <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {site.sso_enabled ? (
                <Button
                  onClick={handleSignIn}
                  loading={signingIn}
                  className="h-10 max-sm:h-11 sm:flex-1"
                >
                  {signingIn ? null : <LogIn />}
                  {signingIn
                    ? t("wordpress.signingIn", "Opening site admin…")
                    : t("wordpress.signIn", "Sign in to admin")}
                </Button>
              ) : null}
              <Button
                asChild
                variant="outline"
                className="h-10 max-sm:h-11 sm:flex-1"
              >
                <a href={site.url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  {t("wordpress.overview.previewOpen", "Open your website")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Visitor numbers are the live site's; a copy has no visitors. */}
      {stage === "live" ? <WebAnalyticsSection /> : null}
    </div>
  );
}

function SiteHeroSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-xl border bg-card app-fade-up lg:grid-cols-2">
      <div className="aspect-[16/10] w-full animate-pulse bg-muted lg:h-full" />
      <div className="space-y-4 border-t p-5 sm:p-7 lg:border-t-0 lg:border-l lg:p-8">
        <div className="h-7 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-56 max-w-full animate-pulse rounded bg-muted" />
        <div className="h-11 w-full animate-pulse rounded bg-muted" />
        <div className="h-11 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center app-fade-up">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Globe className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-semibold tracking-tight">
          {t("wordpress.noSiteTitle", "No website connected")}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t(
            "wordpress.noSiteBodyPlain",
            "Your website isn't connected here yet.",
          )}
        </p>
      </div>
    </div>
  );
}

function StagingEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center app-fade-up">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FlaskConical className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-semibold tracking-tight">
          {t("wordpress.staging.emptyTitle", "No staging website yet")}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t(
            "wordpress.staging.emptyBody",
            "A staging website is a copy where changes can be checked before your visitors see them. Ask us if you'd like one.",
          )}
        </p>
      </div>
    </div>
  );
}

function siteHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
