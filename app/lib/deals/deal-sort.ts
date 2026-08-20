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

export function dealComparator(
  mode: DealSortMode,
): (a: DealListItem, b: DealListItem) => number {
  switch (mode) {
    case "date_asc":
      return (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "");
    case "value_desc":
      return (a, b) => dealValue(b) - dealValue(a);
    case "value_asc":
      return (a, b) => dealValue(a) - dealValue(b);
    case "date_desc":
    default:
      return (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "");
  }
}
