import { apiClient } from "./axios-instance";

/**
 * re:translate — whole-page translation by Page Translate, served by the
 * re-translate WordPress plugin. All calls are scoped to the workspace's
 * own site by the X-Workspace-Id header the axios instance attaches.
 */

export type ReTranslatePageState = "live" | "needs_you" | "draft";

export interface ReTranslateLanguage {
  locale: string;
  prefix: string;
  bcp47: string;
  rtl: boolean;
  name: string;
  native: string;
  /** Country code of the flag shown for it in the language menu, or "none". */
  flag?: string;
  enabled?: boolean;
}

export type ReTranslateSwitcherShow = "flag_name" | "flag" | "name" | "code" | "flag_code";
export type ReTranslateSwitcherPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "manual";
export type ReTranslateColorKey = "text" | "bg" | "border" | "active_text" | "active_bg";
export type ReTranslateLengthKey = "radius" | "pad_y" | "pad_x" | "offset_y" | "offset_x";

/** The website's own language menu, as found and confirmed. locale "" = the original language, "keep" = left as the site has it. */
export interface ReTranslateSiteMenu {
  container: { tag: string; id: string; classes: string[] };
  items: Array<{ text: string; href: string; locale: string; role: "link" | "current" }>;
  found_at: string;
  by: "ai" | "rules" | "person";
}

export interface ReTranslateSwitcher extends Record<ReTranslateLengthKey, string> {
  mode: "plugin" | "site";
  layout: "dropdown" | "inline";
  show: ReTranslateSwitcherShow;
  position: ReTranslateSwitcherPosition;
  hide_current: boolean;
  colors: Record<ReTranslateColorKey, string>;
  site: ReTranslateSiteMenu | null;
}

export interface ReTranslateSettings {
  source: { locale: string; bcp47: string; name?: string; native?: string; flag?: string };
  languages: Array<ReTranslateLanguage & { enabled: boolean }>;
  paused: boolean;
  switcher: ReTranslateSwitcher;
}

export type ReTranslateMenuDetection =
  | { found: false; plugins: string[]; reason: string }
  | { found: true; menu: ReTranslateSiteMenu; reason: string; plugins: string[]; missing: string[] };

export interface ReTranslateRun {
  id: string;
  target_lang: string;
  scope: "all" | "changed" | "pages";
  status: "queued" | "running" | "complete" | "cancelled" | "failed";
  total: number;
  done: number;
  failed: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  items?: Array<{ path: string; title: string; status: string; state: ReTranslatePageState | null; score: number | null; error: string | null; updated_at: string }>;
}

export interface ReTranslateOverview {
  plugin: {
    version: string;
    core_buffer: boolean;
    v1_active: boolean;
    /** WordPress's own address; can be an internal name (hyeticket.gagadomains.com). */
    home: string;
    /** The address the website is known by (hyeticket.com). Show and link this. */
    site_url?: string;
  };
  settings: ReTranslateSettings;
  /** Languages visitors can browse in: live on at least one page. */
  open: string[];
  /** Countries the plugin has a flag for. */
  flags: string[];
  counts: Record<string, { rows?: number; pages_live?: number; pages_needs_you?: number; pages_draft?: number }>;
  changed: number;
  locales: ReTranslateLanguage[];
  runs: ReTranslateRun[];
}

export interface ReTranslatePage {
  post_id: number;
  type: string;
  title: string;
  path: string;
  modified: string;
  changed: boolean;
  languages: Record<string, { state: ReTranslatePageState; score: number | null; updated_at: string }>;
}

export interface ReTranslateSentence {
  key: string;
  id: string;
  kind: string;
  section: string;
  /** Tokenised original: <1>…</1> marks a link or bold words, <2/> an icon, ⟦0⟧ a placeholder. */
  source: string;
  target: string | null;
  draft: string | null;
  origin: "job" | "edit" | null;
  why: string[];
  flags: string[];
}

export type ReTranslateReason = "untranslated_parts" | "too_long" | "numbers_changed" | "names" | "links" | "low_score";

export interface ReTranslatePageView {
  path: string;
  lang: string;
  page: { state: ReTranslatePageState; score: number | null; updated_at: string; post_id: number } | null;
  preview: string;
  score: number | null;
  reasons: ReTranslateReason[];
  brief: { business?: string; audience?: string; tone?: string } | null;
  sentences: ReTranslateSentence[];
}

export interface ReTranslateStyle {
  host: string;
  brand: { name?: string; tone?: string; audience?: string; register?: "" | "formal" | "casual"; dnt?: string[]; forbidden?: string[]; notes?: string };
  memory: Record<string, number>;
}

/**
 * Which site the screens act on. Customers (my.repraesent) act on their own
 * site: no urlId, workspace routes. Staff (shtemaran) name the site: urlId,
 * admin routes. The same components serve both.
 */
