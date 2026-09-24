/**
 * Onboarding-v2 answers on a root-workspace lead.
 *
 * The root intake stamps the customer's whole profile onto the lead as flat
 * `onboarding_<section>_<field>` metadata keys (≈60 of them). Shown raw they
 * drown "Additional info", so the sheet claims them and shows them grouped by
 * section in their own collapsible instead. The deal's "Onboarding profile"
 * panel is the nicer view; this is the complete one.
 */
export const ONBOARDING_SECTIONS = [
  "identity",
  "presence",
  "location",
  "contact",
  "hours",
  "offer",
  "team",
  "legal",
  "online",
  "socials",
  "google_business",
  "email_setup",
  "goals",
  "interests",
  "sales",
  "domain",
] as const;

/** Stamps that are bookkeeping, not answers. */
const HIDDEN = new Set(["onboarding_source_id"]);

interface LeadLike {
  metadata?: Record<string, unknown> | null;
}

export function isOnboardingKey(key: string): boolean {
  return key.startsWith("onboarding_");
}

export function onboardingClaimedMetaKeys(lead: LeadLike): Set<string> {
  return new Set(Object.keys(lead.metadata ?? {}).filter(isOnboardingKey));
}

export interface OnboardingGroup {
  /** A profile section, or "run" for status/plan/invites/notifications. */
  section: string;
  rows: Array<{ key: string; field: string; value: unknown }>;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

export function onboardingGroups(lead: LeadLike): OnboardingGroup[] {
  const meta = lead.metadata ?? {};
  const bySection = new Map<string, OnboardingGroup>();
  // Longest section names first so "google_business" wins over a shorter prefix.
  const sections = [...ONBOARDING_SECTIONS].sort((a, b) => b.length - a.length);
  for (const [key, value] of Object.entries(meta)) {
    if (!isOnboardingKey(key) || HIDDEN.has(key) || isEmpty(value)) continue;
    const rest = key.slice("onboarding_".length);
    const section = sections.find((s) => rest.startsWith(`${s}_`));
    const group = section ?? "run";
    const field = section ? rest.slice(section.length + 1) : rest;
    const g = bySection.get(group) ?? { section: group, rows: [] };
    g.rows.push({ key, field, value });
    bySection.set(group, g);
  }
  const order = ["run", ...ONBOARDING_SECTIONS];
  return [...bySection.values()].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
}

/** "legal_name" → "Legal name". */
export function humanizeField(field: string): string {
  const s = field.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatOnboardingValue(value: unknown, yes: string, no: string): string {
  if (typeof value === "boolean") return value ? yes : no;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => !isEmpty(v))
      .map(([k, v]) => `${humanizeField(k)}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("\n");
  }
  return String(value);
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Enum answers read as words (legal form, goals, notification names…);
 * everything else (free text the customer typed) is shown as written.
 */
export function translateOnboardingValue(section: string, field: string, value: unknown, t: T): unknown {
  const one = (key: string, v: unknown) => (typeof v === "string" ? t(key.replace("{v}", v), { defaultValue: v, count: 1 }) : v);
  const many = (key: string, v: unknown) => (Array.isArray(v) ? v.map((x) => one(key, x)) : one(key, v));
  const path = `${section}.${field}`;
  switch (path) {
    case "identity.legal_form":
      return one("onb.legalForms.{v}", value);
    case "identity.industry":
      return one("clientTypes.{v}", value);
    case "presence.kind":
      return one("onb.presence.{v}.title", value);
    case "offer.price_segment":
      return one("onb.priceSegment.{v}", value);
    case "offer.customer_type":
      return one("onb.customerType.{v}", value);
    case "goals.primary_goals":
      return many("onb.goals.options.{v}", value);
    case "goals.lead_channels":
      return many("onb.goals.channelOptions.{v}", value);
    case "goals.monthly_inquiries":
      return one("onb.goals.volumeOptions.{v}", value);
    case "interests.website_plan":
      return one("onb.growth.plan.{v}.title", value);
    case "interests.ai_visibility":
      return one("onb.growth.ai.{v}", value);
    case "run.notifications":
      return many("onb.notif.kinds.{v}.title", value);
    default:
      return value;
  }
}
