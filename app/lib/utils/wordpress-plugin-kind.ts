import {
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

/**
 * Settings-page header: catalog `display_name` from `wp_plugins`. Falls back
 * to `fallback` while the catalog is still loading or the UUID is unknown.
 */
export function formatPluginSettingsTitle(
  displayName: string | null | undefined,
  fallback: string,
): string {
  return displayName?.trim() || fallback;
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
};

export function pluginKindIcon(kind: string | undefined): LucideIcon {
  return isPortedSettingsKind(kind) ? PLUGIN_KIND_ICONS[kind] : Package;
}
