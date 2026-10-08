import { apiClient } from "./axios-instance";
import type {
  ReAppointmentButton,
  ReAppointmentButtonConfig,
  ReAppointmentPage,
  ReAppointmentSlot,
  ReBanner,
  ReBannerConfig,
  ReBannerLinkTarget,
  ReIndexPageSeoListResponse,
  ReTranslateBulkState,
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
 *
 * Optional `redirect` is a `/wp-admin/…` path (or absolute admin URL) the
 * gateway should land on after auth — used by Edit SEO and similar deep links.
 */
export async function requestWpSsoLogin(opts?: {
  redirect?: string;
}): Promise<string> {
  const res = await apiClient.post<{ redirect_url: string }>(
    "/wordpress/site/login",
    opts?.redirect ? { redirect: opts.redirect } : undefined,
  );
  return res.data.redirect_url;
}

/** Settings route segment for a Repraesent-managed plugin, if any. */
export type WpPluginSettingsKind =
  | "re-cookie"
  | "re-index"
  | "re-maintenance"
  | "re-review"
  | "re-appointment"
  | "re-translate"
  | "re-visible"
  | "re-banner";

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
  /**
   * Catalog UUID (wp_plugins.id) for a managed plugin — the opaque reference
   * used in settings URLs. Null for third-party plugins.
   */
  plugin_uuid: string | null;
  /** Catalog display name for a managed plugin, otherwise null. */
  display_name: string | null;
  /** Catalog description for a managed plugin, otherwise null. */
  description: string | null;
  /** Raw inline SVG icon for a managed plugin, otherwise null. */
  icon: string | null;
  /** Catalog version for a managed plugin, otherwise null. */
  version: string | null;
}

export interface WpPluginListResponse {
  plugins: WpPlugin[];
  /** Candidate paths seen before de-duplication (diagnostic). */
  candidates: number;
  /** True when the list was verified against an on-disk folder scan. */
  folder_scan_applied: boolean;
}

/** A row of the Repraesent plugin catalog (wp_plugins). */
export interface WpPluginCatalogItem {
  id: string;
  name: WpPluginSettingsKind;
  display_name: string;
  description: string | null;
  icon: string | null;
  version: string | null;
}

/**
 * The plugin catalog: id ↔ kind plus presentation. Lets the settings route
 * resolve the opaque plugin UUID in the URL back to a kind. Global and
 * effectively static.
 */
export async function getWorkspaceWpPluginCatalog(): Promise<
  WpPluginCatalogItem[]
> {
  const res = await apiClient.get<WpPluginCatalogItem[]>(
    "/wordpress/wp-plugins",
  );
  return res.data;
}

/**
 * List catalog plugins installed on the current workspace's WordPress site.
 * Reads `wp_plugin_installs` only (`deleted_at` IS NULL).
 * Throws (404) when the workspace has no WordPress site.
 */
export async function getWorkspaceWpPluginInstalls(): Promise<WpPluginInstallList> {
  const res = await apiClient.get<WpPluginInstallList>(
    "/wordpress/site/plugin-installs",
  );
  return res.data;
}

/**
 * Activate or deactivate a catalog service on the workspace's WordPress site.
 * Returns the refreshed install list so the sidebar and page toggle stay in sync.
 */
export async function setWorkspaceCatalogPluginActive(
  pluginUuid: string,
  active: boolean,
): Promise<WpPluginInstallList> {
  const action = active ? "activate" : "deactivate";
  const res = await apiClient.post<WpPluginInstallList>(
    `/wordpress/site/plugin-installs/${pluginUuid}/${action}`,
  );
  return res.data;
}

/** A catalog plugin known to be installed on the workspace's WordPress site. */
export interface WpPluginInstall {
  plugin_uuid: string;
  name: WpPluginSettingsKind;
  display_name: string;
  description: string | null;
  icon: string | null;
  version: string | null;
  active: boolean;
}

