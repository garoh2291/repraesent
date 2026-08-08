/**
 * Reading and editing form CONTENT — the user-authored strings a form is made
 * of (labels, placeholders, option labels, success and error copy).
 *
 * This is workspace data, not app strings. It NEVER goes through i18next: the
 * same renderer runs in the dashboard (where i18next speaks the operator's
 * language) and on the public page (where it speaks the visitor's). Routing form
 * content through t() would show a German operator a German label while
 * previewing a French form.
 */

import {
  type FormDefinition,
  type FormField,
  type FormLocale,
  contentKey,
  flattenFields,
  hasOptions,
  isPresentational,
} from "./schema";

/**
 * Resolve a content string, falling back to the form's default locale.
 * Never falls back to the key name — an unset string renders as empty.
 */
export function getContent(
  definition: Pick<FormDefinition, "content">,
  locale: FormLocale,
  key: string,
  fallbackLocale: FormLocale,
): string {
  const direct = definition.content?.[locale]?.[key];
  if (direct != null && direct !== "") return direct;
  return definition.content?.[fallbackLocale]?.[key] ?? "";
}

/** Read a string for editing — no fallback, so an empty field looks empty. */
export function getRawContent(
  definition: Pick<FormDefinition, "content">,
  locale: FormLocale,
  key: string,
): string {
  return definition.content?.[locale]?.[key] ?? "";
}

/** Immutably set one content string for one locale. */
export function setContent(
  definition: FormDefinition,
  locale: FormLocale,
  key: string,
  value: string,
): FormDefinition {
  return {
    ...definition,
    content: {
      ...definition.content,
      [locale]: { ...(definition.content?.[locale] ?? {}), [key]: value },
    },
  };
}

export interface ContentKeyDescriptor {
  key: string;
  /** What the Languages tab shows in its left-hand column. */
  label: string;
  group: string;
  multiline?: boolean;
}

/**
 * Every translatable key a form currently has, in render order. Drives the
 * Languages tab's translation table and its completeness meter.
 */
export function collectContentKeys(
  definition: FormDefinition,
): ContentKeyDescriptor[] {
  const keys: ContentKeyDescriptor[] = [
    { key: contentKey.formTitle(), label: "Title", group: "Form" },
    {
      key: contentKey.formDescription(),
      label: "Description",
      group: "Form",
      multiline: true,
    },
    { key: contentKey.formSubmit(), label: "Submit button", group: "Form" },
  ];

  for (const section of definition.sections ?? []) {
    if (section.fields?.length) {
      keys.push({
        key: contentKey.sectionTitle(section.id),
        label: "Section title",
        group: "Sections",
      });
      keys.push({
        key: contentKey.sectionDescription(section.id),
        label: "Section description",
        group: "Sections",
        multiline: true,
      });
    }
  }

  for (const field of flattenFields(definition)) {
    keys.push(...fieldContentKeys(field));
  }

  keys.push(
    {
      key: contentKey.successInline(),
      label: "Success message",
      group: "Success",
      multiline: true,
    },
    {
      key: contentKey.successModalTitle(),
      label: "Modal title",
      group: "Success",
    },
    {
      key: contentKey.successModalBody(),
      label: "Modal body",
      group: "Success",
      multiline: true,
    },
    {
      key: contentKey.successModalCta(),
      label: "Modal button",
      group: "Success",
    },
    { key: contentKey.errorGeneric(), label: "Generic error", group: "Errors" },
    { key: contentKey.error("required"), label: "Required", group: "Errors" },
    {
      key: contentKey.error("invalid_email"),
      label: "Invalid e-mail",
      group: "Errors",
    },
    {
      key: contentKey.error("invalid_phone"),
      label: "Invalid phone",
      group: "Errors",
    },
    {
      key: contentKey.error("invalid_url"),
      label: "Invalid URL",
      group: "Errors",
    },
    {
      key: contentKey.error("invalid_number"),
      label: "Invalid number",
      group: "Errors",
    },
    {
      key: contentKey.error("invalid_date"),
      label: "Invalid date",
      group: "Errors",
    },
    { key: contentKey.error("too_short"), label: "Too short", group: "Errors" },
    { key: contentKey.error("too_long"), label: "Too long", group: "Errors" },
    {
      key: contentKey.error("out_of_range"),
      label: "Out of range",
      group: "Errors",
    },
    {
      key: contentKey.error("not_an_option"),
      label: "Not an option",
      group: "Errors",
    },
    {
      key: contentKey.error("min_selected"),
      label: "Too few selected",
      group: "Errors",
    },
    {
      key: contentKey.error("max_selected"),
      label: "Too many selected",
      group: "Errors",
    },
    {
      key: contentKey.error("consent_required"),
      label: "Consent required",
      group: "Errors",
    },
  );

  return keys;
}

