import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Globe, LogIn, ShieldAlert } from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import { requestWpSsoLogin } from "~/lib/api/wordpress-hub";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { WordPressPluginsSection } from "~/components/wordpress/plugins-card";

export function meta() {
  return [
    { title: i18n.t("wordpress.metaTitle", "Website") + " - Repraesent" },
    {
      name: "description",
      content: i18n.t(
        "wordpress.metaDescription",
        "Manage your website, plugins, and content.",
      ),
    },
  ];
}

export default function WordPressPage() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "wordpress.metaTitle",
    descriptionKey: "wordpress.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const { currentWorkspace } = useAuthContext();
  const siteQuery = useWorkspaceWpSite(!!currentWorkspace);
  const [signingIn, setSigningIn] = useState(false);

  const site = siteQuery.data ?? null;

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
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:space-y-8 sm:p-6 app-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1 app-fade-up">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t("wordpress.title", "Website")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "wordpress.subtitle",
            "Plugin management, content settings, and admin access for your site.",
          )}
        </p>
      </div>

      <div className="border-t border-border app-fade-up" />

      {siteQuery.isLoading ? (
        <SiteHeroSkeleton />
      ) : siteQuery.isError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm app-fade-up">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-destructive">
            {t(
              "wordpress.loadError",
              "Couldn't load your website. Please try again.",
            )}
          </p>
        </div>
      ) : !site?.sso_enabled ? (
        <EmptyState />
      ) : (
        <>
          {/* Site hero */}
          <div className="overflow-hidden rounded-2xl border bg-card app-fade-up">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex max-w-full items-center gap-1.5"
                  >
                    <h2 className="truncate text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                      {siteHostname(site.url)}
                    </h2>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2.5">
                <SsoBadge connected />
                <Button onClick={handleSignIn} disabled={signingIn}>
                  <LogIn className="h-4 w-4" />
                  {signingIn
                    ? t("wordpress.signingIn", "Opening site admin…")
                    : t("wordpress.signIn", "Sign in to admin")}
                </Button>
              </div>
            </div>
          </div>

          <WordPressPluginsSection hasSite />
        </>
      )}
    </div>
  );
}

function SsoBadge({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        connected
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {connected ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <ShieldAlert className="h-3.5 w-3.5" />
      )}
      {connected
        ? t("wordpress.ssoConnected", "Admin connected")
        : t("wordpress.ssoPending", "Not connected")}
    </span>
  );
}

function SiteHeroSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6 app-fade-up">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          <div className="h-4 w-60 animate-pulse rounded bg-muted" />
        </div>
        <div className="ml-auto h-9 w-36 animate-pulse rounded-md bg-muted" />
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
            "wordpress.noSiteBody",
            "This workspace doesn't have a website connected yet.",
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
