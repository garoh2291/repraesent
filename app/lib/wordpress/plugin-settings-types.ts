/**
 * Shapes of the `re_cookie_settings` WordPress option, mirroring
 * `ReCookie\Config\ConfigRepository::defaults()` in the plugin. Keys stay in
 * the plugin's snake_case so the object round-trips through the API into
 * wp_options untouched.
 */

export type ReCookieCategorySlug =
  | "functional"
  | "analytics"
  | "marketing"
  | "external_media";

/** Categories that can carry consent-gated named scripts (no external_media). */
export type ReCookieScriptCategory = "functional" | "analytics" | "marketing";

/** Legacy blob keys when re:translate is off; dynamic codes when multilingual. */
export type ReCookieLang = string;

export type ReCookieTranslationLang = {
  banner: { title: string; description: string; privacyPolicy: string };
  buttons: {
    acceptAll: string;
    rejectAll: string;
    customize: string;
    savePreferences: string;
    deny: string;
    manageCookies: string;
  };
  modal: { title: string; description: string };
  categories: Record<
    ReCookieCategorySlug,
    { title: string; description: string }
  >;
  vendor: { description: string };
  mediaBlocker: { message: string };
};

export type ReCookieNamedScript = { name: string; script: string };

export type ReCookieSettings = {
  config_version: number;
  banner_position: "bottom" | "center";
  primary_color: string;
  background_color: string;
  text_color: string;
  accept_button_color: string;
  reject_button_color: string;
  secondary_button_color: string;
  border_radius: number;
  show_modal_overlay: boolean;
  title: string;
  description: string;
  learn_more_url: string;
  privacy_policy_url: string;
  label_accept: string;
  label_reject: string;
  label_customize: string;
  label_save: string;
  manage_placement: "bottom-left" | "bottom-right";
  banner_delay_ms: number;
  output_buffer_blocker: boolean;
  consent_logging: boolean;
  default_language: ReCookieLang;
  categories: Record<
    ReCookieCategorySlug,
    { enabled: boolean; title: string; description: string }
  >;
  integrations: {
    gtm: { enabled: boolean; container_id: string };
    google_ads: { enabled: boolean; conversion_id: string };
    ga4: { enabled: boolean; measurement_id: string; load_via: "gtag" | "gtm" };
    meta: { enabled: boolean; pixel_id: string };
    custom_scripts: Record<
      ReCookieScriptCategory,
      { header: string; body: string; footer: string }
    >;
    named_scripts: Record<ReCookieScriptCategory, ReCookieNamedScript[]>;
  };
  translations: Record<string, ReCookieTranslationLang>;
};

/**
 * re:index settings — verification codes, sitemap stats, SEO title formats,
 * site identity, and Open Graph. Stored as individual `re_index_*` wp_options
 * (plus `blogname` / `blogdescription`). The API maps those rows into this
 * nested object so the settings page can round-trip a single blob.
 */

export type ReIndexVerification = {
  google: string;
  bing: string;
  pinterest: string;
  yandex: string;
  facebook: string;
  linkedin: string;
};

export type ReIndexStats = {
  page_count: number;
  last_generated: string;
};

export type ReIndexSeoFormats = {
  front_page: string;
  posts: string;
  pages: string;
  groups: string;
  archives: string;
};

export type ReIndexSettings = {
  verification: ReIndexVerification;
  stats: ReIndexStats;
  seo: {
    enabled: boolean;
    formats: ReIndexSeoFormats;
    front_page_description: string;
  };
  identity: {
    enabled: boolean;
    site_title: string;
    tagline: string;
  };
  og: {
    enabled: boolean;
    image_id: number;
    /** Resolved public URL for preview (not stored in wp_options). */
    image_url: string;
    og_description: string;
    compressed_url: string;
  };
  /** Machine SEO generation is available (plugin ships a default token). */
  /** Live or last finished site-wide Optimize SEO run. */
  seo_bulk?: ReTranslateBulkState;
};

/** One row of the re:index Page SEO overview (post meta, not settings). */
export type ReIndexPageSeoRow = {
  id: number;
  title: string;
  slug: string;
  post_type: string;
  post_status: string;
  meta_title: string;
  meta_description: string;
  noindex: boolean;
  edit_url?: string;
  /** Public URL of the live page; absent for anything not published. */
  view_url?: string;
  /** The title a visitor gets, tokens resolved; absent for `theme`. */
  effective_title?: string;
  /** Which layer writes the title: this page, the sitewide format, or the theme. */
  title_source: "override" | "sitewide" | "theme";
};

