import { Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

/**
 * Which section is open, as an i18n key stem.
 *
 * Longest-first: `/settings/email-accounts` must be tested before any looser
 * prefix. `profile` is the fallback, which also covers a bare `/settings` for
 * the instant before `settings._index.tsx` redirects.
 */
const SECTIONS = [
  { match: "/settings/email-accounts", key: "emailAccounts" },
  { match: "/settings/notifications", key: "notifications" },
  { match: "/settings/integrations", key: "integrations" },
  { match: "/settings/calendars", key: "calendars" },
  { match: "/settings/pipelines", key: "pipelines" },
  { match: "/settings/team", key: "team" },
  { match: "/settings/bcc", key: "bcc" },
] as const;

/**
 * Chrome for the settings pages.
 *
 * Navigation used to be a tab strip here; it now lives in the sidebar, which
 * swaps into a settings sub-mode for any `/settings` route. What remains is the
 * heading — and it has to name the *section*, because none of the four child
 * pages renders its own `<h1>`; without this they would all read "Settings".
 *
 * Titles reuse each page's existing `metaTitle`/`metaDescription`, already
 * translated in every locale for `useDocumentMeta`.
 */
export default function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const key =
    SECTIONS.find((s) => location.pathname.startsWith(s.match))?.key ??
    "profile";

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      <div className="app-fade-up">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {t(`settings.${key}.metaTitle`)}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t(`settings.${key}.metaDescription`)}
        </p>
      </div>

      <div className="border-t border-border" />

      <Outlet />
    </div>
  );
}
