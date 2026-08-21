import { useQueryClient } from "@tanstack/react-query";
import type { BccMessageParticipant } from "~/lib/api/bcc-logs";

/** "John Smith" → { firstName, lastName }. */
export function splitName(name: string | null | undefined): {
  firstName?: string;
  lastName?: string;
} {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Distinct recipient (to/cc) participants that carry an email. The sender
 * (from) is not a recipient and is intentionally excluded. */
export function emailParticipants(
  participants: BccMessageParticipant[],
): BccMessageParticipant[] {
  const seen = new Set<string>();
  const out: BccMessageParticipant[] = [];
  for (const p of participants) {
    if (!p.email) continue;
    if (p.kind !== "to" && p.kind !== "cc") continue;
    const key = p.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Invalidate every query that reflects a message↔contact change. */
export function useMailInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["mail-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-emails"] });
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    void queryClient.invalidateQueries({ queryKey: ["contact"] });
    // Linking a message to a contact can make a pending send reconcilable from
    // that contact's point of view, so the placeholder list has to re-read too.
    void queryClient.invalidateQueries({ queryKey: ["outbound-pending"] });
  };
}
