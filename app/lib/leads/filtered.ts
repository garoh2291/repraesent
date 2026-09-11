import type { Lead } from "~/lib/api/leads";

/**
 * The one metadata key the spam filter writes. Double-underscored because it
 * is ours, not the visitor's: a form field could plausibly be called
 * "filtered", never "__filtered".
 */
export const FILTERED_META_KEY = "__filtered";

/** Which layer filtered the lead. Mirrors EmailFilterRule on the server. */
export type LeadFilterRule = "disposable" | "suspicious_local" | "ai";

export interface LeadFilterVerdict {
  rule: LeadFilterRule;
  /** 0–100. The model's own number; the deterministic layers report 100. */
  confidence: number;
  /** The filter's own words. Shown as written — never translated. */
  reason: string;
  at: Date | null;
}

type FilteredLeadLike = Pick<Lead, "metadata">;

/**
 * Why this lead was hidden, if anything said.
 *
 * Leads filtered before this existed have no verdict, and that is the honest
 * answer for them: nothing was recorded, so the UI says nothing rather than
 * guessing a reason after the fact.
 */
export function extractLeadFilterVerdict(
  lead: FilteredLeadLike | null | undefined,
): LeadFilterVerdict | null {
  const meta = lead?.metadata as Record<string, unknown> | null | undefined;
  const raw = meta?.[FILTERED_META_KEY];
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown>;
  const rule = value.rule;
  if (rule !== "disposable" && rule !== "suspicious_local" && rule !== "ai") {
    return null;
  }

  const at =
    typeof value.at === "string" && !Number.isNaN(Date.parse(value.at))
      ? new Date(value.at)
      : null;

  return {
    rule,
    confidence:
      typeof value.confidence === "number" && Number.isFinite(value.confidence)
        ? value.confidence
        : 0,
    reason: typeof value.reason === "string" ? value.reason : "",
    at,
  };
}

/**
 * Hidden from "Additional info" — the filter note shows it instead.
 *
 * Unconditional, unlike the checkout and appointment key sets: a malformed
 * stamp is still ours, and a raw `__filtered` row is worse than no row.
 */
export const FILTERED_CLAIMED_META_KEYS: ReadonlySet<string> = new Set([
  FILTERED_META_KEY,
]);
