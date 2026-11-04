/**
 * re:accessibility settings as the editor sees them — the `re_accessibility_settings`
 * option, one to one.
 *
 * DEFAULTS, the bounds and the choice lists mirror `Re_Accessibility_Settings` in the
 * plugin (defaults(), number_bounds(), choices()). The plugin's sanitizer is
 * the authority: anything out of range is put back to its default there, and
 * the page re-seeds from what WordPress reports it stored.
 *
 * This folder is copied verbatim into shtemaran.repraesent.com; the only
 * delta there is the `useTranslation` import.
 */

/** The menu's adjustments in menu order, mirroring `Re_Accessibility_Features::all()`. */
export const FEATURE_KEYS = [
  "contrast",
  "saturation",
  "links",
  "images",
  "text",
  "spacing",
  "lineheight",
  "align",
  "dyslexia",
  "cursor",
  "tooltips",
  "pause",
] as const;

export type ReAccessibilityFeature = (typeof FEATURE_KEYS)[number];

/** The tabs the menu groups its adjustments under (`Re_Accessibility_Features::groups()`). */
export const FEATURE_GROUPS = [
  { id: "seeing", features: ["contrast", "saturation", "links", "images"] },
  {
    id: "reading",
    features: ["text", "spacing", "lineheight", "align", "dyslexia"],
  },
  { id: "navigating", features: ["cursor", "tooltips", "pause"] },
] as const satisfies readonly {
  id: string;
  features: readonly ReAccessibilityFeature[];
}[];

export type ReAccessibilityFeatureGroup = (typeof FEATURE_GROUPS)[number]["id"];

export const LAUNCHER_ICONS = [
  "contrast",
  "eye",
  "sliders",
  "text",
  "access",
  "access-ring",
  "wheelchair",
  "heart",
] as const;

export type ReAccessibilityLauncherIcon = (typeof LAUNCHER_ICONS)[number];

export interface ReAccessibilitySettings {
  enabled: boolean;
  // Button
  position: "left" | "right";
  offset_x: number;
  offset_y: number;
  launcher_icon: ReAccessibilityLauncherIcon;
  launcher_size: number;
  launcher_icon_size: number;
  launcher_color: string;
  launcher_icon_color: string;
  launcher_border_color: string;
  launcher_border_width: number;
  launcher_radius: number;
  launcher_shadow: boolean;
  hide_on_mobile: boolean;
  // Menu
  panel_width: number;
  panel_radius: number;
  card_radius: number;
  control_radius: number;
  accent_color: string;
  surface_color: string;
  header_color: string;
  card_color: string;
  text_color: string;
  muted_color: string;
  line_color: string;
  show_oversized: boolean;
  show_widget_options: boolean;
  features: Record<ReAccessibilityFeature, boolean>;
  // Whole site
  shortcut: boolean;
  skip_link: boolean;
  focus_ring: boolean;
  focus_color: string;
  reduced_motion: boolean;
  // Statement
  statement_page_id: number;
  statement_url: string;
  contact_email: string;
  contact_phone: string;
  statement_date: string;
}

export const DEFAULTS: ReAccessibilitySettings = {
  enabled: true,
  position: "left",
  offset_x: 20,
  offset_y: 20,
  launcher_icon: "contrast",
  launcher_size: 48,
  launcher_icon_size: 50,
  launcher_color: "#1f2937",
  launcher_icon_color: "#ffffff",
  launcher_border_color: "#ffffff",
  launcher_border_width: 0,
  launcher_radius: 14,
  launcher_shadow: true,
  hide_on_mobile: false,
  panel_width: 380,
  panel_radius: 16,
  card_radius: 12,
  control_radius: 8,
  accent_color: "#1f2937",
  surface_color: "#f4f4f5",
  header_color: "#ffffff",
  card_color: "#ffffff",
  text_color: "#18181b",
  muted_color: "#52525b",
  line_color: "#e4e4e7",
  show_oversized: true,
  show_widget_options: true,
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<
    ReAccessibilityFeature,
    boolean
  >,
  shortcut: true,
  skip_link: true,
  focus_ring: true,
  focus_color: "#1f2937",
  reduced_motion: true,
  statement_page_id: 0,
  statement_url: "",
  contact_email: "",
  contact_phone: "",
  statement_date: "",
};

