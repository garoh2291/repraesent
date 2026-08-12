/**
 * The form-definition contract — MIRROR of
 * nestjs-monolith/src/modules/forms/form-schema.types.ts.
 *
 * There is no shared package in this monorepo; the same manual-mirror
 * arrangement already exists between appointments.service.ts and
 * app/lib/api/appointments.ts. If you change one side, change the other.
 */

export const FORM_LOCALES = ["en", "de", "fr", "nl"] as const;
export type FormLocale = (typeof FORM_LOCALES)[number];

export const FORM_FIELD_TYPES = [
  "short_text",
  "email",
  "phone",
  "long_text",
  "number",
  "dropdown",
  "radio_group",
  "checkbox_group",
  "checkbox",
  "date",
  "appointment",
  "url",
  "rating",
  "scale",
  "address",
  "hidden",
  "heading",
  "paragraph",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Types that collect no value — skipped by the validator and by lead mapping. */
export const PRESENTATIONAL_TYPES = ["heading", "paragraph"] as const;

/** Types that carry an `options` array. */
export const OPTION_TYPES = [
  "dropdown",
  "radio_group",
  "checkbox_group",
] as const;

/** The only lead columns a field may map onto. Anything else goes to metadata. */
export const FORM_FIELD_MAPPINGS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
] as const;
export type FormFieldMapping = (typeof FORM_FIELD_MAPPINGS)[number] | null;

export interface FormFieldOption {
  /** Stable id; the locale label lives at content["field.<fieldId>.option.<id>"]. */
  id: string;
  /** Submitted and stored value. Locale-independent. */
  value: string;
}

export interface FormFieldValidation {
  required?: boolean;
  /** short_text | long_text */
  minLength?: number;
  maxLength?: number;
  /** number */
  min?: number;
  max?: number;
  step?: number;
  /** RegExp source, short_text only. Compiled defensively — an invalid one is ignored. */
  pattern?: string;
  /** checkbox_group */
  minSelected?: number;
  maxSelected?: number;
  /** date, ISO yyyy-mm-dd */
  minDate?: string;
  maxDate?: string;
}

export interface FormFieldAddressParts {
  street: boolean;
  city: boolean;
  zip: boolean;
  country: boolean;
}

export interface FormField {
  /** nanoid; stable across renames — content keys and option keys hang off it. */
  id: string;
  type: FormFieldType;
  /** snake_case. The input `name` attribute and the leads.metadata key. Unique per form. */
  key: string;
  width: "full" | "half";
  mapping: FormFieldMapping;
  validation: FormFieldValidation;

  /** dropdown | radio_group | checkbox_group */
  options?: FormFieldOption[];
  defaultValue?: string | number | boolean | string[] | null;

  /**
   * type "hidden": a literal, or one of the capture tokens
   * {{utm_source}} {{utm_medium}} {{utm_campaign}} {{utm_term}} {{utm_content}}
   * {{gclid}} {{fbclid}} {{page_url}} {{referrer}}
   */
  hiddenValue?: string;

  /**
   * type "address": which sub-inputs render. Each enabled part becomes its own
   * metadata key `<key>_street`, `<key>_city`, `<key>_zip`, `<key>_country`.
   */
  addressParts?: FormFieldAddressParts;

  /** type "rating", default 5 */
  ratingMax?: number;
  /** type "scale", default { min: 1, max: 10 } */
  scale?: { min: number; max: number };

  /**
   * Type "appointment": slot picker config. The calendar ids stay server-side —
   * the public availability endpoint and the render config only ever expose the
   * client-safe subset (weekdays, window, duration, timezone), never which
   * account or calendar backs them. The submitted value is the slot string
   * `"<startISO>--<endISO>"`, the same wire format the booking page uses.
   */
  appointment?: {
    /** workspace_calendar_accounts row id the booked event is created under. */
    accountId: string;
    /** Google calendar id the booked event lands in. */
    calendarId: string;
    /** Busy sources, `"google:<accountId>:<calendarId>"` / `"baikal:<configId>"`, or "all". */
    busyCalendarKeys: string[] | "all";
    durationMinutes: number;
    /** Local wall-clock bookable window, "HH:mm". */
    window: { start: string; end: string };
    /** Bookable weekdays, lowercase 3-letter keys ("mon".."sun"). */
    weekdays: string[];
    /** IANA timezone the window and weekdays are read in. */
    timezone: string;
    /** Hours of lead time before the first offered slot. Default 2. */
    minNoticeHours?: number;
    /** Booking horizon in days. Default 30. */
    maxDaysAhead?: number;
  };
}

