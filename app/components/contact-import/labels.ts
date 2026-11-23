import type { TFunction } from "i18next";
import { customFieldLabel, type ImportReasonCode, type ImportTarget } from "~/lib/api/contact-imports";

/** Where a column can go, grouped the way the picker shows them. */
export const TARGET_GROUPS: ReadonlyArray<{
  id: "who" | "reach" | "address";
  targets: ReadonlyArray<ImportTarget>;
}> = [
  {
    id: "who",
    targets: [
      "first_name",
      "last_name",
      "full_name",
      "company_name",
      "job_title",
      "salutation",
      "date_of_birth",
      "locale",
    ],
  },
  { id: "reach", targets: ["email", "email_2", "phone", "website"] },
  {
    id: "address",
    targets: [
      "address_line1",
      "address_postal_code",
      "address_city",
      "address_state",
      "address_country",
    ],
  },
];

const TARGET_DEFAULTS: Record<ImportTarget, string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  company_name: "Company",
  email: "Email",
  email_2: "Second email",
  phone: "Phone",
  job_title: "Job title",
  website: "Website",
  address_line1: "Street",
  address_postal_code: "Postcode",
  address_city: "Town or city",
  address_state: "State or region",
  address_country: "Country",
  salutation: "Salutation",
  date_of_birth: "Date of birth",
  locale: "Language",
  custom: "Keep as a detail",
  skip: "Don't bring in",
};

export function targetLabel(t: TFunction, target: ImportTarget): string {
  return t(`contacts.importV2.targets.${target}`, TARGET_DEFAULTS[target]);
}

export function groupLabel(t: TFunction, id: "who" | "reach" | "address"): string {
  const defaults = { who: "Who it is", reach: "How to reach them", address: "Address" };
  return t(`contacts.importV2.groups.${id}`, defaults[id]);
}

const REASON_DEFAULTS: Record<ImportReasonCode, string> = {
  no_identity: "No name, company, email or phone on this line",
  bad_email: "The email “{{detail}}” doesn't look right",
  company_name_missing: "No company name on this line",
  in_file_double: "Same contact as line {{line}} of the file, joined with it",
  already_here: "Already in your contacts, left as it is",
  nothing_new: "Already in your contacts, nothing new in the file",
  left_by_choice: "You chose to leave this contact as it is",
  stopped: "Not saved: the import was stopped before this line",
  email_taken: "Another contact already uses {{detail}}",
  failed: "Could not be saved: {{detail}}",
};

/** The file line a data row sits on: the header is line 1. */
export const fileLine = (rowIndex: number) => rowIndex + 2;

export function reasonText(
  t: TFunction,
  code: ImportReasonCode | null,
  detail: string | null,
): string {
  const c = code ?? "failed";
  return t(`contacts.importV2.reasons.${c}`, {
    defaultValue: REASON_DEFAULTS[c],
    detail: detail ?? "",
    line: c === "in_file_double" && detail != null ? fileLine(Number(detail)) : "",
  });
}

/** A field name in a "what changes" line: built-in fields or a custom field. */
export function changeFieldLabel(t: TFunction, field: string, customLabel: (key: string) => string): string {
  if (field.startsWith("custom:")) return customLabel(field.slice("custom:".length));
  if (field === "company") return targetLabel(t, "company_name");
  if (field === "address") return t("contacts.importV2.address", "Address");
  return targetLabel(t, field as ImportTarget);
}

const PROBLEM_TITLES: Partial<Record<ImportReasonCode, string>> = {
  no_identity: "have no name, company, email or phone",
  bad_email: "have an email that doesn't look right",
  company_name_missing: "have no company name",
};

/** The heading of a group of lines with the same problem ("3 × have no …"). */
export function problemTitle(t: TFunction, code: ImportReasonCode): string {
  return t(`contacts.importV2.problems.${code}`, PROBLEM_TITLES[code] ?? REASON_DEFAULTS[code]);
}

/**
 * A custom detail's name as shown to the owner. A file's own "Source" column
 * is told apart from the contact's built-in source ("CSV import", "Manual").
 */
export function detailLabel(t: TFunction, key: string): string {
  if (key === "source") return t("contacts.customFields.sourceFromFile", "Source (from file)");
  return customFieldLabel(key);
}
