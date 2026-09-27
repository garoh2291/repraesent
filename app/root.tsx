import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import { Toaster } from "./components/ui/sonner";
import { useKeyboardInset } from "./lib/hooks/use-keyboard-inset";
import { BrandSplash, isPublicPath, markBootReady } from "./components/notebook/brand-splash";
import { ErrorCard } from "./components/notebook/error-card";
import { WpSsoErrorNotice } from "./components/wordpress/wp-sso-error-notice";
// Side effect: starts listening for the install prompt as early as possible.
import "./lib/pwa/register";
import { PwaBoot } from "./lib/pwa/pwa-boot";

import type { Route } from "./+types/root";
import "./app.css";
import "react-phone-number-input/style.css";
import "./i18n"; // initialise i18next
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import {
  DEFAULT_LOCALE,
  detectLocaleFromHeaders,
  type SupportedLocale,
} from "./i18n/locales";

// Detect the initial language server-side (cookie → Accept-Language) so the very
// first paint is already in the right language — no German flash before hydration.
export async function loader({ request }: Route.LoaderArgs) {
  const lang: SupportedLocale =
    detectLocaleFromHeaders({
      cookie: request.headers.get("Cookie"),
      acceptLanguage: request.headers.get("Accept-Language"),
    }) ?? DEFAULT_LOCALE;

  // On the server, i18next's cookie/localStorage/navigator detectors can't run,
  // so seed the language for this request's render. On the client the detector
  // already handles this, so we leave it alone.
  if (typeof document === "undefined" && i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }

  return { lang };
}
import { ReactQueryProvider } from "./providers/react-query-provider";
import { AuthProvider } from "./providers/auth-provider";
import ModalProvider from "./components/modal-provider";
import { ComposeEmailProvider } from "~/components/organism/compose-email/use-compose-email";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap",
  },
  // Typefaces the re:cookie plugin admin ships with; loaded so the ported
  // settings UI matches its wp-admin rendering exactly.
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/noto-sans-jp/css/noto-sans-jp.css",
  },
];

/**
 * The root loader only reads the language cookie. Re-running it on every
 * link or filter change cost a server round trip before each page showed;
 * the client switches language itself, so only form submissions re-run it.
 */
export function shouldRevalidate({
  formMethod,
  defaultShouldRevalidate,
}: {
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}) {
  return formMethod ? defaultShouldRevalidate : false;
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Root loader data isn't available on the error path, so fall back safely.
  const data = useRouteLoaderData<typeof loader>("root");
  const lang = data?.lang ?? DEFAULT_LOCALE;
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        {/* viewport-fit=cover: the installed app draws under the notch and home
            bar; the pt-safe / pb-safe utilities keep content clear of them.
            In a normal browser tab every inset is 0, so nothing moves. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Installable app (PWA_PUSH_PLAN.md). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png?v=2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="re:praesent" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>
          <ReactQueryProvider>
            <AuthProvider>
              <ModalProvider>
                {/* One composer for the whole app: the contact hero, the deal
                    hero, the Emails tab and every Reply button share it, so two
                    half-written drafts can never exist at once. */}
                <ComposeEmailProvider>{children}</ComposeEmailProvider>
                {/* Outside `children` so it also covers the 404/error
                    boundary, which is where a WordPress bounce to an unrouted
                    path currently lands. */}
                <WpSsoErrorNotice />
                <Toaster />
                {/* Start screen: ink + "re:" → "re:praesent" (REDESIGN_PLAN.md §3). */}
                <BrandSplash />
                {/* Service worker, update toast, alert taps (client-only effects). */}
                <PwaBoot />

                <ScrollRestoration />
                <Scripts />
              </ModalProvider>
            </AuthProvider>
          </ReactQueryProvider>
        </I18nextProvider>
      </body>
    </html>
  );
}

export default function App() {
  useKeyboardInset();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Never leave the start screen over an error page.
  useEffect(() => markBootReady(), []);
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // Visitors on public pages (booking, forms, tracking) have no "Today".
  const inApp = !isPublicPath(pathname);
  const stack = import.meta.env.DEV && error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : null;

  return (
    <main className="flex min-h-dvh items-center bg-background px-4 pt-safe pb-safe">
      <ErrorCard
        title={notFound ? t("errors.notFoundTitle", "This page doesn't exist") : t("errors.appTitle", "Something went wrong on this page")}
        body={
          notFound
            ? t("errors.notFoundBody", "The link may be old or mistyped. Everything else is where you left it.")
            : t("errors.appBody", "Your data is safe. Try again, or go back to Today.")
        }
        onRetry={notFound ? undefined : () => window.location.reload()}
        showHome={inApp}
      >
        {stack ? (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-[12px] text-muted-foreground">Details (dev only)</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-snug">{stack}</pre>
          </details>
        ) : null}
      </ErrorCard>
    </main>
  );
}
