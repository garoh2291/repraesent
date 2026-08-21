import type { DealListItem } from "~/lib/api/deals";

/**
 * Sort modes for the deals pipeline (kanban columns + mobile list). Manual
 * ("custom") ordering is gone — columns are always sorted by date or amount,
 * newest first by default.
 */
export const DEAL_SORT_MODES = [
  "date_desc",
  "date_asc",
  "value_desc",
  "value_asc",
] as const;
export type DealSortMode = (typeof DEAL_SORT_MODES)[number];

export const DEFAULT_DEAL_SORT: DealSortMode = "date_desc";

export function isDealSortMode(v: string | null): v is DealSortMode {
  return !!v && (DEAL_SORT_MODES as readonly string[]).includes(v);
}

function dealValue(d: DealListItem): number {
  if (d.value == null || d.value === "") return 0;
  const n = Number(d.value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "Newest" means the last stage/status change, not creation — a deal moved
 * into a column yesterday outranks an older-moved one created today.
 * Never-moved deals fall back to created_at (creation set the initial stage).
 */
function dealDate(d: DealListItem): string {
  return d.stage_changed_at ?? d.created_at ?? "";
}

export function dealComparator(
  mode: DealSortMode,
): (a: DealListItem, b: DealListItem) => number {
  switch (mode) {
    case "date_asc":
      return (a, b) => dealDate(a).localeCompare(dealDate(b));
    case "value_desc":
      return (a, b) => dealValue(b) - dealValue(a);
    case "value_asc":
      return (a, b) => dealValue(a) - dealValue(b);
    case "date_desc":
    default:
      return (a, b) => dealDate(b).localeCompare(dealDate(a));
  }
}
