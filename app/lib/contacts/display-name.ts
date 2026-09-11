/**
 * What to call a person who has no name.
 *
 * Newsletter signups arrive with an address and nothing else, so "nameless" is
 * now an ordinary state rather than a broken record — and half the contacts in
 * a real workspace are already in it.
 *
 * Two traps this exists to close:
 *
 *  - **`contacts.full_name` is a GENERATED column** —
 *    `TRIM(COALESCE(first,'') || ' ' || COALESCE(last,''))` — so a nameless
 *    contact has `""`, not NULL. Every `full_name ?? fallback` in the codebase
 *    silently renders an empty string, while the identical line works on the
 *    lead side where the column really is NULL. Only `||` is safe for both.
 *  - **The email is a better label than a generic word.** "Contact", "Lead",
 *    "—" and "Unknown" are all the same non-answer; the address is the thing
 *    the person actually typed, and it is what they will be searched by.
 */

export interface PersonLike {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/**
 * Name → email → null.
 *
 * Returns null rather than a placeholder so the caller decides what a total
 * blank looks like in its own context — a table cell, an avatar and a page
 * title want different things.
 */
export function personName(person: PersonLike | null | undefined): string | null {
  if (!person) return null;

  const full = person.full_name?.trim();
  if (full) return full;

  const joined = [person.first_name, person.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (joined) return joined;

  return person.email?.trim() || null;
}

/**
 * The same chain with a caller-supplied last resort.
 *
 * Pass the translated "Unknown" — this file stays free of i18n so the backend
 * twin and the byte-level tests do not need an i18n context.
 */
export function personNameOr(
  person: PersonLike | null | undefined,
  fallback: string,
): string {
  return personName(person) ?? fallback;
}

/**
 * Initials for an avatar.
 *
 * An address falls back to its first letter rather than to two letters of the
 * domain — "JO" for `joe@…` reads as a person, "GM" for `…@gmail.com` reads as
 * a mistake. Returns null when there is nothing at all, so the caller can draw
 * a neutral shape instead of a placeholder glyph; a circle containing "—" or
 * "CO" is worse than a circle containing nothing.
 */
export function personInitials(
  person: PersonLike | null | undefined,
): string | null {
  const name = personName(person);
  if (!name) return null;

  if (name.includes("@")) return name.slice(0, 1).toUpperCase();

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
