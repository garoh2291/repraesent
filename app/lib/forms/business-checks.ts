import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Checks for a business's contact details, the same rules the server applies
 * before it saves them into the business profile
 * (nestjs-monolith agency-businesses.service.ts `checkBusinessContact`,
 * profile.schema.ts). Used by the agency's "Add a business".
 */

/** Same as the profile's email rule. */
export const BUSINESS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s.length <= 254 && BUSINESS_EMAIL_RE.test(s);
}

/** A phone number that really exists in that country's plan (international form, or national with the country). */
export function isValidPhone(v: string, country?: string | null): boolean {
  const s = v.trim();
  if (!s) return true;
  const parsed = parsePhoneNumberFromString(s.replace(/^00/, "+"), (country?.toUpperCase() as CountryCode) || undefined);
  return !!parsed?.isValid();
}

const POSTAL: Record<string, RegExp> = {
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  US: /^\d{5}(-\d{4})?$/,
  AT: /^\d{4}$/,
  CH: /^\d{4}$/,
  BE: /^\d{4}$/,
  DK: /^\d{4}$/,
  LU: /^(L-?)?\d{4}$/i,
  NL: /^\d{4}\s?[A-Z]{2}$/i,
  PL: /^\d{2}-\d{3}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  AM: /^\d{4}$/,
};

/** Postal code in the country's format (known countries), else a plausible code. */
export function isValidPostalCode(v: string, country?: string | null): boolean {
  const s = v.trim();
  if (!s) return true;
  const rule = country ? POSTAL[country.toUpperCase()] : undefined;
  return rule ? rule.test(s) : /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(s);
}

/** An example postal code for the hint, when we know the format. */
export function postalExample(country?: string | null): string | null {
  const ex: Record<string, string> = { DE: "10115", FR: "75001", AT: "1010", CH: "8001", BE: "1000", NL: "1012 AB", LU: "1009", GB: "SW1A 1AA", US: "10001" };
  return country ? (ex[country.toUpperCase()] ?? null) : null;
}

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** "https://www.salon-mira.de/" → "www.salon-mira.de"; what the domain field keeps. */
export function bareHost(v: string): string {
  return v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export function isValidDomain(v: string): boolean {
  const s = bareHost(v);
  return !s || HOSTNAME_RE.test(s);
}

/** A website address someone typed: a host with a dot, optional scheme and path. */
export function isValidWebsite(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    return (u.protocol === "https:" || u.protocol === "http:") && HOSTNAME_RE.test(u.hostname);
  } catch {
    return false;
  }
}

/** "info", "info@" (the domain comes later) or a full address. */
const MAILBOX_RE = /^[a-z0-9._%+-]{1,64}(?:@|@[^\s@]+\.[^\s@]{2,})?$/i;

/** "info, anna\nhello@x.de" → ["info", "anna", "hello@x.de"]. */
export function splitMailboxes(v: string): string[] {
  return v
    .split(/[,;\n]/)
    .map((m) => m.trim())
    .filter(Boolean);
}

/** The mailbox names that aren't one (local part like "info", or a full address). */
export function badMailboxes(v: string): string[] {
  return splitMailboxes(v).filter((m) => !MAILBOX_RE.test(m));
}
