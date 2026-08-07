/**
 * Client mirror of nestjs-monolith/src/modules/forms/form-schema.validator.ts.
 *
 * Purely for immediate feedback — the server re-validates every submission and
 * its verdict is the one that counts. Both sides return the same FormErrorCode
 * values, so the message the visitor reads always comes from the form's own
 * per-locale error copy regardless of which side rejected it.
 */

import {
  contentKey,
  type FormDefinition,
  type FormDefinitionIssue,
  type FormErrorCode,
  type FormField,
  type FormLocale,
  flattenFields,
  hasOptions,
  isPresentational,
} from "./schema";

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s\d]{5,24}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type FormErrors = Record<string, FormErrorCode>;

export function validateValues(
  definition: FormDefinition,
  values: Record<string, unknown>,
): FormErrors {
  const errors: FormErrors = {};
  const fields = flattenFields(definition).filter(
    (f) => !isPresentational(f.type),
  );

  for (const field of fields) {
    const code = checkField(field, values[field.key]);
    if (code) errors[field.key] = code;
  }

  return errors;
}

function checkField(field: FormField, raw: unknown): FormErrorCode | null {
  const required = field.validation?.required === true;

  if (field.type === "checkbox") {
    return required && raw !== true ? "consent_required" : null;
  }

  if (field.type === "checkbox_group") {
    const list = Array.isArray(raw) ? raw : [];
    const { minSelected, maxSelected } = field.validation ?? {};
    if (required && list.length === 0) return "required";
    if (typeof minSelected === "number" && list.length < minSelected)
      return "min_selected";
    if (typeof maxSelected === "number" && list.length > maxSelected)
      return "max_selected";
    return null;
  }

  if (field.type === "address") {
    if (!required) return null;
    const parts = (raw ?? {}) as Record<string, unknown>;
    const enabled = field.addressParts ?? {
      street: true,
      city: true,
      zip: true,
      country: false,
    };
    for (const part of ["street", "city", "zip", "country"] as const) {
      if (!enabled[part]) continue;
      if (String(parts[part] ?? "").trim() === "") return "required";
    }
    return null;
  }

  if (field.type === "hidden") return null;

  const text = raw == null ? "" : String(raw).trim();
  if (text === "") return required ? "required" : null;

  switch (field.type) {
    case "email":
      if (!EMAIL_RE.test(text)) return "invalid_email";
      break;
    case "phone":
      if (!PHONE_RE.test(text)) return "invalid_phone";
      break;
    case "url":
      if (!/^https?:\/\/[^\s]+$/i.test(text)) return "invalid_url";
      break;
    case "date": {
      if (!ISO_DATE_RE.test(text) || Number.isNaN(Date.parse(text)))
        return "invalid_date";
      const { minDate, maxDate } = field.validation ?? {};
      if ((minDate && text < minDate) || (maxDate && text > maxDate))
        return "out_of_range";
      break;
    }
    case "number": {
      const num = Number(text);
      if (!Number.isFinite(num)) return "invalid_number";
      const { min, max } = field.validation ?? {};
      if (typeof min === "number" && num < min) return "out_of_range";
      if (typeof max === "number" && num > max) return "out_of_range";
      break;
    }
    case "dropdown":
    case "radio_group": {
      const allowed = (field.options ?? []).map((o) => o.value);
      if (!allowed.includes(text)) return "not_an_option";
      break;
    }
    case "rating": {
      const num = Number.parseInt(text, 10);
      if (!Number.isInteger(num) || num < 1 || num > (field.ratingMax ?? 5))
        return "out_of_range";
      break;
    }
    case "scale": {
      const num = Number.parseInt(text, 10);
      const min = field.scale?.min ?? 1;
      const max = field.scale?.max ?? 10;
      if (!Number.isInteger(num) || num < min || num > max)
        return "out_of_range";
      break;
    }
    default:
      break;
  }

  const { minLength, maxLength } = field.validation ?? {};
  if (typeof minLength === "number" && text.length < minLength)
    return "too_short";
  if (typeof maxLength === "number" && text.length > maxLength)
    return "too_long";

  return null;
}