export interface FormSection {
  id: string;
  /** Ordered. Two-column flow is driven by each field's `width`, not by rows. */
  fields: FormField[];
}

/**
 * Every user-authored translatable string for one locale. Flat, dotted keys.
 *
 * NEVER goes through i18next — this is workspace data, not app strings.
 *
 *   form.title | form.description | form.submit
 *   section.<sectionId>.title | section.<sectionId>.description
 *   field.<fieldId>.label | .placeholder | .help
 *   field.<fieldId>.text                        (heading / paragraph body)
 *   field.<fieldId>.option.<optionId>
 *   field.<fieldId>.part.street|city|zip|country
 *   success.inline | success.modal.title | success.modal.body | success.modal.cta
 *   error.generic | error.<FormErrorCode>
 *   appointment.loading | appointment.empty     (slot picker runtime states)
 */
export type FormContent = Record<string, string>;

export const FORM_FONT_KEYS = [
  "system",
  "inter",
  "dm_sans",
  "geist",
  "serif",
  "mono",
] as const;
export type FormFontKey = (typeof FORM_FONT_KEYS)[number];

export const FORM_FONTS: Record<
  FormFontKey,
  { stack: string; googleFamily: string | null }
> = {
  system: {
    stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
    googleFamily: null,
  },
  inter: {
    stack: `"Inter", -apple-system, BlinkMacSystemFont, sans-serif`,
    googleFamily: "Inter:wght@400;500;600;700",
  },
  dm_sans: {
    stack: `"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif`,
    googleFamily: "DM+Sans:wght@400;500;600;700",
  },
  geist: {
    stack: `"Geist", -apple-system, BlinkMacSystemFont, sans-serif`,
    googleFamily: "Geist:wght@400;500;600;700",
  },
  serif: {
    stack: `"Source Serif 4", Georgia, "Times New Roman", serif`,
    googleFamily: "Source+Serif+4:wght@400;600",
  },
  mono: {
    stack: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
    googleFamily: "JetBrains+Mono:wght@400;500",
  },
};

/**
 * Sentinel for `theme.background`. It is a real CSS colour keyword, so it needs
 * no special-casing in buildFormCss — `--rf-bg: transparent` simply paints
 * nothing and the host page shows through. Only `background` accepts it:
 * `surface` also backs the success modal card and the checkbox/radio boxes,
 * where "no paint" means unreadable rather than see-through. To drop the input
 * fills too, pair this with `fieldStyle: "underline"`.
 */
export const TRANSPARENT = "transparent";

export function isTransparent(color: string): boolean {
  return color.trim().toLowerCase() === TRANSPARENT;
}

export interface FormTheme {
  /**
   * Retired. Was a light/dark PRESET that rewrote five colours in one click,
   * never a runtime switch — the emitted CSS only ever contains concrete
   * values. Kept optional so stored definitions still parse; nothing reads it.
   */
  mode?: "light" | "dark";
  /** #rrggbb */
  accent: string;
  /** #rrggbb, or TRANSPARENT to let the host page show through. */
  background: string;
  /** #rrggbb */
  surface: string;
  /**
   * Fill behind an input when fieldStyle is "filled". Optional: definitions
   * saved before it existed fall back to a tint derived from `text`, which is
   * exactly what the filled style used to hardcode.
   */
  fieldBackground?: string;
  text: string;
  mutedText: string;
  border: string;
  /** px */
  radius: 0 | 4 | 8 | 12 | 16;
  /**
   * px of breathing room inside the form's own background. Optional for the
   * same reason as fieldBackground — older definitions rendered flush at 0,
   * and get the new default rather than a broken layout.
   */
  padding?: number;
  fontFamily: FormFontKey;
  fieldStyle: "outlined" | "filled" | "underline";
  buttonStyle: "solid" | "outline" | "soft";
  buttonFullWidth: boolean;
  labelPosition: "top" | "inline" | "floating";
  /** px max-width */
  width: 480 | 560 | 640 | 720 | 880;
  density: "compact" | "cozy" | "comfortable";
  showFormTitle: boolean;
}

