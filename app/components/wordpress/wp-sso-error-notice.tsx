import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ShieldAlert, X } from "lucide-react";

/** Query flag the WordPress mu-plugin appends when an SSO handoff fails. */
const SSO_ERROR_PARAM = "wp_sso_error";

/**
 * Explains a failed WP admin SSO handoff.
 *
 * WordPress bounces the user back to this app with `?wp_sso_error=1` on any
 * gateway failure — an expired or already-redeemed token, a secret mismatch, or
 * a WP user whose email doesn't match the caller's. The flag carries no reason
 * (the WP side deliberately doesn't leak one), so this says only that the
 * sign-in failed.
 *
 * Rendered from the root `Layout`, which wraps the `ErrorBoundary` as well as
 * the normal tree, so the notice still shows if WordPress returns to a path this
 * app has no route for — that lands on the 404 boundary, where a page-level
 * banner would never mount.
 *
 * The user arrives in the tab `window.open` created for the admin, so this is
 * the entire content of that tab's viewport as far as they're concerned — hence
 * a fixed banner rather than a toast that auto-dismisses before they look.
 */
export function WpSsoErrorNotice() {
  const { t } = useTranslation();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const hasError = new URLSearchParams(location.search).has(SSO_ERROR_PARAM);

  // Drop the flag from the address bar so a refresh or a shared link doesn't
  // resurrect a stale failure. Done through the History API rather than a
  // router navigation because this also renders on the 404 boundary, where
  // navigating would remount the very tree reporting the error.
  useEffect(() => {
    if (!hasError || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.delete(SSO_ERROR_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [hasError]);

  // `hasError` is read from the location, which the replaceState above leaves
  // untouched, so the banner stays put until the user dismisses or navigates.
  useEffect(() => {
    if (hasError) setDismissed(false);
  }, [hasError, location.key]);

  if (!hasError || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center p-4"
    >
      <div className="flex w-full max-w-xl items-start gap-3 rounded-xl border border-destructive/30 bg-background p-4 shadow-lg">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1 text-sm text-destructive">
          {t(
            "wordpress.ssoLoginFailed",
            "Failed to sign in to your site admin. Please try again later.",
          )}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("common.dismiss", "Dismiss")}
          className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
