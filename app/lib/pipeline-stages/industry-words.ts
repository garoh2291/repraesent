import type { StageCategory } from "~/lib/api/pipeline-stages";

/**
 * Default deal-stage words by business type (PRODUCT_DOC_LEFTOVERS.md §1):
 * a salon books appointments, a shop sells, a plumber wins jobs. Same four
 * seeded stages underneath; only the words change, only where the owner
 * never typed their own name.
 */
export type StageWordGroup = "health" | "beauty" | "hospitality" | "trades" | "retail" | "business";

const GROUP_OF: Record<string, StageWordGroup> = {
  dental_practice: "health",
  clinic: "health",
  veterinary_clinic: "health",
  hair_salon: "beauty",
  beauty_salon: "beauty",
  spa_wellness: "beauty",
  fitness_studio: "beauty",
  hotel: "hospitality",
  restaurant: "hospitality",
  cafe: "hospitality",
  plumber: "trades",
  partner_house: "retail",
  retailer: "retail",
  shop: "retail",
  boutique: "retail",
  concept_store: "retail",
  department_store: "retail",
  online_shop: "retail",
  supermarket: "retail",
  kiosk: "retail",
  florist: "retail",
  optician: "retail",
  pharmacy: "retail",
  dealership: "retail",
  distributor: "business",
  wholesaler: "business",
  franchise: "business",
  agency: "business",
  medical_company: "business",
};

/**
 * The four seeded deal keys and the category each was seeded with. A stage
 * only gets business words when BOTH match — a custom stage that happens to
 * reuse a key (e.g. after the seeded one was deleted) always carries its own
 * label anyway, and a wrong category means it is not our seed.
 */
export const SEEDED_DEAL_STAGES: Record<string, StageCategory> = {
  new: "open",
  in_progress: "open",
  won: "won",
  lost: "lost",
};

export function stageWordGroup(industry: string | null | undefined): StageWordGroup | null {
  if (!industry) return null;
  return GROUP_OF[industry] ?? null;
}
