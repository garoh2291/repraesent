import type { Filter } from "~/components/molecule/filter-component/types";
import { CONTACT_TYPES } from "~/lib/contacts/contact-types";

/** Values of `public.contact_source` — keep in sync with API / DB enum */
export const CONTACT_SOURCE_FILTER_KEYS = [
  "manual",
  "lead_conversion",
  "csv_import",
  "vcard_import",
  "xlsx_import",
  "referral",
  "other",
] as const;

export const CONTACT_SOURCE_FILTER_OPTIONS = CONTACT_SOURCE_FILTER_KEYS.map(
  (key) => ({
    key,
    label: `contacts.sources.${key}`,
  }),
);

export const CONTACT_TYPE_FILTER_OPTIONS = CONTACT_TYPES.map((key) => ({
  key,
  label: `contacts.contactTypes.${key}`,
}));

/** Base filters for the contacts list (assignee options are appended in the route). */
export const CONTACT_TABLE_FILTERS_BASE: Filter[] = [
  {
    name: "contact_source",
    paramKey: "source",
    options: CONTACT_SOURCE_FILTER_OPTIONS,
    single: true,
  },
  {
    name: "contact_type",
    paramKey: "contact_type",
    options: CONTACT_TYPE_FILTER_OPTIONS,
    single: true,
  },
];