export type ReIndexPageSeoListResponse = {
  pages: ReIndexPageSeoRow[];
  summary: {
    total: number;
    with_title: number;
    no_description: number;
    hidden: number;
  };
};

/**
 * re:maintenance — coming-soon / maintenance mode. Writable keys are only
 * under `maintenance`; `site` is blogname / blogdescription for preview.
 */

export type ReMaintenanceSettings = {
  maintenance: {
    enabled: boolean;
    message: string;
    sub_message: string;
  };
  site: {
    site_title: string;
    tagline: string;
  };
};

/**
 * re:reviews — Google Business star ratings via `[gmb_stars]`. Writable keys
 * are `place_id` and `cache_ttl`; `cache` / `has_api_key` / `is_configured`
 * are diagnostics from the API (not persisted as form fields).
 */

export type ReReviewCacheDiagnostics = {
  present: boolean;
  business_name: string;
  rating: number | null;
  review_count: number | null;
  url: string;
  fetched_at: number | null;
  last_fetched_display: string;
};

export type ReReviewSettings = {
  place_id: string;
  cache_ttl: number;
  /** Always null from the API — key stays in plugin secrets.php on the WP host. */
  has_api_key: boolean | null;
  is_configured: boolean;
  cache: ReReviewCacheDiagnostics;
};

/**
 * re:appointment's CTA buttons. Unlike re:cookie, this plugin has no settings
 * option row at all — each button is a hidden `reappt_button` post whose config
 * lives in post meta. The API hands them over already decoded into real JS
 * types (numbers, booleans, arrays), so nothing here mirrors WordPress's meta
 * string encoding; that translation stays server-side.
 *
 * Field names and defaults mirror `Reappt_CPT::defaults()` in the plugin.
 */

export type ReAppointmentActionType =
  | "modal-iframe"
  | "modal-html"
  | "url"
  | "page";

export type ReAppointmentVisibility = "all" | "homepage" | "exclude_pages";

export type ReAppointmentTargetPosition =
  | "before"
  | "after"
  | "prepend"
  | "append";

export type ReAppointmentMobilePosition = "left" | "center" | "right";

export type ReAppointmentStatus = "active" | "inactive";

/** Pin the button next to any CSS selector — works on any theme. */
export type ReAppointmentTarget = {
  sel: string;
  pos: ReAppointmentTargetPosition;
};

/** Everything the editor edits. `id`/`title` are server-assigned. */
export type ReAppointmentButtonConfig = {
  action_type: ReAppointmentActionType;
  url: string;
  html_content: string;
  wp_page_id: number;
  new_tab: boolean;
  modal_width: string;
  modal_height: string;
  label: string;
  font_size: number;
  font_color: string;
  bg_color: string;
  hover_bg: string;
  border_radius: number;
  padding_y: number;
  padding_x: number;
  margin_y: number;
  margin_x: number;
  border_width: number;
  border_color: string;
  full_width: boolean;
  icon: string;
  placement_slots: string[];
  placement_visibility: ReAppointmentVisibility;
  placement_page_ids: number[];
  placement_targets: ReAppointmentTarget[];
  mobile_position: ReAppointmentMobilePosition;
  status: ReAppointmentStatus;
};

export type ReAppointmentButton = ReAppointmentButtonConfig & {
  /** WordPress post ID — this is the `id` in `[reappointment id="N"]`. */
  id: number;
  title: string;
};

/** A published page on the site, for the "Go to WP Page" action. */
export type ReAppointmentPage = { id: number; title: string };

/**
 * re:translate — multilingual content served under /<code>/ paths.
 *
 * Only part of this is writable. The plugin keeps its own string index, and the
 * admin actions that touch it (adding a language, changing the source language,
 * running a scan) re-key or populate those tables rather than just writing an
 * option, so the API refuses to fake them from here: `source_language`,
 * `languages`, `index` and `stats` are read-only, and the writable keys are
 * `kill_switch`, `post_types`, `switcher` and `delete_on_uninstall`.
 */

