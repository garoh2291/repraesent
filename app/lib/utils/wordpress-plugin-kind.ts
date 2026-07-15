import type { WpPluginSettingsKind } from "~/lib/api/wordpress-hub";

/** Managed plugins whose admin has been ported into Repraesent so far. */
export const PORTED_SETTINGS_KINDS = [
  "re-cookie",
  "re-index",
  "re-maintenance",
  "re-review",
  "re-appointment",
] as const;

export type PortedSettingsKind = (typeof PORTED_SETTINGS_KINDS)[number];

export function isPortedSettingsKind(
  s: string | undefined,
): s is PortedSettingsKind {
  return (
    s !== undefined && (PORTED_SETTINGS_KINDS as readonly string[]).includes(s)
  );
}

/** Where a managed plugin's settings screen lives inside the dashboard. */
export function wordpressPluginSettingsPath(kind: WpPluginSettingsKind): string {
  return `/website/settings/${kind}`;
}
