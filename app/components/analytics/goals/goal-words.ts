import type { TFunction } from "i18next";
import type { GoalSpec, PresetKey } from "~/lib/api/website-goals";

/** Ready-made goals, in the order owners care about them. */
export const PRESETS: PresetKey[] = ["directions", "whatsapp", "social", "download"];

export function presetLabel(key: PresetKey, t: TFunction): string {
  const map: Record<PresetKey, [string, string]> = {
    directions: ["analytics.goals.preset.directions", "Asked for directions"],
    whatsapp: ["analytics.goals.preset.whatsapp", "Opened WhatsApp"],
    social: ["analytics.goals.preset.social", "Went to your social media"],
    download: ["analytics.goals.preset.download", "Downloaded a file"],
  };
  return t(map[key][0], map[key][1]);
}

export function presetHint(key: PresetKey, t: TFunction): string {
  const map: Record<PresetKey, [string, string]> = {
    directions: ["analytics.goals.presetHint.directions", "Tapped a Google Maps or Apple Maps link"],
    whatsapp: ["analytics.goals.presetHint.whatsapp", "Tapped a WhatsApp link"],
    social: ["analytics.goals.presetHint.social", "Instagram, Facebook, YouTube, LinkedIn, TikTok…"],
    download: ["analytics.goals.presetHint.download", "A price list, a PDF, a catalogue…"],
  };
  return t(map[key][0], map[key][1]);
}

/** Plain names for the events the tracking script sends by itself. */
export function eventLabel(name: string, t: TFunction): string {
  if (name === "Outbound Link: Click") return t("analytics.goal.outbound", "Clicked a link to another site");
  if (name === "File Download") return t("analytics.goal.download", "Downloaded a file");
  if (name === "404") return t("analytics.goal.notFound", "Opened a page that doesn't exist");
  return name;
}

/** "Asked for directions", "Visited /preise/", "Clicked a link to shop.de"… */
export function specSummary(spec: GoalSpec, t: TFunction): string {
  if (spec.kind === "preset" && spec.preset) return presetLabel(spec.preset, t);
  const match = (spec.match ?? {}) as { path?: string; name?: string; prop?: { contains: string[] } };
  if (spec.kind === "page" && match.path) {
    return match.path.includes("*")
      ? t("analytics.goals.summary.pageGroup", "Visited a page under {{path}}", { path: match.path.replace(/\*+$/, "") })
      : t("analytics.goals.summary.page", "Visited {{path}}", { path: match.path });
  }
  if (match.name === "Outbound Link: Click" && match.prop?.contains?.length) {
    return t("analytics.goals.summary.link", "Clicked a link to {{host}}", { host: match.prop.contains[0] });
  }
  return match.name ? eventLabel(match.name, t) : "";
}

/** A short default name for a picked goal (the owner can change it). */
export function defaultLabel(spec: GoalSpec, t: TFunction): string {
  const match = (spec.match ?? {}) as { path?: string };
  if (spec.kind === "page" && match.path && !match.path.includes("*")) {
    if (match.path === "/") return t("analytics.goals.summary.home", "Visited the home page");
  }
  return specSummary(spec, t).slice(0, 80);
}

/** Stable identity of a spec, for list keys and "already added". */
export function specKey(spec: GoalSpec): string {
  return JSON.stringify([spec.kind, spec.preset ?? null, spec.match ?? {}]);
}
