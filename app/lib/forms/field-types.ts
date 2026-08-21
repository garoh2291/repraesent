/**
 * Builder-side metadata for the 18 field types: how each one is presented in the
 * palette, and what a freshly-added field of that type looks like.
 *
 * The `labelKey` values are APP strings (i18next, forms.palette.types.*) because
 * they name the tool, not the form. The strings a visitor sees are form content
 * and live in definition.content — see app/lib/forms/content.ts.
 */

import {
  AlignLeft,
  AtSign,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  EyeOff,
  Gauge,
  Hash,
  Heading,
  Link2,
  ListChecks,
  MapPin,
  Phone,
  Star,
  Text,
  Type,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_MIN_SUBMIT_SECONDS,
  DEFAULT_FORM_SUCCESS,
  DEFAULT_FORM_THEME,
  DEFAULT_UTM_CAPTURE,
  type FormDefinition,
  type FormField,
  type FormFieldType,
  type FormLocale,
} from "./schema";

export type FieldGroup =
  | "text"
  | "choice"
  | "dateNumber"
  | "layout"
  | "advanced";

export interface FieldTypeMeta {
  type: FormFieldType;
  icon: LucideIcon;
  group: FieldGroup;
  /** Default snake_case key stem; deduplicated on insert. */
  keyStem: string;
  /** Types that can be pointed at a lead column. */
  mappable: boolean;
}

export const FIELD_TYPE_META: Record<FormFieldType, FieldTypeMeta> = {
  short_text: {
    type: "short_text",
    icon: Type,
    group: "text",
    keyStem: "text",
    mappable: true,
  },
  long_text: {
    type: "long_text",
    icon: AlignLeft,
    group: "text",
    keyStem: "message",
    mappable: false,
  },
  email: {
    type: "email",
    icon: AtSign,
    group: "text",
    keyStem: "email",
    mappable: true,
  },
  phone: {
    type: "phone",
    icon: Phone,
    group: "text",
    keyStem: "phone",
    mappable: true,
  },
  url: {
    type: "url",
    icon: Link2,
    group: "text",
    keyStem: "website",
    mappable: false,
  },
  /**
   * Legacy as a *field*. Clicking this in the palette no longer creates an
   * `address` field — it drops the four ordinary fields in ADDRESS_GROUP, so
   * each part gets its own label, required flag, placeholder and width. The
   * type itself stays fully alive across the schema, both validators, all
   * three renderers and the browser runtime, because forms built before the
   * split still use it.
   */
  address: {
    type: "address",
    icon: MapPin,
    group: "text",
    keyStem: "address",
    mappable: false,
  },

  dropdown: {
    type: "dropdown",
    icon: ChevronDownSquare,
    group: "choice",
    keyStem: "choice",
    mappable: false,
  },
  radio_group: {
    type: "radio_group",
    icon: CircleDot,
    group: "choice",
    keyStem: "option",
    mappable: false,
  },
  checkbox_group: {
    type: "checkbox_group",
    icon: ListChecks,
    group: "choice",
    keyStem: "options",
    mappable: false,
  },
  checkbox: {
    type: "checkbox",
    icon: CheckSquare,
    group: "choice",
    keyStem: "consent",
    mappable: false,
  },

  number: {
    type: "number",
    icon: Hash,
    group: "dateNumber",
    keyStem: "number",
    mappable: false,
  },
  date: {
    type: "date",
    icon: CalendarDays,
    group: "dateNumber",
    keyStem: "date",
    mappable: false,
  },
  rating: {
    type: "rating",
    icon: Star,
    group: "dateNumber",
    keyStem: "rating",
    mappable: false,
  },
  scale: {
    type: "scale",
    icon: Gauge,
    group: "dateNumber",
    keyStem: "scale",
    mappable: false,
  },
  appointment: {
    type: "appointment",
    icon: CalendarClock,
    group: "dateNumber",
    keyStem: "appointment",
    mappable: false,
  },

  heading: {
    type: "heading",
    icon: Heading,
    group: "layout",
    keyStem: "heading",
    mappable: false,
  },
  paragraph: {
    type: "paragraph",
    icon: Text,
    group: "layout",
    keyStem: "paragraph",
    mappable: false,
  },

  hidden: {
    type: "hidden",
    icon: EyeOff,
    group: "advanced",
    keyStem: "hidden",
    mappable: false,
  },
};