export interface ReTranslateTarget {
  pluginUuid: string;
  urlId?: string;
}

const base = ({ pluginUuid, urlId }: ReTranslateTarget) =>
  urlId
    ? `/wordpress-hub/urls/${encodeURIComponent(urlId)}/plugins/${encodeURIComponent(pluginUuid)}/re-translate`
    : `/wordpress/site/plugins/${encodeURIComponent(pluginUuid)}/re-translate`;

export async function getReTranslateOverview(target: ReTranslateTarget): Promise<ReTranslateOverview> {
  return (await apiClient.get<ReTranslateOverview>(`${base(target)}/overview`)).data;
}

export async function putReTranslateLanguages(target: ReTranslateTarget, body: { source?: string; targets: string[] }): Promise<ReTranslateSettings> {
  return (await apiClient.put<ReTranslateSettings>(`${base(target)}/languages`, body)).data;
}

export interface ReTranslateOptionsBody {
  paused?: boolean;
  switcher?: Partial<Omit<ReTranslateSwitcher, "colors">> & { colors?: Partial<ReTranslateSwitcher["colors"]> };
  enabled?: Record<string, boolean>;
  /** locale, or "source" → country code or "none" */
  flags?: Record<string, string>;
}

export async function detectReTranslateMenu(target: ReTranslateTarget): Promise<ReTranslateMenuDetection> {
  const { data } = await apiClient.post<ReTranslateMenuDetection>(`${base(target)}/switcher/detect`, {});
  return data;
}

export async function putReTranslateOptions(target: ReTranslateTarget, body: ReTranslateOptionsBody): Promise<ReTranslateSettings> {
  return (await apiClient.put<ReTranslateSettings>(`${base(target)}/options`, body)).data;
}

export async function getReTranslatePages(target: ReTranslateTarget): Promise<{ pages: ReTranslatePage[]; site_changed: boolean }> {
  return (await apiClient.get<{ pages: ReTranslatePage[]; site_changed: boolean }>(`${base(target)}/pages`)).data;
}

export async function getReTranslateRuns(target: ReTranslateTarget): Promise<{ runs: ReTranslateRun[] }> {
  return (await apiClient.get<{ runs: ReTranslateRun[] }>(`${base(target)}/runs`)).data;
}

export async function startReTranslateRun(target: ReTranslateTarget, body: { lang: string; scope?: "all" | "changed" | "pages"; paths?: string[]; mode?: "normal" | "again" | "missing" }): Promise<{ run: ReTranslateRun; joined: boolean }> {
  return (await apiClient.post<{ run: ReTranslateRun; joined: boolean }>(`${base(target)}/runs`, body)).data;
}

export async function cancelReTranslateRun(target: ReTranslateTarget, runId: string): Promise<{ runs: ReTranslateRun[] }> {
  return (await apiClient.post<{ runs: ReTranslateRun[] }>(`${base(target)}/runs/${encodeURIComponent(runId)}/cancel`)).data;
}

export async function getReTranslatePage(target: ReTranslateTarget, path: string, lang: string): Promise<ReTranslatePageView> {
  return (await apiClient.get<ReTranslatePageView>(`${base(target)}/page`, { params: { path, lang } })).data;
}

export async function putReTranslateSentence(target: ReTranslateTarget, body: { path: string; lang: string; key: string; target: string }): Promise<{ stored: number; sentence: ReTranslateSentence }> {
  return (await apiClient.put<{ stored: number; sentence: ReTranslateSentence }>(`${base(target)}/sentence`, body)).data;
}

export async function setReTranslatePageLive(target: ReTranslateTarget, body: { path: string; lang: string; live: boolean }): Promise<unknown> {
  return (await apiClient.post(`${base(target)}/page/live`, body)).data;
}

export type ReTranslatePublishWaitingResult = { published: number; failed: Array<{ path: string; lang: string; error: string }>; remaining: number };

/** Every page waiting for the owner made live (one language, or all that are on). Large sites answer in parts: `remaining` > 0 means ask again. */
export async function publishReTranslateWaiting(target: ReTranslateTarget, body: { lang?: string }): Promise<ReTranslatePublishWaitingResult> {
  return (await apiClient.post<ReTranslatePublishWaitingResult>(`${base(target)}/pages/live-waiting`, body)).data;
}

export async function getReTranslateStyle(target: ReTranslateTarget): Promise<ReTranslateStyle> {
  return (await apiClient.get<ReTranslateStyle>(`${base(target)}/style`)).data;
}

export async function putReTranslateStyle(target: ReTranslateTarget, body: ReTranslateStyle["brand"]): Promise<ReTranslateStyle> {
  return (await apiClient.put<ReTranslateStyle>(`${base(target)}/style`, body)).data;
}
