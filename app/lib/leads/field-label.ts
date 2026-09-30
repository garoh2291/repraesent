/**
 * Readable label for a leads.metadata key — same rules as the server's
 * nestjs-monolith/src/modules/inquiry-alerts/alert-fields.ts humanizeMetaKey,
 * so the picker, the preview and the email agree.
 *
 * `preferred_date` / `preferredDate` → "Preferred date" (sentence case).
 * An AI booking action's id prefix (`abzju9jes_region`) is stripped.
 */
const AI_PREFIX_RE =
  /^a[a-z0-9]{8}_(appointment_status|appointment|booking_id|event_id|provider|meet_link|hosts|booking_failed|orphaned_events|product_interest|region)$/;

export function normalizeMetaKey(key: string): string {
  const m = AI_PREFIX_RE.exec(key);
  return m ? m[1] : key;
}

export function humanizeMetaKey(key: string): string {
  const words = normalizeMetaKey(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
