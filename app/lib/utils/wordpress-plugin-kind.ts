import {
  Accessibility,
  CalendarCheck,
  Cookie,
  Languages,
  Megaphone,
  Package,
  Radar,
  Search,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { WpPluginSettingsKind } from "~/lib/api/wordpress-hub";

/** Managed plugins whose admin has been ported into Repraesent so far. */
export const PORTED_SETTINGS_KINDS = [
  "re-cookie",
  "re-index",
  "re-maintenance",
  "re-review",
  "re-appointment",
  "re-translate",
  "re-visible",
  "re-banner",
  "re-accessibility",
] as const;

export type PortedSettingsKind = (typeof PORTED_SETTINGS_KINDS)[number];

export function isPortedSettingsKind(
  s: string | undefined,
): s is PortedSettingsKind {
  return (
    s !== undefined && (PORTED_SETTINGS_KINDS as readonly string[]).includes(s)
  );
}

/**
 * Where a managed plugin's settings screen lives inside the dashboard.
 * Addressed by the plugin's opaque catalog UUID, not its slug, so the
 * human-readable kind never appears in the browser URL.
 */
export function wordpressPluginSettingsPath(pluginUuid: string): string {
  return `/website/settings/${pluginUuid}`;
}

/**
 * Website settings: what belongs to the site rather than to one service —
 * tracking tags (added by re:cookie) and search engine verification + sitemap
 * (by re:index). The services' own screens sit one level below it.
 */
export const WEBSITE_SETTINGS_PATH = "/website/settings";

/** Website › Staging: the staging and test copies of the live site. */
export const WEBSITE_STAGING_PATH = "/website/staging";

/** Where each service's name lives in the locale files. */
const PLUGIN_NAME_KEYS: Partial<Record<PortedSettingsKind, string>> = {
  "re-accessibility": "wordpress.reAccessibility.titleFallback",
  "re-appointment": "wordpress.reAppointment.titleFallback",
  "re-cookie": "wordpress.reCookie.titleFallback",
  "re-index": "wordpress.reIndex.titleFallback",
  "re-maintenance": "wordpress.reMaintenance.titleFallback",
  "re-review": "wordpress.reReview.titleFallback",
  "re-translate": "wordpress.reTranslate.title",
  "re-visible": "wordpress.reVisible.titleFallback",
};

/**
 * A service's name in the viewer's language. The catalog's `display_name` is a
 * single English string, so it only stands in for a service with no translated
 * name (re:banner keeps its brand name; a kind this app doesn't know yet).
 */
export function pluginServiceName(
  kind: string | undefined,
  catalogName: string,
  t: TFunction,
): string {
  const key = isPortedSettingsKind(kind) ? PLUGIN_NAME_KEYS[kind] : undefined;
  return key ? t(key, catalogName) : catalogName;
}

/**
 * Sidebar/nav icon per managed service. Keyed by the catalog kind so the icon
 * follows the service rather than its display name, which is translated and
 * editable in the catalog. Unknown kinds fall back to a generic package.
 */
export const PLUGIN_KIND_ICONS: Record<PortedSettingsKind, LucideIcon> = {
  "re-translate": Languages,
  "re-index": Search,
  "re-review": Star,
  "re-appointment": CalendarCheck,
  "re-maintenance": Wrench,
  "re-cookie": Cookie,
  "re-visible": Radar,
  "re-banner": Megaphone,
  "re-accessibility": Accessibility,
};

export function pluginKindIcon(kind: string | undefined): LucideIcon {
  return isPortedSettingsKind(kind) ? PLUGIN_KIND_ICONS[kind] : Package;
}
