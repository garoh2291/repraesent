/**
 * Where a contact lives in the app. People and companies are one table but two
 * places — People and Companies under Customers — so every link that knows
 * what it points at goes through here. A link that does not know (`kind`
 * missing) uses the people path; the page itself then moves to the right one.
 */

export type ContactKindLike = "person" | "company" | string | null | undefined;

export function contactListPath(kind: ContactKindLike): string {
  return kind === "company" ? "/companies" : "/contacts";
}

export function contactPath(contact: {
  id: string;
  kind?: ContactKindLike;
}): string {
  return `${contactListPath(contact.kind)}/${contact.id}`;
}

/**
 * One line under a contact's name in a picker or a list: where they work
 * first (that is how the owner tells two Annas apart), then how to reach them.
 */
export function contactSubtitle(contact: {
  company?: string | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
}): string | null {
  const work = [contact.job_title?.trim(), contact.company?.trim()]
    .filter(Boolean)
    .join(" · ");
  return work || contact.email?.trim() || contact.phone?.trim() || null;
}
