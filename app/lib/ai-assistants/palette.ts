/**
 * The widget's colour/shape resolution, in one place.
 *
 * Before this the palette existed three times over — once in the widget's
 * `styles.css`, once hardcoded in `WidgetPreview`, once again in the hosted
 * page route — each with different hex values, which is why the builder
 * preview never matched the embed. The widget bundle lives in another package
 * and cannot be imported from here, so this module mirrors the same rules
 * (documented in the plan, section 1a); keep the two in lockstep.
 *
 * The rules, in order:
 *   1. `theme: "page"` derives the base from the surrounding page's own
 *      background and text colour. Everything else is mixed between those two.
 *   2. `light` / `dark` use fixed bases; `auto` picks one from the visitor's
 *      OS preference.
 *   3. `appearance.colors` overrides land on top of whatever step 1/2 produced,
 *      so "follow the page but force my brand cream" works.
 */
import type { AppearanceConfig } from "~/lib/api/ai-assistants";

export interface ResolvedPalette {
  /** Widget surface. */
  bg: string;
  /** Fields, quiet fills — 4% toward the foreground. */
  bg2: string;
  /** Hover/pressed fills — 8%. */
  bg3: string;
  fg: string;
  /** Secondary text — 62% of the way from bg to fg. */
  fg2: string;
  /** Tertiary text — 45%. */
  fg3: string;
  line: string;
  line2: string;
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  accent: string;
  accentText: string;
  /** True when the resolved background is dark. Drives shadows and scrims. */
  dark: boolean;
}

export interface PageColors {
  background: string;
  text: string;
}

const LIGHT_BASE: PageColors = { background: "#ffffff", text: "#111111" };
const DARK_BASE: PageColors = { background: "#141416", text: "#f4f4f5" };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: string | undefined | null): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance, 0–1. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * `t` of the way from `from` to `to`. Done in JS rather than with `color-mix`
 * because the widget must run on Safari versions that do not have it, and the
 * preview has to agree with the widget exactly.
 */
export function mix(from: string, to: string, t: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

/** Perceived luminance → white or near-black text on a fill. */
export function onColor(
  hex: string,
  mode: AppearanceConfig["accent_foreground"] = "auto",
): string {
  if (mode === "light") return "#ffffff";
  if (mode === "dark") return "#111111";
  if (!isHex(hex)) return "#ffffff";
  return luminance(hex) > 0.6 ? "#111111" : "#ffffff";
}

const TRANSPARENT = /^(transparent|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i;

function cssColorToHex(value: string): string | null {
  const v = value.trim();
  if (!v || TRANSPARENT.test(v)) return null;
  if (HEX.test(v)) return v;
  const m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  if (parts.length >= 4 && parts[3] === 0) return null;
  return toHex(parts[0], parts[1], parts[2]);
}

/**
 * Walk up from `el` until an element paints a non-transparent background,
 * falling back to `document.body` and then white. Mirrors the widget's own
 * host-element walk so the preview reports the same answer.
 */
export function readPageColors(el: Element | null): PageColors | null {
  if (!el || typeof window === "undefined") return null;
  let node: Element | null = el;
  let background: string | null = null;
  let text: string | null = null;
  while (node) {
    const cs = window.getComputedStyle(node);
    const bg = cssColorToHex(cs.backgroundColor);
    if (bg) {
      background = bg;
      text = cssColorToHex(cs.color);
      break;
    }
    node = node.parentElement;
  }
  if (!background && document.body) {
    const cs = window.getComputedStyle(document.body);
    background = cssColorToHex(cs.backgroundColor);
    text = cssColorToHex(cs.color);
  }
  if (!background) return null;
  return {
    background,
    text: text ?? (luminance(background) > 0.5 ? "#111111" : "#f4f4f5"),
  };
}

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/** The base bg/fg pair before any `colors` override. */
export function resolveBase(
  theme: AppearanceConfig["theme"],
  pageColors?: PageColors | null,
): PageColors {
  if (theme === "light") return LIGHT_BASE;
  if (theme === "dark") return DARK_BASE;
  if (theme === "auto") return prefersDark() ? DARK_BASE : LIGHT_BASE;
  // "page": the host page's own colours, or the light base when we cannot
  // read them (server render, detached node).
  if (pageColors && isHex(pageColors.background)) return pageColors;
  return prefersDark() ? DARK_BASE : LIGHT_BASE;
}

export function resolvePalette(
  ap: AppearanceConfig,
  pageColors?: PageColors | null,
): ResolvedPalette {
  const base = resolveBase(ap.theme, pageColors);
  const overrides = ap.colors ?? {};
  const pick = (key: keyof typeof overrides, fallback: string) =>
    isHex(overrides[key]) ? overrides[key]!.trim() : fallback;

  const bg = pick("background", base.background);
  const fg = pick("text", base.text);

  const accent = isHex(ap.primary_color) ? ap.primary_color : "#111111";
  const accentText = onColor(accent, ap.accent_foreground);

  const surface = pick("surface", mix(bg, fg, 0.04));
  const userBubble = pick("user_bubble", accent);

  return {
    bg,
    bg2: surface,
    bg3: isHex(overrides.surface)
      ? mix(surface, fg, 0.04)
      : mix(bg, fg, 0.08),
    fg,
    fg2: pick("muted", mix(bg, fg, 0.62)),
    fg3: mix(bg, fg, 0.45),
    line: pick("border", mix(bg, fg, 0.12)),
    line2: mix(bg, fg, 0.2),
    userBubble,
    userBubbleText: onColor(userBubble, ap.accent_foreground),
    assistantBubble: pick("assistant_bubble", mix(bg, fg, 0.05)),
    accent,
    accentText,
    dark: luminance(bg) < 0.5,
  };
}

// ---------------------------------------------------------------------------
// shape / space
// ---------------------------------------------------------------------------

export interface ResolvedRadii {
  panel: number;
  bubble: number;
  field: number;
}

const RADIUS_PRESETS: Record<AppearanceConfig["radius"], ResolvedRadii> = {
  sm: { panel: 6, bubble: 6, field: 6 },
  md: { panel: 12, bubble: 10, field: 8 },
  lg: { panel: 18, bubble: 16, field: 12 },
  pill: { panel: 24, bubble: 20, field: 999 },
};

/** `radius_px` wins over the preset; 0 means genuinely square. */
export function resolveRadii(ap: AppearanceConfig): ResolvedRadii {
  if (ap.radius_px == null) return RADIUS_PRESETS[ap.radius];
  const r = Math.max(0, Math.min(32, ap.radius_px));
  return { panel: r, bubble: Math.min(r, 20), field: Math.min(r, 14) };
}

export function resolveShadow(
  shadow: AppearanceConfig["shadow"],
  dark: boolean,
): string | undefined {
  if (shadow === "none") return undefined;
  const tint = dark ? "0,0,0" : "15,23,42";
  return shadow === "strong"
    ? `0 32px 64px -24px rgba(${tint},${dark ? 0.75 : 0.35}), 0 8px 24px -12px rgba(${tint},${dark ? 0.5 : 0.18})`
    : `0 18px 36px -20px rgba(${tint},${dark ? 0.55 : 0.22})`;
}

/** Conversation-area height per `height` preset, in px. */
export const HEIGHT_PX: Record<AppearanceConfig["height"], number> = {
  compact: 380,
  standard: 460,
  tall: 560,
};

/** The built-in width an embedded widget uses when `max_width` is null. */
export function defaultMaxWidth(widgetType: string): number {
  return widgetType === "section" ? 880 : 760;
}