export type ReTranslateSwitcherPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type ReTranslateSwitcherLayout = "inline" | "dropdown";

/** How each language is labelled in the switcher. */
export type ReTranslateSwitcherShow =
  | "label"
  | "code"
  | "flag"
  | "flag_label"
  | "flag_code";

/**
 * What the switcher offers.
 *
 * "auto" is the default: language, plus regions once the site has two of them.
 * With fewer than two it resolves to "language", which is the only value that
 * produces the exact markup a site had before regions existed.
 */
export type ReTranslateSwitcherGroups = "auto" | "language" | "region" | "both";

/** Empty means "inherit from the theme" for colours, "stylesheet default" for
 *  lengths — which is why every one of these is a string, not a number. */
export type ReTranslateSwitcher = {
  position: ReTranslateSwitcherPosition;
  layout: ReTranslateSwitcherLayout;
  show: ReTranslateSwitcherShow;
  groups: ReTranslateSwitcherGroups;
  hide_current: boolean;
  /** Accessible name for the switcher landmark. */
  label: string;
  colors: {
    text: string;
    bg: string;
    border: string;
    active_text: string;
    active_bg: string;
  };
  radius: string;
  pad_y: string;
  pad_x: string;
  offset_y: string;
  offset_x: string;
};

export type ReTranslateLanguage = {
  code: string;
  label: string;
  locale: string;
  /** Emoji flag, empty when the language was added without one. */
  flag: string;
  added_at: string;
};

/*
 * Regions and pricing.
 *
 * A second axis beside language. Language owns the URL prefix (`/de/…`); a
 * region owns nothing in the URL and only decides which number a `[price]`
 * token renders — so the two are independent, and a visitor can read German
 * pages at Canadian prices.
 *
 * None of this rides in the settings blob. Amounts live in their own table with
 * per-cell history, so every write goes through its own endpoint and the whole
 * surface is fetched and saved separately from the Switcher/Settings form.
 */

export type ReTranslateCurrency = {
  /** ISO 4217, uppercase. */
  code: string;
  name: string;
  symbol: string;
  /**
   * Minor units per major unit as a power of ten — 2 almost everywhere, 0 for
   * JPY and HUF, 3 for the Gulf dinars. Decides how a typed amount is stored.
   */
  exponent: number;
  position: "before" | "after";
  decimal: string;
  thousands: string;
};

export type ReTranslateRegion = {
  slug: string;
  label: string;
  /** Emoji flag, empty when the region was added without one. */
  flag: string;
  /** Ordered. The first entry is this region's default currency. */
  currencies: string[];
  /** ISO-3166 alpha-2 codes routed here when geo resolution is on. */
  countries: string[];
  added_at: string;
  /** How much of this region's grid is filled — the "18 / 20" in the list. */
  coverage: { filled: number; total: number };
};

/**
 * A price by name.
 *
 * The slug is immutable by design: pages already contain `[price key="…"]`, and
 * the plugin hashes each sentence to key its translations, so renaming would
 * orphan every translation of every sentence quoting the price. The label is
 * freely editable; Duplicate is offered where Rename would be.
 */
export type ReTranslatePriceKey = {
  slug: string;
  label: string;
  note: string;
  added_at: string;
  /** The exact string to paste into the editor. */
  shortcode: string;
};

export type ReTranslatePriceCell = {
  key: string;
  region: string;
  currency: string;
  /** Signed: a credit or a discount is legitimately negative. */
  amount_minor: number;
  /** Stored per cell, so a later catalogue correction cannot re-scale it. */
  exponent: number;
  /** How many decimal digits the owner typed. `1000` → 0, `10.0` → 1. */
  display_places?: number;
  /** Plain editable number, e.g. "19" or "10.0". */
  input: string;
  /** Rendered as the site renders it, e.g. "CA$19". */
  formatted: string;
};

