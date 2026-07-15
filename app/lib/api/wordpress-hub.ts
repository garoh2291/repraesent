import { apiClient } from "./axios-instance";
import type {
  ReAppointmentButton,
  ReAppointmentButtonConfig,
  ReAppointmentPage,
  ReAppointmentSlot,
} from "~/lib/wordpress/plugin-settings-types";

/** The WordPress site the current workspace owns, or null if it has none. */
export interface WorkspaceWpSite {
  id: string;
  url: string;
  type: "development" | "production" | "staging";
  /** Whether admin SSO has been configured for this site. */
  sso_enabled: boolean;
}

/**
 * Fetch the current workspace's WordPress site (scoped by the X-Workspace-Id
 * header the axios instance already attaches). Returns null when there is none.
 */
export async function getWorkspaceWpSite(): Promise<WorkspaceWpSite | null> {
  const res = await apiClient.get<WorkspaceWpSite | null>("/wordpress/site");
  return res.data ?? null;
}

/**
 * Request a one-time WordPress admin SSO handoff for the current workspace's
 * site. Returns the redirect URL to full-navigate to — the browser must
 * actually navigate there so WordPress can set its auth cookie on its own
 * domain.
 */
export async function requestWpSsoLogin(): Promise<string> {
  const res = await apiClient.post<{ redirect_url: string }>(
    "/wordpress/site/login",
  );
  return res.data.redirect_url;
}

/** Settings route segment for a Repraesent-managed plugin, if any. */
export type WpPluginSettingsKind =
  | "re-cookie"
  | "re-index"
  | "re-maintenance"
  | "re-review"
  | "re-appointment";

/** A single plugin installed on the workspace's WordPress site. */
export interface WpPlugin {
  /** Stable row id (used to activate/deactivate). */
  id: string;
  /** Best-effort display name. */
  name: string;
  /** Whether WordPress currently considers this plugin active. */
  active: boolean;
  /** Set when this is a Repraesent-managed plugin with its own settings. */
  settings_kind: WpPluginSettingsKind | null;
}

export interface WpPluginListResponse {
  plugins: WpPlugin[];
  /** Candidate paths seen before de-duplication (diagnostic). */
  candidates: number;
  /** True when the list was verified against an on-disk folder scan. */
  folder_scan_applied: boolean;
}

/**
 * List the plugins installed on the current workspace's WordPress site.
 * Workspace-scoped on the server (X-Workspace-Id); never returns another
 * workspace's plugins. Throws (404) when the workspace has no WordPress site.
 */
export async function getWorkspaceWpPlugins(): Promise<WpPluginListResponse> {
  const res = await apiClient.get<WpPluginListResponse>(
    "/wordpress/site/plugins",
  );
  return res.data;
}

/**
 * Activate or deactivate a plugin on the current workspace's WordPress site.
 * Returns the freshly re-listed plugins so callers can update their cache.
 */
export async function setWorkspaceWpPluginActive(
  pluginId: string,
  active: boolean,
): Promise<WpPluginListResponse> {
  const action = active ? "activate" : "deactivate";
  const res = await apiClient.post<WpPluginListResponse>(
    `/wordpress/site/plugins/${encodeURIComponent(pluginId)}/${action}`,
  );
  return res.data;
}

/** `found: false` means the site has never saved this plugin's options. */
export interface WpPluginSettingsGetResponse {
  found: boolean;
  settings: unknown;
}

export interface WpPluginSettingsPutResponse {
  success: true;
  settings: Record<string, unknown>;
}

export interface WpPluginSettingsActionResponse
  extends WpPluginSettingsPutResponse {
  message: string;
}

/**
 * The plugins whose admin is a settings blob behind `GET|PUT
 * /wordpress/site/{kind}/settings`. re:appointment is excluded on purpose — it
 * is a CRUD surface over buttons, not an options row, so it has its own calls.
 */
export type WpSettingsPluginKind = Exclude<
  WpPluginSettingsKind,
  "re-appointment"
>;

/**
 * Read a plugin's options off the workspace's own WordPress site. A site that
 * has never saved the plugin returns `{ found: false }`; the settings page
 * supplies the defaults in that case.
 */
export async function getWorkspacePluginSettings(
  kind: WpSettingsPluginKind,
): Promise<WpPluginSettingsGetResponse> {
  const res = await apiClient.get<WpPluginSettingsGetResponse>(
    `/wordpress/site/${kind}/settings`,
  );
  return res.data;
}

/**
 * Write a plugin's options back to the workspace's site.
 *
 * The server merges into the existing option row (shallow for re:cookie, deep
 * for the rest), so callers send the complete settings object they loaded rather
 * than a partial patch. Returns the post-merge object, which is the new truth.
 */
