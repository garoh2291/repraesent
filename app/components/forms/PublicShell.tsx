/**
 * Page chrome for the public form routes (/f/:id and /f/:id/thanks).
 *
 * Suppressed entirely under ?embed=1 so the iframe shows only the form and
 * inherits the host page's own background. "Inherits the host page's
 * background" was a lie until the document itself was made transparent:
 * app.css paints html and body `#0f0f11` for the dashboard, and an iframe
 * document paints its own body over whatever is behind it.
 *
 * DocumentScheme pins the colour scheme to the form's own theme, so native
 * widgets never follow the visitor's OS.
 */

import { onColor } from "~/lib/forms/css";
import type { FormTheme } from "~/lib/forms/schema";

export function PublicShell({
  embed,
  theme,
  children,
}: {
  embed: boolean;
  theme?: FormTheme;
  children: React.ReactNode;
}) {
  if (embed) {
    return (
      <>
        <DocumentScheme theme={theme} background="transparent" />
        <div className="flex w-full justify-center p-2">{children}</div>
      </>
    );
  }
  return (
    <>
      <DocumentScheme theme={theme} background="#eeeeee" />
      <main className="flex min-h-dvh w-full items-center justify-center bg-[#eeeeee] p-4 sm:p-8">
        <div className="flex w-full justify-center">{children}</div>
      </main>
    </>
  );
}

/**
 * Overrides the dashboard's `html, body { background: #0f0f11; color-scheme:
 * dark }` for this route only. A plain <style> element rather than a class,
 * because the rules have to reach html and body, which the route does not
 * render. Ships in the SSR HTML, so there is no flash of dark background.
 */
export function DocumentScheme({
  theme,
  background,
}: {
  theme?: FormTheme;
  background: string;
}) {
  const scheme =
    theme && onColor(theme.surface) === "#ffffff" ? "dark" : "light";
  return (
    <style>{`html,body{background:${background};color-scheme:${scheme};}`}</style>
  );
}

/**
 * Leave for another URL. Inside an iframe (the `?embed=1` variant) the TOP
 * window has to move — Stripe Checkout refuses to render in a frame — and a
 * sandboxed frame that may not navigate its parent gets a new tab instead.
 */
export function navigateTop(url: string, framed: boolean): void {
  if (!framed) {
    window.location.assign(url);
    return;
  }
  try {
    window.top!.location.assign(url);
    return;
  } catch {
    /* sandboxed */
  }
  const w = window.open(url, "_blank");
  if (!w) window.location.assign(url);
}

/**
 * The visitor's language: ?lang= wins, then the site's `repraesent_lang`
 * cookie, then the browser's language when the form offers it, then the
 * form's own default. Deliberately not i18next's — on a dashboard-shared
 * bundle that would be the operator's.
 */
export function resolveVisitorLocale<L extends string>(
  offered: readonly L[],
  fallback: L,
  langParam: string | null,
  cookie: string | null,
): L {
  const isOffered = (v: unknown): v is L =>
    typeof v === "string" && (offered as readonly string[]).includes(v);
  if (isOffered(langParam)) return langParam;
  if (isOffered(cookie)) return cookie;
  const nav =
    typeof navigator !== "undefined"
      ? (navigator.language || "").split("-")[0].toLowerCase()
      : "";
  return isOffered(nav) ? nav : fallback;
}
