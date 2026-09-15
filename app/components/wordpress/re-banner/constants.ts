import { toast } from "sonner";
import type {
  ReBanner,
  ReBannerAlign,
  ReBannerConfig,
  ReBannerPlacement,
  ReBannerPosition,
  ReBannerState,
  ReBannerVariant,
  ReBannerVisibility,
} from "~/lib/wordpress/plugin-settings-types";

/* ── Defaults (mirror Re_Banner_CPT::defaults) ───────────────────────── */

export const DEFAULTS: ReBannerConfig = {
  name: "",
  body_html: "",
  // No overrides: a new banner inherits its theme (text) or banner.css (boxes).
  styles: {},
  image_id: 0,
  cta_label: "",
  cta_type: "url",
  cta_url: "",
  cta_post_id: 0,
  cta_new_tab: false,
  variant: "bar",
  position: "top",
  align: "auto",
  text_style: "plain",
  accent_color: "#ffffff",
  text_color: "#ffffff",
  bg_color: "#0a0a0a",
  dismissible: true,
  starts_at: "",
  ends_at: "",
  placement: "auto",
  visibility: "all",
  page_ids: [],
  status: "active",
  priority: 0,
};

/** Mirrors `Re_Banner_CPT::$variants` — order included. */
export const VARIANTS: { key: ReBannerVariant; i18n: string; fallback: string }[] =
  [
    {
      key: "bar",
      i18n: "wordpress.reBanner.variants.bar",
      fallback: "Bar — full-width strip",
    },
    {
      key: "card",
      i18n: "wordpress.reBanner.variants.card",
      fallback: "Card — centred panel",
    },
    {
      key: "hero",
      i18n: "wordpress.reBanner.variants.hero",
      fallback: "Hero — full-width band",
    },
    {
      key: "floating",
      i18n: "wordpress.reBanner.variants.floating",
      fallback: "Floating — corner card",
    },
    {
      key: "text",
      i18n: "wordpress.reBanner.variants.text",
      fallback: "Text — inherits your theme, place it anywhere",
    },
  ];

/**
 * The style options to offer, given what the site reported.
 *
 * A site whose plugin predates the text variant reports nothing; a theme that
 * has stopped registering a style no longer reports it. In both cases the
 * banner's stored value is kept as an "unknown" option rather than silently
 * reset — swapping a theme for an afternoon should not rewrite content.
 */
export function textStyleOptions(
  siteStyles: Record<string, string>,
  selected: string,
): { key: string; label: string; unknown?: boolean }[] {
  const entries = Object.entries(siteStyles);
  const options =
    entries.length > 0
      ? entries.map(([key, label]) => ({ key, label }))
      : [{ key: "plain", label: "Plain" }];

  if (options.some((option) => option.key === selected)) return options;

  return [...options, { key: selected, label: selected, unknown: true }];
}

export const POSITIONS: { key: ReBannerPosition; i18n: string; fallback: string }[] =
  [
    { key: "top", i18n: "wordpress.reBanner.positions.top", fallback: "Top" },
    {
      key: "bottom",
      i18n: "wordpress.reBanner.positions.bottom",
      fallback: "Bottom",
    },
  ];

/**
 * `Re_Banner_CPT::effective_align()`: what `auto` means for each layout. The
 * alignment control shows this resolved value rather than a fourth "auto"
 * state — a person sees where their banner IS, and clicking a segment makes it
 * explicit from then on.
 */
export function effectiveAlign(
  variant: ReBannerVariant,
  align: ReBannerAlign,
): Exclude<ReBannerAlign, "auto"> {
  if (align === "left" || align === "center" || align === "right") return align;
  return variant === "hero" ? "center" : "left";
}

export const ALIGNS: {
  key: Exclude<ReBannerAlign, "auto">;
  i18n: string;
  fallback: string;
}[] = [
  { key: "left", i18n: "wordpress.reBanner.aligns.left", fallback: "Left" },
  { key: "center", i18n: "wordpress.reBanner.aligns.center", fallback: "Centre" },
  { key: "right", i18n: "wordpress.reBanner.aligns.right", fallback: "Right" },
];

/** The editor's tabs, in order. */
export const EDITOR_TABS = ["content", "design", "schedule", "placement"] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

/*
 * Both halves of the screen's state live in the URL, so a banner can be
 * linked to, a refresh lands where it was, and the browser's back button
 * closes the editor: `?banner=1739&tab=design`, `?banner=new` while creating,
 * nothing at all for the list.
 */
