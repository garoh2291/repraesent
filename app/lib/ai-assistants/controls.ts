/**
 * Which appearance controls apply to which widget type.
 *
 * One map, every consumer. Before this the launcher and "On the page" panels
 * were gated inline on `widgetType === "bubble"` while everything else was
 * shown unconditionally — so a section assistant was asked to configure a
 * launcher offset, and a bubble assistant was asked to translate
 * `section_title` into four languages (12 dead fields).
 */
import {
  WIDGET_STRING_KEYS,
  type WidgetStrings,
  type WidgetType,
} from "~/lib/api/ai-assistants";

export interface AppearanceControls {
  /** Floating launcher: position, icon, label, size, offsets, nudge, page rules. */
  launcher: boolean;
  /** Bubble-only conversation opener — embedded types show the hero instead. */
  greeting: boolean;
  /** Hero title/subtitle and the box the widget occupies on the page. */
  hero: boolean;
  /** Width / outer margin / height — only meaningful for an embedded widget. */
  box: boolean;
  /** The collapsed search-bar placeholder. */
  barPlaceholder: boolean;
}

export function controlsFor(type: WidgetType): AppearanceControls {
  const bubble = type === "bubble";
  return {
    launcher: bubble,
    greeting: bubble,
    hero: !bubble,
    box: !bubble,
    barPlaceholder: type === "bar",
  };
}

/** String keys every type uses. */
const SHARED_STRING_KEYS = [
  "placeholder",
  "header_subtitle",
  "send",
  "powered_by",
  "lead_intro",
  "lead_thanks",
  "lead_submit",
  "lead_skip",
  "error_generic",
  "feedback_thanks",
] as const satisfies ReadonlyArray<keyof WidgetStrings>;

const BUBBLE_STRING_KEYS = [
  "greeting",
  "launcher_label",
  "nudge_text",
] as const satisfies ReadonlyArray<keyof WidgetStrings>;

const HERO_STRING_KEYS = [
  "section_title",
  "section_subtitle",
] as const satisfies ReadonlyArray<keyof WidgetStrings>;

/**
 * The translatable strings this widget type actually renders, in the canonical
 * `WIDGET_STRING_KEYS` order. Gates both the per-locale accordion and what the
 * AI translator is asked to pay for.
 */
export function stringKeysFor(
  type: WidgetType,
): readonly (keyof WidgetStrings)[] {
  const c = controlsFor(type);
  const allowed = new Set<keyof WidgetStrings>(SHARED_STRING_KEYS);
  if (c.greeting) for (const k of BUBBLE_STRING_KEYS) allowed.add(k);
  if (c.hero) for (const k of HERO_STRING_KEYS) allowed.add(k);
  if (c.barPlaceholder) allowed.add("bar_placeholder");
  return WIDGET_STRING_KEYS.filter((k) => allowed.has(k));
}

/**
 * The strings promoted out of the Advanced accordion into first-class fields,
 * in the order they appear in the panel.
 */
export function promotedStringKeysFor(
  type: WidgetType,
): readonly (keyof WidgetStrings)[] {
  const c = controlsFor(type);
  const out: (keyof WidgetStrings)[] = [];
  if (c.hero) out.push("section_title", "section_subtitle");
  if (c.barPlaceholder) out.push("bar_placeholder");
  if (c.launcher) out.push("launcher_label", "nudge_text");
  return out;
}
