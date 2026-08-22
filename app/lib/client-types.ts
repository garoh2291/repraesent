/**
 * Brand client types: what a brand calls its connected workspaces.
 * Keys only — the localized singular/plural wording lives in the
 * `clientTypes` namespace of app/i18n/locales/{en,de,fr,nl}.json.
 *
 * Kept in lockstep with nestjs-monolith/src/common/client-types.ts
 * (canonical list) and dendrite-admin-dashboard/app/lib/api/client-types.ts.
 */
export const CLIENT_TYPES = [
  "partner_house",
  "retailer",
  "shop",
  "boutique",
  "concept_store",
  "department_store",
  "online_shop",
  "supermarket",
  "kiosk",
  "medical_company",
  "pharmacy",
  "clinic",
  "dental_practice",
  "veterinary_clinic",
  "optician",
  "hair_salon",
  "beauty_salon",
  "spa_wellness",
  "fitness_studio",
  "hotel",
  "restaurant",
  "cafe",
  "distributor",
  "wholesaler",
  "franchise",
  "dealership",
  "agency",
  "florist",
  "plumber",
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const DEFAULT_CLIENT_TYPE: ClientType = "partner_house";

/** Coerce an arbitrary value into a client type; unknown values fall back to partner_house. */
export function normalizeClientType(value: unknown): ClientType {
  return (CLIENT_TYPES as readonly string[]).includes(value as string)
    ? (value as ClientType)
    : DEFAULT_CLIENT_TYPE;
}