export async function putWorkspacePluginSettings(
  kind: WpSettingsPluginKind,
  settings: Record<string, unknown>,
): Promise<WpPluginSettingsPutResponse> {
  const res = await apiClient.put<WpPluginSettingsPutResponse>(
    `/wordpress/site/${kind}/settings`,
    { settings },
  );
  return res.data;
}

/** `POST /wordpress/site/{kind}/{action}` — a plugin-defined operation. */
async function pluginAction<T>(
  kind: WpSettingsPluginKind,
  action: string,
): Promise<T> {
  const res = await apiClient.post<T>(`/wordpress/site/${kind}/${action}`);
  return res.data;
}

/**
 * Regenerate the XML sitemap on the workspace's site (clear cache, rebuild
 * from published pages, update stats, ping Google).
 */
export function regenerateWorkspaceReIndexSitemap() {
  return pluginAction<WpPluginSettingsPutResponse>(
    "re-index",
    "regenerate-sitemap",
  );
}

/** Live Google Places fetch into the WordPress cache transient. */
export function testFetchWorkspaceReReview() {
  return pluginAction<WpPluginSettingsActionResponse>(
    "re-review",
    "test-fetch",
  );
}

/** Wipe the re:reviews cache transient. */
export function clearWorkspaceReReviewCache() {
  return pluginAction<WpPluginSettingsActionResponse>(
    "re-review",
    "clear-cache",
  );
}

/* ── Media library ────────────────────────────────────────────────────── */

export type WpMediaItem = {
  id: number;
  title: string;
  mime_type: string;
  url: string;
  thumb_url: string;
  width: number | null;
  height: number | null;
};

export type WpMediaListResponse = {
  items: WpMediaItem[];
  total: number;
  page: number;
  limit: number;
};

/** Paginated image attachments from the workspace site's media library. */
export async function getWorkspaceWpMedia(opts?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<WpMediaListResponse> {
  const res = await apiClient.get<WpMediaListResponse>("/wordpress/site/media", {
    params: {
      page: opts?.page ?? 1,
      limit: opts?.limit ?? 24,
      search: opts?.search || undefined,
    },
  });
  return res.data;
}

/* ── re:appointment ───────────────────────────────────────────────────── */

export interface ReAppointmentButtonsResponse {
  buttons: ReAppointmentButton[];
  /** Published pages, for the "Go to WP Page" action dropdown. */
  pages: ReAppointmentPage[];
  /** Theme slots a button can be auto-placed into. */
  slots: ReAppointmentSlot[];
}

/**
 * List the re:appointment CTA buttons on the workspace's own site, along with
 * the page and slot options the editor needs. A site with the plugin installed
 * but no buttons yet returns an empty `buttons` array — not an error.
 */
export async function getWorkspaceReAppointmentButtons(): Promise<ReAppointmentButtonsResponse> {
  const res = await apiClient.get<ReAppointmentButtonsResponse>(
    "/wordpress/site/re-appointment/buttons",
  );
  return res.data;
}

export async function createWorkspaceReAppointmentButton(
  config: Partial<ReAppointmentButtonConfig>,
): Promise<ReAppointmentButton> {
  const res = await apiClient.post<ReAppointmentButton>(
    "/wordpress/site/re-appointment/buttons",
    config,
  );
  return res.data;
}

/**
 * Update one button. The server merges the payload over the button's stored
 * config, so an omitted field keeps its current value.
 */
export async function updateWorkspaceReAppointmentButton(
  buttonId: number,
  config: Partial<ReAppointmentButtonConfig>,
): Promise<ReAppointmentButton> {
  const res = await apiClient.put<ReAppointmentButton>(
    `/wordpress/site/re-appointment/buttons/${buttonId}`,
    config,
  );
  return res.data;
}

export async function deleteWorkspaceReAppointmentButton(
  buttonId: number,
): Promise<{ success: true; id: number }> {
  const res = await apiClient.delete<{ success: true; id: number }>(
    `/wordpress/site/re-appointment/buttons/${buttonId}`,
  );
  return res.data;
}

export interface ReAppointmentPickerUrlResponse {
  /** Signed front-end URL to load in the picker iframe. */
  picker_url: string;
  /** ISO timestamp when the signed URL stops working. */
  expires_at: string;
}

/**
 * Mint a short-lived, signed URL that opens the plugin's live placement picker
 * on the site's own front end — no WordPress login. `parentOrigin` must be this
 * app's origin (it is bound into the signature and used for framing/postMessage).
 *
 * The server responds 400 with `{ code: "sso_required" }` when the site has not
 * completed the SSO connect handshake; callers should fall back to the manual
 * placement UI in that case.
 */
export async function getWorkspaceReAppointmentPickerUrl(
  parentOrigin: string,
  buttonId: number,
): Promise<ReAppointmentPickerUrlResponse> {
  const res = await apiClient.get<ReAppointmentPickerUrlResponse>(
    "/wordpress/site/re-appointment/picker-url",
    { params: { parentOrigin, buttonId } },
  );
  return res.data;
}
