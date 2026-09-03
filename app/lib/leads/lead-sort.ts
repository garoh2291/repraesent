import type { GetLeadsParams } from "~/lib/api/leads";

/**
 * Sort modes for the leads kanban, mirroring `~/lib/deals/deal-sort.ts`.
 *
 * Two differences from the deals board, both forced by the data:
 *
 * - "manual" exists here. Leads kept their drag-to-reorder (`board_position`,
 *   migration 087) when the deals board dropped it, so manual is the default
 *   and no hand-arranged board changes shape when this dropdown ships.
 * - There are no amount modes. `leads` has no value column — only a paid
 *   product-form lead carries an amount, and that lives in metadata.
 *
 * The other structural difference is where the sorting happens. The deals
 * board fetches every deal in one query and sorts client-side; each leads
 * column is its own paginated infinite query, so sorting the loaded page would
 * only reorder the first 50 cards. Hence `leadSortToApi` — the server does it.
 */
export const LEAD_SORT_MODES = ["manual", "date_desc", "date_asc"] as const;
export type LeadSortMode = (typeof LEAD_SORT_MODES)[number];

export const DEFAULT_LEAD_SORT: LeadSortMode = "manual";

export function isLeadSortMode(v: string | null): v is LeadSortMode {
  return !!v && (LEAD_SORT_MODES as readonly string[]).includes(v);
}

/** The `sort` value `GET /leads` expects for a given board mode. */
export function leadSortToApi(mode: LeadSortMode): GetLeadsParams["sort"] {
  switch (mode) {
    case "date_asc":
      return "created_asc";
    case "date_desc":
      return "created_at";
    case "manual":
    default:
      return "board_position";
  }
}

/** Manual is the only mode in which dragging a card up or down means anything. */
export function isManualOrder(mode: LeadSortMode): boolean {
  return mode === "manual";
}
