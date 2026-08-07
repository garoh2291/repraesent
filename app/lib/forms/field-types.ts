/**
 * Builder-side metadata for the 17 field types: how each one is presented in the
 * palette, and what a freshly-added field of that type looks like.
 *
 * The `labelKey` values are APP strings (i18next, forms.palette.types.*) because
 * they name the tool, not the form. The strings a visitor sees are form content
 * and live in definition.content — see app/lib/forms/content.ts.
 */

import {
  AlignLeft,
  AtSign,
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
  { group: "dateNumber", types: ["number", "date", "rating", "scale"] },
  { group: "layout", types: ["heading", "paragraph"] },
  { group: "advanced", types: ["hidden"] },
];

/** Short, collision-resistant, and readable in the JSON blob. */
export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function snakeKey(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s_]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "field"
  );
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
    width: type === "long_text" || type === "address" ? "full" : "half",
    mapping: null,
    validation: {},
  };

  switch (type) {
    case "email":
      field.mapping = takenKeys.has("email") ? null : "email";
      field.validation = { required: true };
      field.width = "full";
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
      field.width = "full";
      break;
    case "checkbox":
      field.width = "full";
      break;
    case "rating":
      field.ratingMax = 5;
      break;
    case "scale":
      field.scale = { min: 1, max: 10 };
      field.width = "full";
      break;
    case "address":
      field.addressParts = {
        street: true,
        city: true,
        zip: true,
        country: false,
      };
      break;
    case "heading":
    case "paragraph":
      field.width = "full";
      break;
    case "hidden":
      field.hiddenValue = "{{utm_source}}";
      field.width = "full";
      break;
    default:
      break;
  }

  return field;
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