/** How a price decides which region it is showing. */
export type ReTranslatePricingSettings = {
  /**
   * Off (the default) renders the default region for everyone and lets the
   * script correct it in place — identical bytes, so a page cache cannot serve
   * one visitor's prices to the next. On makes pricing pages uncacheable
   * unless the CDN already segments on the `rt_region` cookie.
   */
  resolve_on_server: boolean;
  /**
   * Let the browser work out the visitor's region from its time zone, falling
   * back to its locale. On by default, because unlike a CDN country header it
   * costs the cache nothing: it happens after the HTML has been delivered, so
   * every visitor is still served the same bytes.
   */
   detect_browser: boolean;
  /** Read a CDN country header. Off by default: it varies every page by country. */
  use_geo: boolean;
  /** Ship every region's amounts so switching needs no reload. */
  embed_all: boolean;
  /**
   * Rewrite amounts recognised in existing content from the grid.
   *
   * Safe to leave on: only an amount somebody explicitly bound to a price is
   * ever touched, so a site that has bound nothing renders exactly what it
   * rendered before.
   */
  adopt_found_prices: boolean;
};

/** One page an amount was found on. */
export type ReTranslateFoundPlace = {
  object_id: string;
  title: string;
  /** `?p=<id>`, which the site redirects to the real permalink. */
  url: string;
  /** The sentence it sits in, so it can be judged without opening the page. */
  context: string;
  hits: number;
};

/**
 * An amount the site already publishes, and what has been decided about it.
 *
 * Grouped by currency-and-value rather than by spelling, so "€300" and a
 * translator's "300 €" are one decision. A decision applies site-wide — the
 * places list is there so the consequence is visible before it is made.
 */
export type ReTranslateFoundAmount = {
  /** `spot:post:42:0`. One occurrence on one page. */
  spot_id?: string;
  fingerprint: string;
  /** How it is written on the page, e.g. "€1,000". */
  literal: string;
  currency: string;
  amount_minor: number;
  exponent: number;
  display_places?: number;
  /** Plain editable number, e.g. "1000". */
  input: string;
  /**
   * How the page will read once this is managed, e.g. "€1 000".
   *
   * Decimal digits follow what was typed, not the currency catalogue — so
   * adopting `€1000` does not grow a `,00`.
   */
  formatted: string;
  pages: number;
  hits: number;
  status: "new" | "bound" | "ignored";
  price_key: string;
  price_label: string;
  places: ReTranslateFoundPlace[];
};

export type ReTranslateFound = {
  summary: {
    total: number;
    pages: number;
    unreviewed: number;
    bound: number;
    ignored: number;
    /** False means nothing has been scanned yet, not that nothing was found. */
    scanned: boolean;
  };
  amounts: ReTranslateFoundAmount[];
};

export type ReTranslatePricing = {
  /**
   * False when the site's re:translate predates the pricing tables. The tab
   * offers a plugin update instead of a grid that would fail on save.
   */
  available: boolean;
  regions: ReTranslateRegion[];
  default_region: string;
  price_keys: ReTranslatePriceKey[];
  prices: ReTranslatePriceCell[];
  currencies: ReTranslateCurrency[];
  pricing: ReTranslatePricingSettings;
  found: ReTranslateFound;
};

/** Progress of one slice of a site-wide scan. */
export type ReTranslateScanResult = {
  scanned: number;
  found: number;
  cursor: number;
  done: boolean;
};

/** One cell in a grid save. `amount_minor: null` clears it. */
export type ReTranslatePriceCellInput = {
  key: string;
  region: string;
  currency: string;
  amount_minor: number | null;
  display_places?: number | null;
};

/**
 * A write's answer: the site's own state after it, plus whether it was refused.
 *
 * `ok: false` is a refusal the person can act on — a duplicate slug, a currency
 * the region does not offer — not a transport failure, so it arrives as data
 * with the unchanged snapshot rather than as a thrown error.
 */
export type ReTranslatePricingResult = ReTranslatePricing & {
  ok: boolean;
  error?: string;
  /** Per-cell outcome of a grid save. */
  result?: {
    saved: number;
    deleted: number;
    skipped: number;
    errors: string[];
  };
  /** Present on a scan slice only. */
  scan?: ReTranslateScanResult;
};

export type ReTranslateIndexState = {
  status: string;
  total: number;
  processed: number;
  strings: number;
  started_at: string;
  updated_at: string;
};

export type ReTranslateMode = "empty_or_stale" | "empty_only" | "overwrite";

export type ReTranslateBulkCurrent = {
  object_type: string;
  id: string;
  title: string;
  /**
   * Per-kind identity extras. A translate item is a page *and a language*, so
   * it carries `{ language }`; a SEO item is just the page, so it carries
   * nothing. Read it through {@link bulkItemLanguage} rather than indexing.
   */
  params: Record<string, unknown>;
};

