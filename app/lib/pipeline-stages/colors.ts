/**
 * The single source of stage colors.
 *
 * A stage's `color` is a palette TOKEN (e.g. "emerald"), never a raw class or
 * hex — this file maps tokens to statically written Tailwind classes (so the
 * purge sees every string) and to hexes for recharts. Stages without a token
 * fall back to the exact classes the old hardcoded maps used for their key,
 * then to a category default, so nothing changes visually until an admin
 * picks a color.
 */

import type { PipelineStage, StageCategory } from "~/lib/api/pipeline-stages";

export interface StageColorFacets {
  /** Solid dot / column accent, e.g. kanban headers and badges. */
  dot: string;
  /** Left border accent (lead status select). */
  borderL: string;
  /** Text color for inline stage labels (deal badge). */
  text: string;
  /** Focus/hero ring (deal detail). */
  ring: string;
  /** Hero gradient (deal detail header). */
  heroBg: string;
  /** Chart color. */
  hex: string;
}

/** Kept in lockstep with STAGE_COLOR_TOKENS in nestjs-monolith pipeline-stage.types.ts. */
export const STAGE_COLOR_TOKENS = [
  "slate",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "emerald",
  "teal",
  "sky",
  "blue",
  "violet",
  "pink",
] as const;
export type StageColorToken = (typeof STAGE_COLOR_TOKENS)[number];

function facets(
  dot: string,
  borderL: string,
  text: string,
  ring: string,
  heroBg: string,
  hex: string,
): StageColorFacets {
  return { dot, borderL, text, ring, heroBg, hex };
}

// Every class string below is written out literally per token — do not derive
// them dynamically outside this file, the Tailwind purge must see them here.
export const TOKEN_FACETS: Record<StageColorToken, StageColorFacets> = {
  slate: facets(
    "bg-slate-500",
    "border-l-slate-500",
    "text-slate-600 dark:text-slate-300",
    "ring-slate-500/30",
    "from-slate-500/25 via-slate-500/10 to-primary/10 dark:from-slate-500/20 dark:via-slate-500/5 dark:to-primary/15",
    "#64748b",
  ),
  red: facets(
    "bg-red-500",
    "border-l-red-500",
    "text-red-700 dark:text-red-300",
    "ring-red-500/30",
    "from-red-500/25 via-red-500/10 to-primary/10 dark:from-red-500/20 dark:via-red-500/5 dark:to-primary/15",
    "#ef4444",
  ),
  orange: facets(
    "bg-orange-500",
    "border-l-orange-500",
    "text-orange-700 dark:text-orange-300",
    "ring-orange-500/30",
    "from-orange-500/25 via-orange-500/10 to-primary/10 dark:from-orange-500/20 dark:via-orange-500/5 dark:to-primary/15",
    "#f97316",
  ),
  amber: facets(
    "bg-amber-500",
    "border-l-amber-500",
    "text-amber-700 dark:text-amber-300",
    "ring-amber-500/30",
    "from-amber-500/25 via-amber-500/10 to-primary/10 dark:from-amber-500/20 dark:via-amber-500/5 dark:to-primary/15",
    "#f59e0b",
  ),
  yellow: facets(
    "bg-yellow-500",
    "border-l-yellow-500",
    "text-yellow-700 dark:text-yellow-300",
    "ring-yellow-500/30",
    "from-yellow-500/25 via-yellow-500/10 to-primary/10 dark:from-yellow-500/20 dark:via-yellow-500/5 dark:to-primary/15",
    "#eab308",
  ),
  lime: facets(
    "bg-lime-500",
    "border-l-lime-500",
    "text-lime-700 dark:text-lime-300",
    "ring-lime-500/30",
    "from-lime-500/25 via-lime-500/10 to-primary/10 dark:from-lime-500/20 dark:via-lime-500/5 dark:to-primary/15",
    "#84cc16",
  ),
  emerald: facets(
    "bg-emerald-500",
    "border-l-emerald-500",
    "text-emerald-700 dark:text-emerald-300",
    "ring-emerald-500/30",
    "from-emerald-500/25 via-emerald-500/10 to-primary/10 dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-primary/15",
    "#10b981",
  ),
  teal: facets(
    "bg-teal-500",
    "border-l-teal-500",
    "text-teal-700 dark:text-teal-300",
    "ring-teal-500/30",
    "from-teal-500/25 via-teal-500/10 to-primary/10 dark:from-teal-500/20 dark:via-teal-500/5 dark:to-primary/15",
    "#14b8a6",
  ),
  sky: facets(
    "bg-sky-500",
    "border-l-sky-500",
    "text-sky-700 dark:text-sky-300",
    "ring-sky-500/30",
    "from-sky-500/25 via-sky-500/10 to-primary/10 dark:from-sky-500/20 dark:via-sky-500/5 dark:to-primary/15",
    "#0ea5e9",
  ),
  blue: facets(
    "bg-blue-500",
    "border-l-blue-500",
    "text-blue-700 dark:text-blue-300",
    "ring-blue-500/30",
    "from-blue-500/25 via-blue-500/10 to-primary/10 dark:from-blue-500/20 dark:via-blue-500/5 dark:to-primary/15",
    "#3b82f6",
  ),
  violet: facets(
    "bg-violet-500",
    "border-l-violet-500",
    "text-violet-700 dark:text-violet-300",
    "ring-violet-500/30",
    "from-violet-500/25 via-violet-500/10 to-primary/10 dark:from-violet-500/20 dark:via-violet-500/5 dark:to-primary/15",
    "#8b5cf6",
  ),
  pink: facets(
    "bg-pink-500",
    "border-l-pink-500",
    "text-pink-700 dark:text-pink-300",
    "ring-pink-500/30",
    "from-pink-500/25 via-pink-500/10 to-primary/10 dark:from-pink-500/20 dark:via-pink-500/5 dark:to-primary/15",
    "#ec4899",
  ),
};

