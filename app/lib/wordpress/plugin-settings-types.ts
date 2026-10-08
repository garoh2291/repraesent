import type { ReBannerStyles } from "./re-banner-styles";

export type { ReBannerStyles } from "./re-banner-styles";

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

/** A theme slot the plugin can auto-place a button into. */
export type ReAppointmentSlot = { key: string; label: string; group: string };

/**
 * re:banner — temporary, scheduled site banners.
 *
 * Dates are wall-clock strings ('YYYY-MM-DD HH:MM') in the SITE's timezone,
 * not ISO instants: the editor types a local time and means it locally, and
 * converting through the browser's timezone would move every banner by an hour
 * twice a year. `state` is derived server-side from the epochs the plugin
 * stored when it saved — render it rather than recomputing from the dates, so
 * the dashboard and wp-admin can never disagree about whether a banner is on.
 */
/**
 * `text` is the odd one out and deliberately so: a fragment of words with no
 * box, no colours and no stylesheet of its own, placed by shortcode so it
 * inherits whatever element it lands in. Position, the colour fields and
 * `dismissible` do not apply to it.
 */
export type ReBannerVariant = "bar" | "card" | "hero" | "floating" | "text";

export type ReBannerPosition = "top" | "bottom";
/**
 * How a box banner's content sits inside it. `auto` follows the variant —
 * centred for the hero band, left for the rest — and is what a banner has
 * until somebody aligns it. Rendered by the plugin as `data-align` with real
 * flex rules, so it moves image, words and button together whatever element
 * the words are in. Ignored by `text`.
 */
export type ReBannerAlign = "auto" | "left" | "center" | "right";
export type ReBannerCtaType = "url" | "post";
export type ReBannerVisibility = "all" | "include" | "exclude";
/**
 * How a box banner gets onto the page: pinned by the plugin at the top of the
 * page (`auto`, on the pages `visibility` allows) or only where its shortcode
 * is pasted (`shortcode`). A text banner is shortcode-only regardless.
 */
export type ReBannerPlacement = "auto" | "shortcode";
export type ReBannerStatus = "active" | "inactive";
export type ReBannerState = "live" | "scheduled" | "expired" | "paused";

/** Everything the editor edits. `id`/`state` are server-assigned. */
export type ReBannerConfig = {
  /**
   * Internal label — lists, the aria-label — never shown to visitors. The
   * plugin derives one from the content when it is left empty.
   */
  name: string;
  /**
   * The banner's content, for every variant, as HTML. Sanitized by the plugin
   * on write against its own allowlist — what comes back may be shorter than
   * what was sent, which is why the editor re-seeds from the saved response.
   */
  body_html: string;
  /**
   * Per-element typography and spacing overrides. `{}` means the banner
   * inherits — its theme for `text`, the plugin's stylesheet for the boxes —
   * and emits no CSS at all. See `re-banner-styles.ts` for the schema.
   */
  styles: ReBannerStyles;
  image_id: number;
  cta_label: string;
  cta_type: ReBannerCtaType;
  cta_url: string;
  cta_post_id: number;
  cta_new_tab: boolean;
  variant: ReBannerVariant;
  position: ReBannerPosition;
  align: ReBannerAlign;
  /**
   * `text` only. A key from the list response's `text_styles`, rendered as the
   * class `rebnr-text--{key}`. The CSS behind it belongs to the site's theme,
   * never to the plugin.
   */
  text_style: string;
  accent_color: string;
  text_color: string;
  bg_color: string;
  dismissible: boolean;
  /** 'YYYY-MM-DD HH:MM' in site time, or '' for open-ended. */
  starts_at: string;
  /** 'YYYY-MM-DD HH:MM' in site time, or '' for open-ended. */
  ends_at: string;
  placement: ReBannerPlacement;
  visibility: ReBannerVisibility;
  page_ids: number[];
  status: ReBannerStatus;
  /** Highest priority wins within one position. */
  priority: number;
};

export type ReBanner = ReBannerConfig & {
  /** WordPress post ID — this is the `id` in `[re_banner id="N"]`. */
  id: number;
  /** Resolved thumbnail, or null when unset or the attachment is gone. */
  image_url: string | null;
  state: ReBannerState;
};

/** A published page or post the CTA can point at. */
export type ReBannerLinkTarget = {
  id: number;
  title: string;
  type: "page" | "post";
  url: string;
};