function fieldContentKeys(field: FormField): ContentKeyDescriptor[] {
  const group = "Fields";

  if (isPresentational(field.type)) {
    return [
      {
        key: contentKey.fieldText(field.id),
        label: field.key,
        group,
        multiline: field.type === "paragraph",
      },
    ];
  }

  if (field.type === "hidden") return [];

  const keys: ContentKeyDescriptor[] = [
    { key: contentKey.fieldLabel(field.id), label: field.key, group },
    {
      key: contentKey.fieldPlaceholder(field.id),
      label: `${field.key} · placeholder`,
      group,
    },
    {
      key: contentKey.fieldHelp(field.id),
      label: `${field.key} · help`,
      group,
    },
  ];

  if (hasOptions(field.type)) {
    for (const option of field.options ?? []) {
      keys.push({
        key: contentKey.fieldOption(field.id, option.id),
        label: `${field.key} · ${option.value}`,
        group,
      });
    }
  }

  if (field.type === "address") {
    const parts = field.addressParts ?? {
      street: true,
      city: true,
      zip: true,
      country: false,
    };
    for (const part of ["street", "city", "zip", "country"] as const) {
      if (!parts[part]) continue;
      keys.push({
        key: contentKey.fieldAddressPart(field.id, part),
        label: `${field.key} · ${part}`,
        group,
      });
    }
  }

  return keys;
}

/**
 * Share of a locale's keys that are filled in. Only keys that exist in the
 * default locale count, so blank optional strings never drag the number down.
 */
export function localeCompleteness(
  definition: FormDefinition,
  locale: FormLocale,
  defaultLocale: FormLocale,
): { filled: number; total: number; percent: number } {
  const keys = collectContentKeys(definition);
  const source = definition.content?.[defaultLocale] ?? {};
  const target = definition.content?.[locale] ?? {};

  const relevant = keys.filter((k) => (source[k.key] ?? "").trim() !== "");
  const filled = relevant.filter((k) => (target[k.key] ?? "").trim() !== "");

  return {
    filled: filled.length,
    total: relevant.length,
    percent:
      relevant.length === 0
        ? 100
        : Math.round((filled.length / relevant.length) * 100),
  };
}

export interface TranslateItemPayload {
  value: string;
  format?: "text" | "html";
}

/**
 * Build the `items` + `keys` payload for one target locale.
 *
 * Derived from collectContentKeys, NOT from Object.entries(content[source]).
 * That matters: the raw content map still holds keys for deleted fields, and
 * iterating it would send stale strings to the model. Option *values* are never
 * in here either — they are what validateSubmission checks a submission
 * against, so translating one would start rejecting real submissions.
 */
export function buildTranslateItems(
  definition: FormDefinition,
  sourceLocale: FormLocale,
  targetLocale: FormLocale,
  options: { onlyEmpty: boolean },
): { items: Record<string, TranslateItemPayload>; keys: string[] } {
  const source = definition.content?.[sourceLocale] ?? {};
  const target = definition.content?.[targetLocale] ?? {};

  const items: Record<string, TranslateItemPayload> = {};
  const keys: string[] = [];

  for (const descriptor of collectContentKeys(definition)) {
    const value = (source[descriptor.key] ?? "").trim();
    if (value === "") continue;
    if (options.onlyEmpty && (target[descriptor.key] ?? "").trim() !== "") {
      continue;
    }
    items[descriptor.key] = { value };
    keys.push(descriptor.key);
  }

  return { items, keys };
}

/** Merge a translate response into one locale of the definition. */
export function mergeTranslations(
  definition: FormDefinition,
  locale: FormLocale,
  values: Record<string, string>,
): FormDefinition {
  if (Object.keys(values).length === 0) return definition;
  return {
    ...definition,
    content: {
      ...definition.content,
      [locale]: { ...(definition.content?.[locale] ?? {}), ...values },
    },
  };
}

/** Seed a locale from the default one, leaving anything already translated. */
export function copyFromDefault(
  definition: FormDefinition,
  locale: FormLocale,
  defaultLocale: FormLocale,
): FormDefinition {
  const source = definition.content?.[defaultLocale] ?? {};
  const target = { ...(definition.content?.[locale] ?? {}) };

  for (const [key, value] of Object.entries(source)) {
    if ((target[key] ?? "").trim() === "") target[key] = value;
  }

  return {
    ...definition,
    content: { ...definition.content, [locale]: target },
  };
}
