import { apiClient } from "./axios-instance";
import type {
  ReAppointmentButton,
  ReAppointmentButtonConfig,
  ReAppointmentPage,
  ReAppointmentSlot,
  ReIndexPageSeoListResponse,
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
  | "re-translate";

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

/** `POST /wordpress/site/plugins/:pluginUuid/{action}` — a plugin-defined op. */
async function pluginAction<T>(
  pluginUuid: string,
  action: string,
): Promise<T> {
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

/** Live Google Places fetch into the WordPress cache transient. */
export function testFetchWorkspaceReReview(pluginUuid: string) {
  return pluginAction<WpPluginSettingsActionResponse>(pluginUuid, "test-fetch");
}

/** Wipe the re:reviews cache transient. */
export function clearWorkspaceReReviewCache(pluginUuid: string) {
  return pluginAction<WpPluginSettingsActionResponse>(pluginUuid, "clear-cache");
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

/* ── re:translate ────────────────────────────────────────────────────── */

export type TranslateLanguageProgress = {
  total: number;
  translated: number;
  stale: number;
  percent: number;
};

export type TranslateContentItem = {
  id: number | string;
  object_type: string;
  title: string;
  post_type?: string;
  type_label: string;
  status: string;
  strings: number;
  languages: Record<string, TranslateLanguageProgress>;
  /** Absolute wp-admin edit URL for posts. Absent for forms/chrome. */
  edit_url?: string;
};

export type TranslateContentListResponse = {
  items: TranslateContentItem[];
  total: number;
  has_rf_forms: boolean;
};

export type TranslateString = {
  id: number;
  field_key: string;
  label: string;
  source_text: string;
  current_source_text?: string;
  translated_text?: string;
  status: string;
  is_stale: boolean;
  is_html: boolean;
  updated_at?: string;
};

export type TranslateContentDetailResponse = {
  item: TranslateContentItem;
  language: string;
  strings: TranslateString[];
  progress: TranslateLanguageProgress;
};

function pluginUrl(pluginUuid: string, path: string) {
  return `/wordpress/site/plugins/${encodeURIComponent(pluginUuid)}/${path}`;
}

export async function getTranslateContent(
  pluginUuid: string,
  params: {
    page?: number;
    per_page?: number;
    search?: string;
    post_type?: string;
    object_type?: string;
  },
): Promise<TranslateContentListResponse> {
  const res = await apiClient.get<TranslateContentListResponse>(
    pluginUrl(pluginUuid, "translate-content"),
    { params },
  );
  return res.data;
}

export async function getTranslateContentDetail(
  pluginUuid: string,
  id: number | string,
  params: { language: string; object_type?: string },
): Promise<TranslateContentDetailResponse> {
  const res = await apiClient.get<TranslateContentDetailResponse>(
    pluginUrl(pluginUuid, `translate-content/${encodeURIComponent(String(id))}`),
    { params },
  );
  return res.data;
}

export async function addTranslateLanguage(
  pluginUuid: string,
  body: { code: string; label?: string; locale?: string; flag?: string },
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    pluginUrl(pluginUuid, "translate-languages"),
    body,
  );
  return res.data;
}

export async function removeTranslateLanguage(
  pluginUuid: string,
  code: string,
  purge: boolean,
): Promise<Record<string, unknown>> {
  const res = await apiClient.delete<Record<string, unknown>>(
    pluginUrl(pluginUuid, `translate-languages/${encodeURIComponent(code)}`),
    { params: { purge } },
  );
  return res.data;
}

export async function saveTranslateStrings(
  pluginUuid: string,
  strings: { id: number; translated_text: string; status: string }[],
): Promise<{ ok?: boolean; strings?: unknown[] }> {
  const res = await apiClient.post<{ ok?: boolean; strings?: unknown[] }>(
    pluginUrl(pluginUuid, "translate-strings/save"),
    { strings },
  );
  return res.data;
}

export async function runTranslateIndex(
  pluginUuid: string,
  action: "start" | "batch" | "cancel",
): Promise<{ ok?: boolean; index?: Record<string, unknown> }> {
  const res = await apiClient.post<{ ok?: boolean; index?: Record<string, unknown> }>(
    pluginUrl(pluginUuid, "translate-index"),
    { action },
  );
  return res.data;
}

export async function setTranslateSourceLanguage(
  pluginUuid: string,
  code: string,
  replaceTarget?: boolean,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    pluginUrl(pluginUuid, "translate-source-language"),
    { code, replace_target: replaceTarget },
  );
  return res.data;
}

export async function machineTranslateContent(
  pluginUuid: string,
  id: number | string,
  language: string,
  objectType?: string,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    pluginUrl(
      pluginUuid,
      `translate-content/${encodeURIComponent(String(id))}/machine-translate`,
    ),
    { language, object_type: objectType },
  );
  return res.data;
}

export async function importTranslations(
  pluginUuid: string,
  csv: string,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    pluginUrl(pluginUuid, "translate-import"),
    { csv },
  );
  return res.data;
}

export async function exportTranslations(
  pluginUuid: string,
  params: { language?: string; only?: string },
): Promise<{ filename?: string; csv?: string }> {
  const res = await apiClient.get<{ filename?: string; csv?: string }>(
    pluginUrl(pluginUuid, "translate-export"),
    { params },
  );
  return res.data;
}