export interface FormSuccessBehavior {
  mode: "inline" | "modal" | "redirect";
  /** Required when mode === "redirect". http(s) only, validated on save. */
  redirectUrl?: string;
  /** inline mode: clear the fields after a successful submit. */
  resetAfterSubmit: boolean;
}

export interface FormAntiSpam {
  /** Randomised at form creation, e.g. "company_website_2f9a". */
  honeypotKey: string;
  /** Submissions faster than this are silently dropped. */
  minSubmitSeconds: number;
}

export const UTM_CAPTURE_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "page_url",
  "referrer",
] as const;

export interface FormUtmCapture {
  enabled: boolean;
  /** Whitelist, a subset of UTM_CAPTURE_KEYS. */
  keys: string[];
}

export interface FormDefinition {
  version: 1;
  sections: FormSection[];
  content: Partial<Record<FormLocale, FormContent>>;
  theme: FormTheme;
  success: FormSuccessBehavior;
  antiSpam: FormAntiSpam;
  utm: FormUtmCapture;
  showLanguageSwitcher: boolean;
}

export interface FormConfirmationEmailLocale {
  subject: string;
  html: string;
}

export interface FormConfirmationEmail {
  enabled: boolean;
  /** workspace_email_accounts row id; null = the workspace default account. */
  email_account_id: string | null;
  by_locale: Partial<Record<FormLocale, FormConfirmationEmailLocale>>;
}

/**
 * Stable machine codes. The server NEVER returns user-authored text — the client
 * renders content[locale]["error." + code], so per-locale error customisation
 * works identically in all four delivery modes.
 */
export const FORM_ERROR_CODES = [
  "required",
  "invalid_email",
  "invalid_url",
  "invalid_number",
  "invalid_date",
  "invalid_phone",
  "too_short",
  "too_long",
  "out_of_range",
  "not_an_option",
  "min_selected",
  "max_selected",
  "consent_required",
  /** Appointment slot passed validation but was booked away in the meantime. */
  "slot_unavailable",
  /** Appointment value is not a well-formed future slot of the configured length. */
  "slot_invalid",
] as const;
export type FormErrorCode = (typeof FORM_ERROR_CODES)[number];

/** Machine codes from validateDefinition(). */
export const FORM_DEFINITION_ISSUES = [
  "needsEmailField",
  "needsNameField",
  "duplicateKey",
  "duplicateMapping",
  "emptyOptions",
  "invalidRedirect",
  "missingContent",
  /** A field whose key was cleared. Submissions are stored under the key. */
  "keyMissing",
  /** Confirmation e-mail is switched on but has no subject in some locale. */
  "emailSubjectMissing",
  /** Confirmation e-mail is switched on but has no body in some locale. */
  "emailBodyMissing",
  /** An appointment field with no calendar picked. It could render, but never book. */
  "appointmentMissingCalendar",
] as const;
export type FormDefinitionIssueCode = (typeof FORM_DEFINITION_ISSUES)[number];

/**
 * Which builder tab owns the fix. Drives the red count badge on the tab strip,
 * so a problem is findable instead of being an abstract line in a banner.
 *
 *   build  — fields AND the form header/submit: mappings, keys, options, copy
 *   design — the success/redirect behaviour (ThemePanel)
 *
 * There is no "languages" tab any more. Form-level copy moved into the Build
 * canvas (the header and the submit button are selectable regions with their
 * own inspector), so `form.submit` is fixable from `build` like everything else.
 */
export const FORM_ISSUE_TABS = ["build", "design", "email"] as const;
export type FormIssueTab = (typeof FORM_ISSUE_TABS)[number];

export interface FormDefinitionIssue {
  code: FormDefinitionIssueCode;
  tab: FormIssueTab;
  /** Set when the issue is anchored to one field. */
  fieldId?: string;
  /** That field's snake_case key — what the banner names. */
  fieldKey?: string;
  /** Set for content issues, e.g. "form.submit" or "field.<id>.label". */
  contentKey?: string;
  /**
   * Which enabled locale this issue belongs to.
   *
   * ABSENT means the issue is structural and language-agnostic — a missing
   * mapping, a bad redirect URL. You cannot fix those "in French", so they show
   * from every language tab and never put a dot on one.
   *
   * PRESENT means "this string is blank in this language": the language strip
   * uses it for the per-tab dot, and the banner filters on it so you only see
   * what you can act on without switching tabs first.
   */
  locale?: FormLocale;
}

