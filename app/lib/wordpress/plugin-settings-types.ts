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

export type ReCookieLang = "en" | "de";

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
    ga4: { enabled: boolean; measurement_id: string; load_via: "gtag" | "gtm" };
    meta: { enabled: boolean; pixel_id: string };
    custom_scripts: Record<
      ReCookieScriptCategory,
      { header: string; body: string; footer: string }
    >;
    named_scripts: Record<ReCookieScriptCategory, ReCookieNamedScript[]>;
  };
  translations: Record<ReCookieLang, ReCookieTranslationLang>;
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

/** A theme slot the plugin can auto-place a button into. */
export type ReAppointmentSlot = { key: string; label: string; group: string };