export const FIELD_GROUPS: { group: FieldGroup; types: FormFieldType[] }[] = [
  {
    group: "text",
    types: ["short_text", "long_text", "email", "phone", "url", "address"],
  },
  {
    group: "choice",
    types: ["dropdown", "radio_group", "checkbox_group", "checkbox"],
  },
  {
    group: "dateNumber",
    types: ["number", "date", "rating", "scale", "appointment"],
  },
  { group: "layout", types: ["heading", "paragraph"] },
  { group: "advanced", types: ["hidden"] },
];

/** Short, collision-resistant, and readable in the JSON blob. */
export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * snake_case, or "" when there is nothing left.
 *
 * Used by the key INPUT, where an empty result has to stay empty: substituting
 * a placeholder meant deleting the last character of `full_name` silently
 * produced `field`, and there was no way to clear the box at all. A blank key
 * is caught by validateDefinition's `keyMissing` instead.
 */
export function snakeKeyRaw(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

/**
 * snake_case with a fallback, for GENERATED keys — a new field or a duplicate
 * always needs some key, and "field" is better than "". Never use this on user
 * input; see snakeKeyRaw.
 */
export function snakeKey(value: string): string {
  return snakeKeyRaw(value) || "field";
}

export function uniqueKey(stem: string, taken: Set<string>): string {
  const base = snakeKey(stem);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

/** A newly added field of the given type, with type-appropriate defaults. */
export function createField(
  type: FormFieldType,
  takenKeys: Set<string>,
): FormField {
  const meta = FIELD_TYPE_META[type];
  const field: FormField = {
    id: newId("f"),
    type,
    key: uniqueKey(meta.keyStem, takenKeys),
    // Full width by default. Half-width is the exception a designer opts into
    // for a pair of short fields, not the shape most fields want — and a new
    // field landing at half width next to an unrelated one read as a bug.
    width: "full",
    mapping: null,
    validation: {},
  };

  switch (type) {
    case "email":
      field.mapping = takenKeys.has("email") ? null : "email";
      field.validation = { required: true };
      break;
    case "phone":
      field.mapping = "phone";
      break;
    case "dropdown":
    case "radio_group":
    case "checkbox_group":
      field.options = [
        { id: newId("o"), value: "option_1" },
        { id: newId("o"), value: "option_2" },
      ];
      break;
    case "rating":
      field.ratingMax = 5;
      break;
    case "scale":
      field.scale = { min: 1, max: 10 };
      break;
    case "appointment":
      // Booking a slot that then isn't held is worse than being asked to pick
      // one — required by default, unlike every other type.
      field.validation = { required: true };
      field.appointment = {
        accountId: "",
        calendarId: "",
        busyCalendarKeys: "all",
        durationMinutes: 30,
        window: { start: "09:00", end: "17:00" },
        weekdays: ["mon", "tue", "wed", "thu", "fri"],
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin",
        minNoticeHours: 2,
        maxDaysAhead: 30,
      };
      break;
    case "address":
      field.addressParts = {
        street: true,
        city: true,
        zip: true,
        country: false,
      };
      break;
    case "hidden":
      field.hiddenValue = "{{utm_source}}";
      break;
    default:
      break;
  }

  return field;
}

/**
 * The fields the palette's Address button drops.
 *
 * Four ordinary short-text fields rather than one `address` field. Everything
 * an operator wanted per part — its own label, its own Required, its own
 * placeholder, help and width, its own key and Save-to — is what a normal
 * field already gives them, and the inspector already knows how to edit one.
 * They can also delete Country, add a second line, or reorder them, none of
 * which the single field allowed.
 *
 * Widths make the block read as an address: street and country span, zip and
 * city pair up on one row.
 *
 * The label keys are the inspector's own part names — the same four words in
 * the same four languages, already translated. A second copy under a new
 * namespace would be four strings times four locales kept in sync by hand.
 */
export const ADDRESS_GROUP = [
  { keyStem: "street", width: "full", labelKey: "forms.inspector.street" },
  { keyStem: "zip", width: "half", labelKey: "forms.inspector.zip" },
  { keyStem: "city", width: "half", labelKey: "forms.inspector.city" },
  { keyStem: "country", width: "full", labelKey: "forms.inspector.country" },
] as const satisfies ReadonlyArray<{
  keyStem: string;
  width: FormField["width"];
  labelKey: string;
}>;

/**
 * The fields for a group palette entry, keys already deduped against the form
 * and against each other.
 */
export function createFieldGroup(
  blueprint: typeof ADDRESS_GROUP,
  takenKeys: Set<string>,
): FormField[] {
  // Copied, then grown as we go: uniqueKey has to see the siblings created a
  // moment ago or four fields land on the same key.
  const taken = new Set(takenKeys);

  return blueprint.map((spec) => {
    const field = createField("short_text", taken);
    field.key = uniqueKey(spec.keyStem, taken);
    field.width = spec.width;
    taken.add(field.key);
    return field;
  });
}

/** The mappings that satisfy the "form must produce a named lead" rule. */
const NAME_MAPPINGS = ["full_name", "first_name", "last_name"];

/**
 * True when deleting this field would leave the form unpublishable.
 *
 * `validateDefinition` requires every form to yield an identifiable lead: one
 * field mapped to `email`, and either a `full_name` or a `first_name` +
 * `last_name` pair. Deleting the last one that satisfies either rule used to be
 * allowed, and the form only failed later, at publish, with an error pointing at
 * a field the user had already removed.
 *
 * The builder hides the delete control instead. Reorder, rename and retype stay
 * available — it is only removal that is refused, and only while the field is
 * the one holding the rule up. Add a second email field and the first becomes
 * deletable again, because by then it is no longer load-bearing.
 *
 * Deliberately not in validate.ts: that file is a byte-for-byte mirror of the
 * backend validator, and this is a builder affordance, not a validation rule.
 */
export function isFieldDeletable(
  field: FormField,
  allFields: FormField[],
): boolean {
  if (!field.mapping) return true;

  const survivors = allFields
    .filter((f) => f.id !== field.id)
    .map((f) => f.mapping)
    .filter(Boolean) as string[];

  if (field.mapping === "email") return survivors.includes("email");

  if (NAME_MAPPINGS.includes(field.mapping)) {
    return (
      survivors.includes("full_name") ||
      (survivors.includes("first_name") && survivors.includes("last_name"))
    );
  }

  return true;
}

/** Used when a definition comes back empty or from an older shape. */
export function emptyDefinition(locale: FormLocale): FormDefinition {
  return {
    version: 1,
    sections: [{ id: newId("s"), fields: [] }],
    content: { [locale]: {} },
    theme: { ...DEFAULT_FORM_THEME },
    success: { ...DEFAULT_FORM_SUCCESS },
    antiSpam: {
      honeypotKey: `company_website_${Math.random().toString(36).slice(2, 6)}`,
      minSubmitSeconds: DEFAULT_MIN_SUBMIT_SECONDS,
    },
    utm: { ...DEFAULT_UTM_CAPTURE, keys: [...DEFAULT_UTM_CAPTURE.keys] },
    showLanguageSwitcher: false,
  };
}

/**
 * Fill in anything a stored definition is missing, so the builder never has to
 * null-check theme/success/antiSpam on every render.
 */
export function normalizeDefinition(
  raw: Partial<FormDefinition> | null | undefined,
  locale: FormLocale,
): FormDefinition {
  const base = emptyDefinition(locale);
  if (!raw) return base;

  return {
    version: 1,
    sections:
      Array.isArray(raw.sections) && raw.sections.length > 0
        ? raw.sections
        : base.sections,
    content: raw.content ?? base.content,
    theme: { ...base.theme, ...(raw.theme ?? {}) },
    success: { ...base.success, ...(raw.success ?? {}) },
    antiSpam: { ...base.antiSpam, ...(raw.antiSpam ?? {}) },
    utm: { ...base.utm, ...(raw.utm ?? {}) },
    showLanguageSwitcher: raw.showLanguageSwitcher ?? false,
  };
}