/**
 * The exact facet strings the old hardcoded maps used, keyed by legacy stage
 * key. Guarantees a workspace that never touches stage colors looks exactly
 * as it did before stages became configurable.
 */
const LEGACY_FACETS: Record<string, Partial<StageColorFacets>> = {
  // Leads (from LEAD_STATUS_COLORS / STATUS_BORDER_CLASSES / brand STATUS_COLORS)
  new_lead: { dot: "bg-blue-500", borderL: "border-l-blue-500", hex: "#5265f3" },
  pending: { dot: "bg-amber-500", borderL: "border-l-amber-500", hex: "#38bdf8" },
  in_progress: {
    dot: "bg-violet-500",
    borderL: "border-l-violet-500",
    hex: "#f5d74f",
  },
  rejected: { dot: "bg-red-500", borderL: "border-l-red-500", hex: "#f87171" },
  on_hold: {
    dot: "bg-orange-500",
    borderL: "border-l-orange-500",
    hex: "#fb923c",
  },
  stale: { dot: "bg-gray-500", borderL: "border-l-gray-500", hex: "#6b7280" },
  success: {
    dot: "bg-emerald-500",
    borderL: "border-l-emerald-500",
    hex: "#34d399",
  },
  hidden: { dot: "bg-muted", borderL: "border-l-muted", hex: "#9ca3af" },
  // Deals (from STAGE_COLORS / STAGE_COLOR / STAGE_TEXT / STAGE_RING / STAGE_HERO_BG).
  // `new` and lead `new_lead` don't collide: lookups are per stage row.
  new: {
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    ring: "ring-slate-400/30",
    heroBg:
      "from-slate-400/25 via-slate-400/10 to-primary/10 dark:from-slate-500/20 dark:via-slate-500/5 dark:to-primary/15",
    hex: "#94a3b8",
  },
  won: {
    dot: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-600/30",
    heroBg:
      "from-emerald-500/25 via-emerald-500/10 to-primary/10 dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-primary/15",
    hex: "#059669",
  },
  lost: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
    ring: "ring-red-500/30",
    heroBg:
      "from-red-500/25 via-red-500/10 to-primary/10 dark:from-red-500/20 dark:via-red-500/5 dark:to-primary/15",
    hex: "#ef4444",
  },
};
// Deal in_progress legacy facets differ from lead in_progress (sky vs violet),
// but they share the key. Resolve the collision by entity at lookup time.
const LEGACY_DEAL_IN_PROGRESS: Partial<StageColorFacets> = {
  dot: "bg-sky-500",
  text: "text-sky-700 dark:text-sky-300",
  ring: "ring-sky-500/30",
  heroBg:
    "from-sky-500/25 via-sky-500/10 to-primary/10 dark:from-sky-500/20 dark:via-sky-500/5 dark:to-primary/15",
  hex: "#0ea5e9",
};

const CATEGORY_DEFAULT_TOKEN: Record<StageCategory, StageColorToken> = {
  open: "sky",
  won: "emerald",
  lost: "red",
  hidden: "slate",
};

/** Minimal shape resolveStageColors needs — a full PipelineStage always satisfies it. */
export type StageColorInput = Pick<
  PipelineStage,
  "entity" | "key" | "category"
> & { color?: string | null };

/**
 * Facets for a stage: admin-picked token → legacy per-key look → category
 * default. Always returns a complete facet set.
 */
export function resolveStageColors(stage: StageColorInput): StageColorFacets {
  const base = TOKEN_FACETS[CATEGORY_DEFAULT_TOKEN[stage.category] ?? "slate"];
  if (stage.color && stage.color in TOKEN_FACETS) {
    return TOKEN_FACETS[stage.color as StageColorToken];
  }
  const legacy =
    stage.entity === "deal" && stage.key === "in_progress"
      ? LEGACY_DEAL_IN_PROGRESS
      : LEGACY_FACETS[stage.key];
  return legacy ? { ...base, ...legacy } : base;
}

/**
 * Facets for a raw stage key when no stage row is available (legacy data whose
 * stage was deleted, cross-workspace brand views).
 */
export function resolveStageColorsByKey(
  entity: "lead" | "deal",
  key: string,
): StageColorFacets {
  return resolveStageColors({ entity, key, category: "open", color: null });
}