/** Blank starting values, so every control is controlled from first render. */
export function emptyValues(
  definition: FormDefinition,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of flattenFields(definition)) {
    if (isPresentational(field.type)) continue;
    switch (field.type) {
      case "checkbox":
        values[field.key] = field.defaultValue === true;
        break;
      case "checkbox_group":
        values[field.key] = Array.isArray(field.defaultValue)
          ? [...field.defaultValue]
          : [];
        break;
      case "address":
        values[field.key] = { street: "", city: "", zip: "", country: "" };
        break;
      default:
        values[field.key] = field.defaultValue ?? "";
        break;
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// validateDefinition — is this form well-formed enough to publish?
//
// MIRROR of validateDefinition in
// nestjs-monolith/src/modules/forms/form-schema.validator.ts. The builder runs
// this on the LOCAL draft so the tab badges and the banner update as you type,
// instead of showing whatever the last save returned. The server runs it again
// on publish and on saving a live form, and its verdict is the one that counts.
//
// Tab attribution (keep both copies in step):
//   build  — needsEmailField, needsNameField, duplicateKey, duplicateMapping,
//            emptyOptions, missingContent (form.submit AND field labels)
//   design — invalidRedirect
//
// EVERY enabled locale is checked, not just the default — see the body.
// ---------------------------------------------------------------------------

export function validateDefinition(
  definition: FormDefinition | null | undefined,
  defaultLocale: FormLocale,
  /**
   * Every locale the form is offered in. Optional and defaulting to just the
   * default, so a stray caller degrades to the old behaviour rather than
   * throwing; every real call site passes the stored `locales`.
   */
  locales?: FormLocale[],
): FormDefinitionIssue[] {
  // One issue PER offending field, in definition order — so the banner can name
  // the field and the tab badges have a stable count. Deduping into a Set (as
  // this used to) makes "a choice field has no options" unactionable.
  const issues: FormDefinitionIssue[] = [];

  if (!definition || !Array.isArray(definition.sections)) {
    return [
      { code: "needsEmailField", tab: "build" },
      { code: "needsNameField", tab: "build" },
    ];
  }

  const fields = flattenFields(definition).filter(
    (f) => !isPresentational(f.type),
  );

  // Requirement: every form must be able to produce an identifiable lead.
  const mappings = fields.map((f) => f.mapping).filter(Boolean);
  if (!mappings.includes("email")) {
    issues.push({ code: "needsEmailField", tab: "build" });
  }
  if (
    !mappings.includes("full_name") &&
    !(mappings.includes("first_name") && mappings.includes("last_name"))
  ) {
    issues.push({ code: "needsNameField", tab: "build" });
  }

  const seenKeys = new Set<string>();
  const seenMappings = new Set<string>();
  for (const field of fields) {
    // Flag the SECOND occurrence — the first one is the incumbent, and it is
    // the duplicate the user needs to go rename.
    if (seenKeys.has(field.key)) {
      issues.push({
        code: "duplicateKey",
        tab: "build",
        fieldId: field.id,
        fieldKey: field.key,
      });
    }
    seenKeys.add(field.key);

    if (field.mapping) {
      if (seenMappings.has(field.mapping)) {
        issues.push({
          code: "duplicateMapping",
          tab: "build",
          fieldId: field.id,
          fieldKey: field.key,
        });
      }
      seenMappings.add(field.mapping);
    }

    if (hasOptions(field.type)) {
      const options = field.options ?? [];
      const values = new Set(options.map((o) => o.value));
      if (options.length === 0 || values.size !== options.length) {
        issues.push({
          code: "emptyOptions",
          tab: "build",
          fieldId: field.id,
          fieldKey: field.key,
        });
      }
    }
  }

  const success = definition.success;
  if (success?.mode === "redirect" && !isHttpUrl(success.redirectUrl)) {
    issues.push({ code: "invalidRedirect", tab: "design" });
  }

  // ── per-locale content ────────────────────────────────────────────────────
  // EVERY enabled locale must be able to render the form on its own. Falling
  // back to the default was acceptable while a locale was just a translation
  // table, but adding a language is now one click that auto-translates — so an
  // added-but-unfilled language is a half-shipped form, and it blocks exactly
  // like a missing e-mail field does.
  //
  // The required set is deliberately narrow: only what a visitor cannot use the
  // form without.
  //     form.submit               the button would have no caption
  //     field.<id>.label | .text  every visible field, per locale
  // Title, description, placeholders, help text, success and error copy are NOT
  // required — each falls back to the default locale at render time and the
  // form still works. Requiring all ~40 strings would make adding a language a
  // wall of errors.
  const checked: FormLocale[] = [
    defaultLocale,
    ...(locales ?? []).filter((l) => l !== defaultLocale),
  ];

  // Hoisted: the old code re-walked the tree inside the content block, which
  // with N locales would be N traversals for the same answer.
  const renderedFields = flattenFields(definition).filter(
    // A hidden field is never rendered, so it needs no label.
    (f) => f.type !== "hidden",
  );

  for (const locale of checked) {
    const content = definition.content?.[locale] ?? {};
    const missing = (key: string) => {
      const value = content[key];
      return value == null || value.trim() === "";
    };

    if (missing(contentKey.formSubmit())) {
      issues.push({
        code: "missingContent",
        tab: "build",
        contentKey: contentKey.formSubmit(),
        locale,
      });
    }

    for (const field of renderedFields) {
      const key = isPresentational(field.type)
        ? contentKey.fieldText(field.id)
        : contentKey.fieldLabel(field.id);
      if (missing(key)) {
        issues.push({
          code: "missingContent",
          tab: "build",
          fieldId: field.id,
          fieldKey: field.key,
          contentKey: key,
          locale,
        });
      }
    }
  }

  return issues;
}

function isHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
