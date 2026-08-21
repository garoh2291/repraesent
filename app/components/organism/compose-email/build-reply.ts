import type { BccMessage } from "~/lib/api/bcc-logs";
import type { Recipient } from "./recipient-field";

/** Addresses that must never be re-added when replying to all. */
export interface ReplyExclusions {
  /** The mailbox we send from, plus any alias. */
  ownAddresses: string[];
  /** The BCC logging domain — those addresses are plumbing, not people. */
  bccDomain: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function replySubject(subject: string | null): string {
  const base = (subject ?? "").trim();
  if (!base) return "Re:";
  return /^re\s*:/i.test(base) ? base : `Re: ${base}`;
}

/**
 * The quoted original, in the shape mail clients recognise and collapse.
 *
 * The original body is inserted as-is because it has already been through the
 * app's own rendering path; the server sanitizes the whole composed body again
 * before it goes out, so nothing here is trusted on the way to a recipient.
 */
export function replyQuote(
  message: BccMessage,
  locale: string,
  t: (key: string, opts: Record<string, unknown>) => string,
): string {
  const author =
    message.from_name?.trim() || message.from_address || "the sender";
  const when = message.sent_at ?? message.ingested_at;
  const stamp = when
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(when))
    : "";

  const intro = escapeHtml(
    t("compose.quoteIntro", {
      defaultValue: "On {{date}}, {{author}} wrote:",
      date: stamp,
      author,
    }),
  );

  const body =
    message.html_body ??
    `<p>${escapeHtml(message.text_body ?? "").replace(/\n/g, "<br />")}</p>`;

  return `<p></p><p>${intro}</p><blockquote>${body}</blockquote>`;
}

/**
 * Recipients for a reply.
 *
 * Reply goes to the sender. Reply-all adds everyone who was visibly on the
 * message, minus ourselves and minus the BCC logging address — copying our own
 * logging plumbing back onto a customer thread would leak it.
 */
export function replyRecipients(
  message: BccMessage,
  all: boolean,
  exclusions: ReplyExclusions,
): { to: Recipient[]; cc: Recipient[] } {
  const own = new Set(exclusions.ownAddresses.map((a) => a.toLowerCase()));
  const isOurs = (email: string) => {
    const lower = email.toLowerCase();
    return own.has(lower) || lower.endsWith(`@${exclusions.bccDomain}`);
  };

  const to: Recipient[] = message.from_address
    ? [{ email: message.from_address, name: message.from_name }]
    : [];

  if (!all) return { to, cc: [] };

  const seen = new Set(to.map((r) => r.email.toLowerCase()));
  const cc: Recipient[] = [];

  for (const p of message.participants) {
    if (p.kind !== "to" && p.kind !== "cc") continue;
    if (!p.email) continue;
    const lower = p.email.toLowerCase();
    if (seen.has(lower) || isOurs(p.email)) continue;
    seen.add(lower);
    cc.push({ email: p.email, name: p.display_name });
  }

  return { to, cc };
}
