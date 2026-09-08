import { toast } from "sonner";
import type {
  ReBanner,
  ReBannerConfig,
  ReBannerPosition,
  ReBannerState,
  ReBannerVariant,
  ReBannerVisibility,
} from "~/lib/wordpress/plugin-settings-types";

/* ── Defaults (mirror Re_Banner_CPT::defaults) ───────────────────────── */

export const DEFAULTS: ReBannerConfig = {
  title: "",
  description: "",
  image_id: 0,
  cta_label: "",
  cta_type: "url",
  cta_url: "",
  cta_post_id: 0,
  cta_new_tab: false,
  variant: "bar",
  position: "top",
  accent_color: "#ffffff",
  text_color: "#ffffff",
  bg_color: "#0a0a0a",
  dismissible: true,
  starts_at: "",
  ends_at: "",
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
  ];

export const POSITIONS: { key: ReBannerPosition; i18n: string; fallback: string }[] =
  [
    { key: "top", i18n: "wordpress.reBanner.positions.top", fallback: "Top" },
    {
      key: "bottom",
      i18n: "wordpress.reBanner.positions.bottom",
      fallback: "Bottom",
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

export function shortcodeFor(id: number): string {
  return `[re_banner id="${id}"]`;
}

/** Drop the server-assigned fields to get the part the editor actually edits. */
export function toConfig(banner: ReBanner): ReBannerConfig {
  const {
    id: _id,
    name: _name,
    image_url: _imageUrl,
    state: _state,
    ...config
  } = banner;
  return config;
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}

/* ── Dates ───────────────────────────────────────────────────────────────
 *
 * The API speaks 'YYYY-MM-DD HH:MM' wall-clock in the SITE's timezone, and an
 * <input type="datetime-local"> speaks 'YYYY-MM-DDTHH:MM' with no timezone at
 * all. So these two are a pure string swap on purpose — going anywhere near
 * `new Date()` would reinterpret the site's wall-clock time in the browser's
 * timezone and move every banner by however far apart the two are.
 * ------------------------------------------------------------------------ */

export function toDateInput(stored: string): string {
  return stored ? stored.replace(" ", "T") : "";
}

export function fromDateInput(value: string): string {
  if (!value) return "";
  // Some browsers include seconds when the user picks from the calendar.
  return value.replace("T", " ").slice(0, 16);
}

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