export const BANNER_PARAM = "banner";
export const TAB_PARAM = "tab";

export function tabFromParam(value: string | null): EditorTab {
  return EDITOR_TABS.includes(value as EditorTab) ? (value as EditorTab) : "content";
}

/** `?banner=` → what is being edited: a banner id, "new", or nothing (the list). */
export function editingFromParam(value: string | null): number | "new" | null {
  if (value === "new") return "new";
  if (value !== null && /^\d+$/.test(value)) return Number(value);
  return null;
}

export const PLACEMENTS: {
  key: ReBannerPlacement;
  i18n: string;
  fallback: string;
  hintI18n: string;
  hint: string;
}[] = [
  {
    key: "auto",
    i18n: "wordpress.reBanner.placements.auto",
    fallback: "At the top of the page",
    hintI18n: "wordpress.reBanner.placements.autoHint",
    hint: "Pinned above the header by the plugin, on the pages you choose below.",
  },
  {
    key: "shortcode",
    i18n: "wordpress.reBanner.placements.shortcode",
    fallback: "Only with the shortcode",
    hintI18n: "wordpress.reBanner.placements.shortcodeHint",
    hint: "Never pinned. Appears exactly where you paste its shortcode.",
  },
];

export const VISIBILITIES: {
  key: ReBannerVisibility;
  i18n: string;
  fallback: string;
}[] = [
  {
    key: "all",
    i18n: "wordpress.reBanner.visibilities.all",
    fallback: "Everywhere",
  },
  {
    key: "include",
    i18n: "wordpress.reBanner.visibilities.include",
    fallback: "Only on selected pages",
  },
  {
    key: "exclude",
    i18n: "wordpress.reBanner.visibilities.exclude",
    fallback: "Everywhere except selected pages",
  },
];

/** Badge wording per derived state. */
export const STATE_I18N: Record<
  ReBannerState,
  { i18n: string; fallback: string }
> = {
  live: { i18n: "wordpress.reBanner.states.live", fallback: "Live" },
  scheduled: {
    i18n: "wordpress.reBanner.states.scheduled",
    fallback: "Scheduled",
  },
  expired: { i18n: "wordpress.reBanner.states.expired", fallback: "Expired" },
  paused: { i18n: "wordpress.reBanner.states.paused", fallback: "Paused" },
};

/** Badge colouring per derived state. Only "live" is a positive signal. */
export const STATE_TONE: Record<ReBannerState, string> = {
  live: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  scheduled: "bg-primary/10 text-primary border-primary/20",
  expired: "bg-muted text-muted-foreground border-transparent",
  paused: "bg-muted text-muted-foreground border-transparent",
};

/** Sets one key of the editor draft. */
export type SetConfig = <K extends keyof ReBannerConfig>(
  key: K,
  value: ReBannerConfig[K],
) => void;

/**
 * The shortcode to show for a banner.
 *
 * `[re_banner]` rather than the shorter `[banner]`, deliberately: `banner` is a
 * generic tag the plugin registers only when no other plugin or theme on that
 * site already owns it, and this dashboard cannot see whether it did. wp-admin
 * knows and shows the short form there; the long one always works.
 */
export function shortcodeFor(id: number): string {
  return `[re_banner id="${id}"]`;
}

/** Drop the server-assigned fields to get the part the editor actually edits. */
export function toConfig(banner: ReBanner): ReBannerConfig {
  const { id: _id, image_url: _imageUrl, state: _state, ...config } = banner;
  return config;
}

/** The words without their markup — for list excerpts and derived names. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Is there anything left once the markup is taken away? */
export function isBlankHtml(html: string): boolean {
  return stripHtml(html) === "";
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}

/* ── Dates ───────────────────────────────────────────────────────────────
 *
 * The API speaks 'YYYY-MM-DD HH:MM' wall-clock in the SITE's timezone. The
 * editor's date + time controls live in banner-schedule-fields.tsx, which
 * splits and joins that string without ever constructing a `Date` from it.
 * ------------------------------------------------------------------------ */

/** A compact human description of a banner's window. */
export function scheduleLabel(banner: {
  starts_at: string;
  ends_at: string;
}): string {
  if (!banner.starts_at && !banner.ends_at) return "Always on";
  if (!banner.ends_at) return `From ${banner.starts_at}`;
  if (!banner.starts_at) return `Until ${banner.ends_at}`;
  return `${banner.starts_at} → ${banner.ends_at}`;
}
