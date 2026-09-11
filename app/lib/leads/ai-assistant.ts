import type { Lead } from "~/lib/api/leads";

/**
 * Metadata written onto a lead by an AI assistant.
 *
 * Lead capture writes plain keys (`assistant_name`, `conversation_id`,
 * `page_url`, `transcript_summary`). A booking action writes its keys prefixed
 * with the action's own id — a builder-generated `a` + 8 base36 chars, e.g.
 * `abzju9jes_region`. Humanized naively that reads "Abzju9jes Region", which is
 * what the leads UI used to show.
 *
 * Two jobs here: work out which prefixes a lead actually carries, and split the
 * prefixed keys into the ones worth showing (answers the visitor gave) and the
 * ones that are pure plumbing.
 */

/** Minimal lead shape, so brand-view row types can use these helpers too. */
export type AiLeadLike = Pick<Lead, "metadata">;

/**
 * Suffixes a booking action stamps. Order matters only for readability; the
 * longest-match rule in `aiActionPrefixes` handles `_appointment` vs
 * `_appointment_status`.
 */
const BOOKING_SUFFIXES = [
  "appointment",
  "appointment_status",
  "booking_id",
  "event_id",
  "provider",
  "meet_link",
  "hosts",
  "booking_failed",
  "orphaned_events",
  "product_interest",
  "region",
] as const;

/**
 * Plumbing: opaque ids, and stamps the appointment banner already renders
 * (provider icon, time range, "Join meeting", cancelled state). Showing them
 * again as raw rows tells the reader nothing.
 */
const HIDDEN_BOOKING_SUFFIXES = [
  "appointment_status",
  "booking_id",
  "event_id",
  "provider",
  "meet_link",
  "hosts",
  "booking_failed",
  "orphaned_events",
] as const;

/**
 * Unprefixed keys hidden from "Additional info".
 *
 * `conversation_id` is an opaque id the reader cannot act on, and
 * `transcript_summary` is rendered as a chat by <LeadConversation> rather than
 * crammed into a one-line field row.
 */
export const AI_HIDDEN_META_KEYS: readonly string[] = [
  "conversation_id",
  "transcript_summary",
];

function metaOf(lead: AiLeadLike): Record<string, unknown> {
  const metadata = lead.metadata;
  return metadata && typeof metadata === "object"
    ? (metadata as Record<string, unknown>)
    : {};
}

/**
 * Every action-id prefix present on this lead.
 *
 * Derived from the lead's own keys rather than pattern-matching the id format,
 * so it survives the builder changing how it mints ids — and it still works
 * when a booking failed and no `_appointment` key was ever written.
 */
export function aiActionPrefixes(lead: AiLeadLike): string[] {
  const prefixes = new Set<string>();
  for (const key of Object.keys(metaOf(lead))) {
    for (const suffix of BOOKING_SUFFIXES) {
      const tail = `_${suffix}`;
      if (key.endsWith(tail) && key.length > tail.length) {
        prefixes.add(key.slice(0, -tail.length));
      }
    }
  }
  // `<p>_appointment_status` also yields the bogus prefix `<p>_appointment`.
  // Drop any prefix that is itself another prefix plus "_appointment".
  for (const prefix of [...prefixes]) {
    const SUFFIX = "_appointment";
    if (prefix.endsWith(SUFFIX) && prefixes.has(prefix.slice(0, -SUFFIX.length))) {
      prefixes.delete(prefix);
    }
  }
  return [...prefixes];
}

/** Keys to hide outright from "Additional info". */
export function aiClaimedMetaKeys(lead: AiLeadLike): Set<string> {
  const meta = metaOf(lead);
  const claimed = new Set<string>();

  for (const key of AI_HIDDEN_META_KEYS) {
    if (key in meta) claimed.add(key);
  }
  for (const prefix of aiActionPrefixes(lead)) {
    for (const suffix of HIDDEN_BOOKING_SUFFIXES) {
      claimed.add(`${prefix}_${suffix}`);
    }
  }
  return claimed;
}

/**
 * `abzju9jes_region` → `region`. Returns the key untouched when it carries no
 * known prefix, so ordinary form keys are never mangled.
 */
export function stripAiActionPrefix(key: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    const head = `${prefix}_`;
    if (key.startsWith(head) && key.length > head.length) {
      return key.slice(head.length);
    }
  }
  return key;
}

/** The conversation this lead came out of, when it came from an assistant. */
export function leadConversationRef(
  lead: Pick<Lead, "metadata" | "source_id" | "source_table">,
): { assistantId: string; conversationId: string } | null {
  if (lead.source_table !== "ai_assistants") return null;
  const conversationId = metaOf(lead).conversation_id;
  if (typeof conversationId !== "string" || conversationId === "") return null;
  if (!lead.source_id) return null;
  return { assistantId: lead.source_id, conversationId };
}