export interface WpPluginInstallList {
  plugins: WpPluginInstall[];
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

/** `found: false` means the site has never saved this plugin's options. */
export interface WpPluginSettingsGetResponse {
  found: boolean;
  settings: unknown;
}

export interface WpPluginSettingsPutResponse {
  success: true;
  settings: Record<string, unknown>;
}

export interface WpPluginSettingsActionResponse extends WpPluginSettingsPutResponse {
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
  pluginUuid: string,
): Promise<WpPluginSettingsGetResponse> {
  const res = await apiClient.get<WpPluginSettingsGetResponse>(
    `/wordpress/site/plugins/${pluginUuid}/settings`,
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
  pluginUuid: string,
  settings: Record<string, unknown>,
): Promise<WpPluginSettingsPutResponse> {
  const res = await apiClient.put<WpPluginSettingsPutResponse>(
    `/wordpress/site/plugins/${pluginUuid}/settings`,
    { settings },
  );
  return res.data;
}

export type WpPluginPauseState = { paused: boolean };

/** `GET /wordpress/site/plugins/:pluginUuid/pause` — the plugin's "Live" switch. */
export async function getWorkspacePluginPause(
  pluginUuid: string,
): Promise<WpPluginPauseState> {
  const res = await apiClient.get<WpPluginPauseState>(
    `/wordpress/site/plugins/${pluginUuid}/pause`,
  );
  return res.data;
}

/** `PUT /wordpress/site/plugins/:pluginUuid/pause` — pause or resume. Nothing is deleted. */
export async function putWorkspacePluginPause(
  pluginUuid: string,
  paused: boolean,
): Promise<WpPluginPauseState> {
  const res = await apiClient.put<WpPluginPauseState>(
    `/wordpress/site/plugins/${pluginUuid}/pause`,
    { paused },
  );
  return res.data;
}

/** `POST /wordpress/site/plugins/:pluginUuid/{action}` — a plugin-defined op. */
async function pluginAction<T>(pluginUuid: string, action: string): Promise<T> {
  const res = await apiClient.post<T>(
    `/wordpress/site/plugins/${pluginUuid}/${action}`,
  );
  return res.data;
}

/**
 * Regenerate the XML sitemap on the workspace's site (clear cache, rebuild
 * from published pages, update stats).
 */
export function regenerateWorkspaceReIndexSitemap(pluginUuid: string) {
  return pluginAction<WpPluginSettingsPutResponse>(
    pluginUuid,
    "regenerate-sitemap",
  );
}

/** Per-page SEO overview (read-only; edits happen in WP admin). */
export async function getWorkspaceReIndexPageSeo(
  pluginUuid: string,
): Promise<ReIndexPageSeoListResponse> {
  const res = await apiClient.get<ReIndexPageSeoListResponse>(
    `/wordpress/site/plugins/${pluginUuid}/page-seo`,
  );
  return res.data;
}

function pluginUrl(pluginUuid: string, path: string) {
  return `/wordpress/site/plugins/${encodeURIComponent(pluginUuid)}/${path}`;
}

/**
 * Start or cancel a site-wide SEO optimize run.
 *
 * `start` only records the run — the API scheduler builds the queue and works
 * through it, so this returns in milliseconds and the run keeps going after
 * this tab is gone. Watch it with {@link getSeoOptimizeStatus}.
 */
export async function runSeoOptimize(
  pluginUuid: string,
  action: "start" | "cancel",
  mode?: "empty_only" | "overwrite",
): Promise<{ bulk?: ReTranslateBulkState }> {
  const res = await apiClient.post<{ bulk?: ReTranslateBulkState }>(
    pluginUrl(pluginUuid, "seo-optimize"),
    { action, mode },
  );
  return res.data;
}

/** Progress of the site's live SEO optimize run, or the last one it finished. */
export async function getSeoOptimizeStatus(
  pluginUuid: string,
): Promise<{ bulk?: ReTranslateBulkState }> {
  const res = await apiClient.get<{ bulk?: ReTranslateBulkState }>(
    pluginUrl(pluginUuid, "seo-optimize"),
  );
  return res.data;
}

/** Generate SEO copy for one page, outside the bulk queue. */
export async function optimizeSeoPage(
  pluginUuid: string,
  postId: number,
  mode?: "empty_only" | "overwrite",
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    pluginUrl(pluginUuid, `seo-optimize/${postId}`),
    { mode },
    { timeout: 120_000 },
  );
  return res.data;
}

/** Live Google Places fetch into the WordPress cache transient. */
export function testFetchWorkspaceReReview(pluginUuid: string) {
  return pluginAction<WpPluginSettingsActionResponse>(pluginUuid, "test-fetch");
}

/** Wipe the re:reviews cache transient. */
export function clearWorkspaceReReviewCache(pluginUuid: string) {
  return pluginAction<WpPluginSettingsActionResponse>(
    pluginUuid,
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
  const res = await apiClient.get<WpMediaListResponse>(
    "/wordpress/site/media",
    {
      params: {
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 24,
        search: opts?.search || undefined,
      },
    },
  );
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
export async function getWorkspaceReAppointmentButtons(
  pluginUuid: string,
): Promise<ReAppointmentButtonsResponse> {
  const res = await apiClient.get<ReAppointmentButtonsResponse>(
    `/wordpress/site/plugins/${pluginUuid}/buttons`,
  );
  return res.data;
}

export async function createWorkspaceReAppointmentButton(
  pluginUuid: string,
  config: Partial<ReAppointmentButtonConfig>,
): Promise<ReAppointmentButton> {
  const res = await apiClient.post<ReAppointmentButton>(
    `/wordpress/site/plugins/${pluginUuid}/buttons`,
    config,
  );
  return res.data;
}

/**
 * Update one button. The server merges the payload over the button's stored
 * config, so an omitted field keeps its current value.
 */
export async function updateWorkspaceReAppointmentButton(
  pluginUuid: string,
  buttonId: number,
  config: Partial<ReAppointmentButtonConfig>,
): Promise<ReAppointmentButton> {
  const res = await apiClient.put<ReAppointmentButton>(
    `/wordpress/site/plugins/${pluginUuid}/buttons/${buttonId}`,
    config,
  );
  return res.data;
}

export async function deleteWorkspaceReAppointmentButton(
  pluginUuid: string,
  buttonId: number,
): Promise<{ success: true; id: number }> {
  const res = await apiClient.delete<{ success: true; id: number }>(
    `/wordpress/site/plugins/${pluginUuid}/buttons/${buttonId}`,
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
  pluginUuid: string,
  parentOrigin: string,
  buttonId: number,
): Promise<ReAppointmentPickerUrlResponse> {
  const res = await apiClient.get<ReAppointmentPickerUrlResponse>(
    `/wordpress/site/plugins/${pluginUuid}/picker-url`,
    { params: { parentOrigin, buttonId } },
  );
  return res.data;
}

/* ── re:banner ────────────────────────────────────────────────────────── */

export interface ReBannersResponse {
  banners: ReBanner[];
  /** Published pages and posts, for the CTA target and the page rules. */
  link_targets: ReBannerLinkTarget[];
  /** The site's timezone, so the editor can say which clock the dates are on. */
  timezone: string;
  /**
   * The text-banner styles THIS site can render, key => label: the plugin's
   * reference set plus whatever its theme registered. Sent rather than
   * hard-coded here, because a copy in the dashboard would be wrong on the
   * first site that adds one of its own — which is the case the variant exists
   * for. Empty on a site whose plugin predates the text variant.
   */
  text_styles: Record<string, string>;
}

/**
 * List the banners on the workspace's own site. A site with the plugin
 * installed but no banners yet returns an empty `banners` array — not an error.
 */
export async function getWorkspaceReBanners(
  pluginUuid: string,
): Promise<ReBannersResponse> {
  const res = await apiClient.get<ReBannersResponse>(
    `/wordpress/site/plugins/${pluginUuid}/banners`,
  );
  return res.data;
}

export async function createWorkspaceReBanner(
  pluginUuid: string,
  config: Partial<ReBannerConfig>,
): Promise<ReBanner> {
  const res = await apiClient.post<ReBanner>(
    `/wordpress/site/plugins/${pluginUuid}/banners`,
    config,
  );
  return res.data;
}

/**
 * Update one banner. The server merges the payload over the banner's stored
 * config, so an omitted field keeps its current value.
 *
 * Responds 400 carrying the plugin's own wording when the schedule window is
 * invalid (an end date before its start), so surface the message rather than a
 * generic failure.
 */
export async function updateWorkspaceReBanner(
  pluginUuid: string,
  bannerId: number,
  config: Partial<ReBannerConfig>,
): Promise<ReBanner> {
  const res = await apiClient.put<ReBanner>(
    `/wordpress/site/plugins/${pluginUuid}/banners/${bannerId}`,
    config,
  );
  return res.data;
}

export async function deleteWorkspaceReBanner(
  pluginUuid: string,
  bannerId: number,
): Promise<{ success: true; id: number }> {
  const res = await apiClient.delete<{ success: true; id: number }>(
    `/wordpress/site/plugins/${pluginUuid}/banners/${bannerId}`,
  );
  return res.data;
}
