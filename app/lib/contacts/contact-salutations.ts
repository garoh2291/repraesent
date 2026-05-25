/**
 * Contact salutation: stored codes + labels. Keep in sync with
 * `api.repraesent.com/src/modules/contacts/contact-salutation.constants.ts`.
 */
export const SALUTATION_VALUES = [
  "mr",
  "mrs",
  "ms",
  "mx",
  "dr",
  "prof",
] as const;

export type Salutation = (typeof SALUTATION_VALUES)[number];

/** German UI labels (German only). */
export const SALUTATION_LABELS_DE: Record<Salutation, string> = {
  mr: "Herr",
  mrs: "Frau",
  ms: "Frau",
  mx: "Divers",
  dr: "Dr.",
  prof: "Prof.",
};

/** English UI: salutation only. */
export const SALUTATION_LABELS_EN: Record<Salutation, string> = {
  mr: "Mr.",
  mrs: "Mrs.",
  ms: "Ms.",
  mx: "Mx.",
  dr: "Dr.",
  prof: "Prof.",
};

export function isSalutation(value: string): value is Salutation {
  return (SALUTATION_VALUES as readonly string[]).includes(value);
}
