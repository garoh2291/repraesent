import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import { Toaster } from "./components/ui/sonner";

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

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap",
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

export function Layout({ children }: { children: React.ReactNode }) {
  // Root loader data isn't available on the error path, so fall back safely.
  const data = useRouteLoaderData<typeof loader>("root");
  const lang = data?.lang ?? DEFAULT_LOCALE;
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>
          <ReactQueryProvider>
            <AuthProvider>
              <ModalProvider>
                {children}
                <Toaster />

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
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