/** What the unauthenticated GET /api/public/forms/:id returns. */
export interface PublicFormPayload {
  id: string;
  /** false when the form is draft or has never been published. */
  available: boolean;
  name: string;
  /** published_definition; null when unavailable. */
  definition: FormDefinition | null;
  default_locale: FormLocale;
  locales: FormLocale[];
  /** HMAC time-trap token. Echo back as `rt` on submit. */
  render_token: string;
}

export interface SubmitFormResult {
  success: boolean;
  /** Echoes definition.success so the static snippet need not embed it. */
  mode?: FormSuccessBehavior["mode"];
  redirect_url?: string | null;
  /** Keyed by field.key. Absent on success. */
  errors?: Record<string, FormErrorCode>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_FORM_THEME: FormTheme = {
  accent: "#131515",
  background: "#f5f5f4",
  surface: "#ffffff",
  text: "#131515",
  mutedText: "#78716c",
  border: "#e7e5e4",
  radius: 8,
  /** 1rem. A form flush against its own background reads as unfinished. */
  padding: 16,
  fontFamily: "system",
  fieldStyle: "outlined",
  buttonStyle: "solid",
  buttonFullWidth: false,
  labelPosition: "top",
  width: 640,
  density: "cozy",
  showFormTitle: true,
};

export const DEFAULT_FORM_SUCCESS: FormSuccessBehavior = {
  mode: "inline",
  resetAfterSubmit: true,
};

export const DEFAULT_UTM_CAPTURE: FormUtmCapture = {
  enabled: true,
  keys: [...UTM_CAPTURE_KEYS],
};

/** Minimum submit delay, in seconds, before a submission is treated as a bot. */
export const DEFAULT_MIN_SUBMIT_SECONDS = 2;

// ---------------------------------------------------------------------------
// Content-key helpers — the only place these strings are constructed
// ---------------------------------------------------------------------------

export const contentKey = {
  formTitle: () => "form.title",
  formDescription: () => "form.description",
  formSubmit: () => "form.submit",
  sectionTitle: (sectionId: string) => `section.${sectionId}.title`,
  sectionDescription: (sectionId: string) => `section.${sectionId}.description`,
  fieldLabel: (fieldId: string) => `field.${fieldId}.label`,
  fieldPlaceholder: (fieldId: string) => `field.${fieldId}.placeholder`,
  fieldHelp: (fieldId: string) => `field.${fieldId}.help`,
  fieldText: (fieldId: string) => `field.${fieldId}.text`,
  fieldOption: (fieldId: string, optionId: string) =>
    `field.${fieldId}.option.${optionId}`,
  fieldAddressPart: (fieldId: string, part: keyof FormFieldAddressParts) =>
    `field.${fieldId}.part.${part}`,
  successInline: () => "success.inline",
  successModalTitle: () => "success.modal.title",
  successModalBody: () => "success.modal.body",
  successModalCta: () => "success.modal.cta",
  errorGeneric: () => "error.generic",
  error: (code: FormErrorCode) => `error.${code}`,
};

/**
 * Resolve a content string for a locale, falling back to the form's default
 * locale. Never falls back to the key name — an unset string renders as empty.
 */
export function getFormContent(
  definition: Pick<FormDefinition, "content">,
  locale: FormLocale,
  key: string,
  fallbackLocale: FormLocale,
): string {
  const direct = definition.content?.[locale]?.[key];
  if (direct != null && direct !== "") return direct;
  const fallback = definition.content?.[fallbackLocale]?.[key];
  return fallback ?? "";
}

/** Flatten every field across every section, in render order. */
export function flattenFields(definition: FormDefinition): FormField[] {
  return (definition.sections ?? []).flatMap((s) => s.fields ?? []);
}

export function isPresentational(type: FormFieldType): boolean {
  return (PRESENTATIONAL_TYPES as readonly string[]).includes(type);
}

export function hasOptions(type: FormFieldType): boolean {
  return (OPTION_TYPES as readonly string[]).includes(type);
}

export function isFormLocale(value: unknown): value is FormLocale {
  return (
    typeof value === "string" &&
    (FORM_LOCALES as readonly string[]).includes(value)
  );
}