/** Mirrors `Re_Accessibility_Settings::number_bounds()`: key → [min, max]. */
export const BOUNDS = {
  offset_x: [0, 200],
  offset_y: [0, 400],
  launcher_size: [44, 80],
  launcher_icon_size: [40, 80],
  launcher_border_width: [0, 6],
  launcher_radius: [0, 40],
  panel_width: [320, 480],
  panel_radius: [0, 32],
  card_radius: [0, 24],
  control_radius: [0, 22],
} as const satisfies Partial<Record<keyof ReAccessibilitySettings, readonly [number, number]>>;

export type PatchSettings = (
  updater: (prev: ReAccessibilitySettings) => ReAccessibilitySettings,
) => void;

/**
 * The two colours a site brings — its own main and second colour — and the
 * settings each one sets. Every one of them can still be fine-tuned alone.
 */
export const PRIMARY_KEYS = ["launcher_color", "accent_color"] as const;
export const SECONDARY_KEYS = [
  "launcher_icon_color",
  "launcher_border_color",
] as const;

/** The background colours of the menu, set together by a preset. */
export type MenuPalette = Pick<
  ReAccessibilitySettings,
  | "surface_color"
  | "header_color"
  | "card_color"
  | "text_color"
  | "muted_color"
  | "line_color"
>;

/**
 * One-click starting points for the menu's backgrounds and text, all
 * neutral. Each keeps text at WCAG AA contrast (4.5:1) on its cards and
 * background; the main and second colour stay the site's.
 */
export const MENU_PALETTES: { id: string; palette: MenuPalette }[] = [
  {
    id: "light",
    palette: {
      surface_color: "#f4f4f5",
      header_color: "#ffffff",
      card_color: "#ffffff",
      text_color: "#18181b",
      muted_color: "#52525b",
      line_color: "#e4e4e7",
    },
  },
  {
    id: "white",
    palette: {
      surface_color: "#ffffff",
      header_color: "#ffffff",
      card_color: "#fafafa",
      text_color: "#18181b",
      muted_color: "#52525b",
      line_color: "#e4e4e7",
    },
  },
  {
    id: "dark",
    palette: {
      surface_color: "#18181b",
      header_color: "#18181b",
      card_color: "#27272a",
      text_color: "#fafafa",
      muted_color: "#a1a1aa",
      line_color: "#3f3f46",
    },
  },
  {
    id: "contrast",
    palette: {
      surface_color: "#000000",
      header_color: "#000000",
      card_color: "#000000",
      text_color: "#ffffff",
      muted_color: "#e5e5e5",
      line_color: "#ffffff",
    },
  },
];

const HEX6 = /^#[0-9a-f]{6}$/i;

export function isHex6(value: string): boolean {
  return HEX6.test(value);
}

/**
 * WCAG contrast ratio of two 6-digit hex colours, or null when either isn't
 * one yet (half-typed).
 */
export function contrastRatio(a: string, b: string): number | null {
  if (!isHex6(a) || !isHex6(b)) return null;
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mirrors `Re_Accessibility_Settings::is_light()`: dark marks read better on it. */
export function isLight(hex: string): boolean {
  const l = luminance(hex);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Fields the plugin's sanitizer would not take as typed — what it stored
 * differs from what was sent. A save reports them, because otherwise the field
 * just snaps back (to empty, or to the default colour) without a word.
 */
export function rejectedFields(
  sent: ReAccessibilitySettings,
  stored: ReAccessibilitySettings,
): ("contact_email" | "contact_phone" | "statement_url" | "colours")[] {
  const out: ("contact_email" | "contact_phone" | "statement_url" | "colours")[] = [];
  for (const key of ["contact_email", "contact_phone"] as const) {
    const typed = sent[key].trim();
    if (typed !== "" && stored[key] !== typed) out.push(key);
  }
  // WordPress tidies an address it keeps ("x.de" → "http://x.de"), so only an
  // empty result means it was refused.
  if (sent.statement_url.trim() !== "" && stored.statement_url === "") {
    out.push("statement_url");
  }
  const colourChanged = (Object.keys(DEFAULTS) as (keyof ReAccessibilitySettings)[])
    .filter((k) => k.endsWith("_color"))
    .some((k) => expandHex(String(sent[k])) !== String(stored[k]).toLowerCase());
  if (colourChanged) out.push("colours");
  return out;
}

/** "#ABC" → "#aabbcc", as the plugin stores it; anything else as typed. */
export function expandHex(value: string): string {
  const v = value.trim().toLowerCase();
  return /^#[0-9a-f]{3}$/.test(v)
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v;
}