/**
 * `queued` = accepted, the API is still working out what to translate;
 * `running` = draining; `idle` = this site has never run one.
 */
export type ReTranslateBulkStatus =
  | "idle"
  | "queued"
  | "running"
  | "complete"
  | "cancelled"
  | "failed";

export type WpAiJobKind = "translate" | "seo_optimize";

export type ReTranslateBulkState = {
  status: ReTranslateBulkStatus;
  kind?: WpAiJobKind;
  blocked_by?: WpAiJobKind | "";
  /**
   * Per-kind run settings: `{ languages }` for a translate run, empty for a
   * SEO run. Read it through {@link bulkLanguages} rather than indexing.
   */
  params: Record<string, unknown>;
  mode?: ReTranslateMode;
  total: number;
  processed: number;
  failed: number;
  /**
   * Units of work saved across the run — strings for translate, SEO fields for
   * seo_optimize. Not the same as `processed`, which counts objects.
   */
  written?: number;
  current: ReTranslateBulkCurrent | null;
  recent: { title: string }[];
  last_error: string;
  started_at: string;
  updated_at: string;
  /**
   * One entry per job in the run.
   *
   * A translate run is a job per language, and every number above is their
   * sum. Without this, a language that failed while another finished is
   * invisible: the totals still look like a run that worked.
   *
   * Absent on responses from an API older than the split.
   */
  languages?: ReTranslateBulkLanguage[];
};

export type ReTranslateBulkLanguage = {
  /** Empty for kinds with no language of their own. */
  language: string;
  status: ReTranslateBulkStatus;
  total: number;
  processed: number;
  failed: number;
  written: number;
  last_error: string;
};

/** Per-language rows worth showing: a run that is not uniformly fine. */
export function bulkTroubledLanguages(
  bulk: ReTranslateBulkState,
): ReTranslateBulkLanguage[] {
  return (bulk.languages ?? []).filter(
    (row) => row.status === "failed" || row.failed > 0 || row.last_error !== "",
  );
}

/**
 * Target languages of a translate run, or `[]` for any other kind.
 *
 * The API keeps per-kind settings in `params` because a SEO run has no
 * languages and used to carry an empty array purely to fit a translate-shaped
 * row. These accessors are where that shape is decoded, so no component has to
 * know the key.
 */
export function bulkLanguages(bulk: ReTranslateBulkState): string[] {
  const value = bulk.params?.languages;
  return Array.isArray(value) ? value.map((code) => String(code)) : [];
}

/** Target language of the item a run is on, or `""` when the kind has none. */
export function bulkItemLanguage(item: ReTranslateBulkCurrent | null): string {
  return String(item?.params?.language ?? "");
}

export type ReTranslateLanguageStats = {
  total: number;
  translated: number;
  /** Translated, but the source text has changed since. */
  stale: number;
  percent: number;
};

export type ReTranslateSettings = {
  source_language: string;
  /** WordPress locale (`WPLANG`), e.g. "de_DE". */
  site_locale: string;
  kill_switch: boolean;
  delete_on_uninstall: boolean;
  post_types: string[];
  /** Post types with content on the site, derived server-side (read-only). */
  available_post_types: { name: string; count: number }[];
  languages: ReTranslateLanguage[];
  switcher: ReTranslateSwitcher;
  index: ReTranslateIndexState;
  bulk?: ReTranslateBulkState;
  stats: {
    source_strings: number;
    languages: Record<string, ReTranslateLanguageStats>;
  };
  /** Whether the site has any indexed Repraesent Forms (rf_form objects). */
  has_rf_forms?: boolean;
  /** Cookie / maintenance / appointment plugin copy available to translate. */
  has_plugins?: boolean;
  /**
   * Installed bridged plugins for the Translate → Plugins submenu.
   * `display_name` comes from the Repraesent `wp_plugins` catalog.
   */
  available_plugins?: Array<{
    object_type: string;
    slug: string;
    display_name: string;
  }>;
  /** Machine-translate capability is available (plugin ships a default token). */
  has_machine_translate?: boolean;
};

/** A theme slot the plugin can auto-place a button into. */
export type ReAppointmentSlot = { key: string; label: string; group: string };
