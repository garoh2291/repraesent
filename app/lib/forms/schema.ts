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
  /**
   * Product forms only: the order summary's place among the fields. Exactly
   * one per form. It collects no value of its own — quantities travel as
   * `quantities` — and everything it shows comes from `definition.commerce`.
   */
  "product",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Types that collect no value — skipped by the validator and by lead mapping. */
export const PRESENTATIONAL_TYPES = ["heading", "paragraph"] as const;

/**
 * Types that never produce a submitted value: the presentational ones plus
 * the product slot. Every reader of a field's value filters on this, so a
 * product field can never reach lead metadata or a webhook's `data`.
 */
export const VALUELESS_TYPES = ["heading", "paragraph", "product"] as const;

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
   *
   * Booking-target resolution (applied identically by the validator, the
   * availability endpoint and createBookingEvent): non-empty `hosts` wins;
   * else `targetKey`; else, when both legacy `accountId` and `calendarId` are
   * non-empty, the target is the Google calendar they name; else there is NO
   * target — the field is unpublishable and availability 404s.
   */
  appointment?: {
    /**
     * The calendar the booked event is created in, as a cross-source key:
     * `google:<accountId>:<calendarId>`, `baikal:<configId>` or
     * `caldav:<accountId>:<encodeURIComponent(calendarUrl)>`. Absent on
     * definitions saved before non-Google targets existed — those resolve
     * through the legacy pair below, which always meant Google.
     */
    targetKey?: string;
    /** Legacy (pre-targetKey): workspace_calendar_accounts row id. */
    accountId?: string;
    /** Legacy (pre-targetKey): Google calendar id the booked event lands in. */
    calendarId?: string;
    /**
     * Co-hosts. When present and non-empty these are THE calendars to book, in
     * order; `hosts[0]` is the primary and organises the meeting. A slot is
     * only offered when every host is free, and a booking that cannot reach
     * every host is rolled back entirely.
     *
     * The builder keeps `targetKey` mirroring `hosts[0].targetKey` (see
     * `patchHosts` in FieldInspector), so a reader that predates co-booking
     * still books the primary rather than nothing. Never write `hosts` without
     * updating `targetKey` in the same patch.
     */
    hosts?: AppointmentHost[];
    /** Only `"all"` exists: every host must be free, every host gets an event. */
    hostPolicy?: "all";
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

/**
 * One host of an appointment field: a CALENDAR, plus optionally a PERSON.
 *
 * A row with no person is still booked and still blocks time — it is a meeting
 * room, a shared inbox, a calendar that exists to hold the slot — but the
 * visitor is never told about it. Only rows with a name are shown.
 *
 * `label` / `avatarUrl` / `email` are denormalised from the workspace member at
 * pick time rather than resolved from `userId` at render time, because the
 * published definition is public and is read by the form renderer, which has no
 * access to workspace data. Denormalising also means a member leaving does not
 * blank a live form.
 */
export interface AppointmentHost {
  /** Cross-source calendar key, built by `calendarKeyFor`. */
  targetKey: string;
  /** Workspace member hosting this calendar. Absent = booked but never shown. */
  userId?: string;
  /** Their name, falling back to their e-mail. Absent = not shown. */
  label?: string;
  avatarUrl?: string;
  /** Invited as an attendee on the primary's event where the provider allows it. */
  email?: string;
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
 *   appointment.loading | appointment.empty | appointment.unavailable
 *                                               (slot picker runtime states)
 *   nav.back | nav.next | nav.stepOf            (multi-step navigation)
 *   commerce.*                                  (product forms: order summary)
 *   checkout.*                                  (product forms: after payment)
 *
 * Placeholders inside runtime strings use double braces — `{{n}}`, `{{total}}`,
 * `{{amount}}`, `{{per}}` — the same shape as the hidden-field capture tokens.
 * They are filled by `fillTemplate` with a plain split/join, never a regex.
 *
 * Keys under nav / commerce / checkout / error.checkout_unavailable have
 * shipped defaults in FORM_RUNTIME_CONTENT, so a form saved before they existed
 * never renders a blank "Next" button.
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
  /**
   * Colour of the text the visitor types into a field. Optional: definitions
   * saved before it existed fall back to `text`, which is what inputs used to
   * inherit. It is a token of its own because a light `text` — right for labels
   * on a dark page — is invisible inside a light field, and the two are not
   * always meant to be the same colour.
   */
  fieldText?: string;
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

/**
 * What the form DOES on submit. Stored on the row (workspace_forms.kind), not
 * in the definition, and immutable after creation.
 *
 *   standard — creates a lead and finishes.
 *   product  — creates the lead, then opens a Stripe Checkout Session on the
 *              workspace's connected account for the bundle in `commerce`.
 *   intake   — has no fields and renders nothing. It is a URL you point an
 *              external form at; whatever JSON arrives becomes a lead. The form
 *              id in the path is the capability, exactly as it already is for
 *              the public submit endpoint.
 *
 * Single-step vs multi-step is NOT a kind — it is `layout.mode`.
 */
export const FORM_KINDS = ["standard", "product", "intake"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

/**
 * How an intake form maps the JSON it receives onto lead columns.
 *
 * Absent means "auto": the recognised keys (first_name, last_name, full_name,
 * name, email, phone) map themselves and everything else is kept in metadata.
 * A value here overrides that for one column — `{ email: "your_email" }` reads
 * the address out of a key called `your_email`.
 *
 * Dotted paths are supported, because most form builders nest: Typeform sends
 * `{ form_response: { answers: [...] } }` and Webflow sends `{ data: {...} }`.
 */
export interface FormIntakeConfig {
  mapping?: Partial<Record<FormFieldMapping & string, string>>;
  /** The last body this URL received, so the builder can show real keys. */
  lastPayload?: { at: string; body: unknown } | null;
}

/**
 * How the sections are presented. `single` renders every section on one page
 * (the only behaviour before this existed, so an absent layout means single).
 * `multi_step` renders one section per step with Back / Next navigation, and
 * only counts as active when the form has more than one section.
 */
export interface FormLayout {
  mode: "single" | "multi_step";
  /** multi_step only. `bar` = thin accent bar; `steps` = numbered dots with titles. */
  progress: "bar" | "steps" | "none";
  /** multi_step + `steps` progress: print each section's title next to its dot. */
  showStepTitles: boolean;
  /**
   * Where the submit button sits.
   *
   * `auto` is the honest default: a subscribe box — one page, one input — reads
   * as one control, so the button belongs beside the input, and everything else
   * keeps the button on its own row underneath. `on` and `off` are the escape
   * hatches for when the automatic answer is wrong.
   *
   * Absent in every definition written before this existed, which normalizes to
   * `auto` and changes nothing: those forms have more than one field.
   */
  inlineSubmit: "auto" | "on" | "off";
}

export const DEFAULT_FORM_LAYOUT: FormLayout = {
  mode: "single",
  progress: "bar",
  showStepTitles: true,
  inlineSubmit: "auto",
};

export type FormCommerceInterval = "day" | "week" | "month" | "year";

/**
 * One line of a product form's bundle. `priceId` is the source of truth — the
 * server re-reads the live price at checkout time and never charges the
 * snapshot. The snapshot exists so every renderer (React, embed runtime, the
 * frozen html snippet) can paint the order summary without a Stripe call.
 */
export interface FormCommerceItem {
  priceId: string;
  productId: string;
  /**
   * Buyer-adjustable quantity, one-time prices only. A recurring price is
   * always one subscription: normalizeCommerce forces adjustable=false and
   * min=max=default=1 for it regardless of what was stored.
   */
  quantity: { adjustable: boolean; min: number; max: number; default: number };
  /**
   * Ticked when the form loads. Every line has a checkbox and the buyer
   * chooses what to pay for — Checkout is built from the ticked lines only,
   * and at least one must be ticked to continue.
   */
  preselected: boolean;
  snapshot: {
    name: string;
    image: string | null;
    /** Minor units (cents). Stripe's unit_amount. */
    unitAmount: number;
    /** Lowercase ISO 4217. */
    currency: string;
    type: "one_time" | "recurring";
    interval: FormCommerceInterval | null;
    intervalCount: number | null;
  };
}

export interface FormCommerce {
  /** The menu of lines the buyer picks from. */
  items: FormCommerceItem[];
  /** Stripe Checkout's own billing-address collection. */
  billingAddress: "auto" | "required";
  /** Stripe Checkout's own shipping-address collection. Empty list = every country Stripe ships to. */
  shipping: { enabled: boolean; allowedCountries: string[] };
  phone: boolean;
  promotionCodes: boolean;
  /** Wording of Stripe's pay button. Payment mode only — subscriptions always read "Subscribe". */
  submitType: "pay" | "book" | "donate";
  /** Custom landing pages. Absent = the hosted thank-you page / back to the form. http(s), ≤ 2048 chars. */
  successUrl?: string;
  cancelUrl?: string;
  /**
   * Retired: the order summary now sits where the `product` field is placed.
   * Kept so stored definitions parse; nothing reads it.
   */
  position: "top" | "bottom";
}

export const DEFAULT_FORM_COMMERCE: FormCommerce = {
  items: [],
  billingAddress: "auto",
  shipping: { enabled: false, allowedCountries: [] },
  phone: false,
  promotionCodes: false,
  submitType: "pay",
  position: "top",
};

/** Shipping-country presets. "Worldwide" is the empty list. */
export const COMMERCE_COUNTRY_PRESETS: Record<
  "eu" | "dach",
  readonly string[]
> = {
  eu: [
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
  ],
  dach: ["DE", "AT", "CH"],
};

/** Bounds for a buyer-adjustable quantity. */
export const COMMERCE_QUANTITY_MAX = 999;

export interface FormDefinition {
  version: 1;
  sections: FormSection[];
  content: Partial<Record<FormLocale, FormContent>>;
  theme: FormTheme;
  success: FormSuccessBehavior;
  antiSpam: FormAntiSpam;
  utm: FormUtmCapture;
  showLanguageSwitcher: boolean;
  /** Absent on definitions saved before multi-step existed — read as single. */
  layout?: FormLayout;
  /** Product forms only. Seeded from DEFAULT_FORM_COMMERCE when the kind is product. */
  commerce?: FormCommerce;
  /** Intake forms only. Ignored — and stripped — on every other kind. */
  intake?: FormIntakeConfig;
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
  /**
   * Product forms: the lead was saved but no Checkout Session could be opened
   * (Stripe disconnected, a price archived, rate limit). Returned under the
   * pseudo-key `_form`, since it belongs to no field.
   */
  "checkout_unavailable",
  /** Product forms: nothing was ticked in the order summary. Returned under the product field's key. */
  "product_required",
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
  /** multi_step: a step with nothing but hidden fields is a blank page with a Next button. */
  "emptyStep",
  /** Product form with an empty bundle. */
  "commerceNoItems",
  /** Bundle lines priced in more than one currency — one Checkout Session, one currency. */
  "commerceMixedCurrency",
  /** Recurring lines with different billing intervals — Stripe needs one interval per subscription. */
  "commerceMixedInterval",
  /** A bundled price is archived or gone in Stripe (server-side check, needs the connection). */
  "commerceInactivePrice",
  /** The workspace disconnected Stripe after the form was built (server-side check). */
  "commerceStripeDisconnected",
  /** commerce.successUrl set but not http(s) / too long. */
  "invalidSuccessUrl",
  /** commerce.cancelUrl set but not http(s) / too long. */
  "invalidCancelUrl",
  /** Product form with no product field: nothing would show what is sold. */
  "needsProductField",
  /** A second product field — one form, one order summary. */
  "duplicateProductField",
  /** A product field on a standard form, which can never open a checkout. */
  "productFieldOnStandardForm",
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
 *
 * The product field's bundle and checkout options live in its inspector on
 * the Build tab, so every commerce issue is a `build` issue too.
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
  /** Set for step issues (emptyStep) — the section that is the step. */
  sectionId?: string;
  /** Set for commerceInactivePrice — which bundle line. */
  priceId?: string;
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
  kind: FormKind;
  /**
   * Product forms: true when the workspace's Stripe connection is live and the
   * bundle is non-empty, i.e. a submit can actually open a Checkout Session.
   * Always true for standard forms. Lets the hosted page render an honest
   * "unavailable" state instead of failing at the last click.
   */
  checkout_available: boolean;
  /**
   * OpenAI Ads measurement pixel id, present only when the workspace finished
   * conversions setup. The hosted page injects the pixel off this.
   */
  openai_pixel_id?: string | null;
}

export interface SubmitFormResult {
  success: boolean;
  /**
   * Echoes definition.success so the static snippet need not embed it.
   * `checkout` is the product-form outcome: leave the page for `checkout_url`.
   */
  mode?: FormSuccessBehavior["mode"] | "checkout";
  redirect_url?: string | null;
  /** Stripe-hosted Checkout page. Present only with mode "checkout". */
  checkout_url?: string | null;
  /** Keyed by field.key, or `_form` for a form-level code. Absent on success. */
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
  navBack: () => "nav.back",
  navNext: () => "nav.next",
  /** "Step {{n}} of {{total}}" */
  navStepOf: () => "nav.stepOf",
  commerce: (key: string) => `commerce.${key}`,
  checkout: (key: string) => `checkout.${key}`,
};

/**
 * Shipped defaults for the runtime strings a visitor cannot do without, in
 * every supported locale. Three consumers, one table:
 *
 *   - seeded into `definition.content` when a form is created as multi-step /
 *     product or switched to multi-step — fills blanks only, never overwrites,
 *     so the operator can edit or translate them like any other string;
 *   - the last-resort fallback of every renderer (getFormContent / the embed
 *     runtime's t()), so a form published before these keys existed still
 *     shows "Next" rather than an empty button;
 *   - the starter content of product forms on the server.
 *
 * Deliberately terse. No exclamation marks — this is a visitor's checkout, not
 * a celebration.
 */
export const FORM_RUNTIME_CONTENT: Record<
  FormLocale,
  Record<string, string>
> = {
  en: {
    "nav.back": "Back",
    "nav.next": "Next",
    "nav.stepOf": "Step {{n}} of {{total}}",
    "step.title.contact": "Contact",
    "step.title.details": "Details",
    "step.title.new": "Step {{n}}",
    "commerce.title": "Order summary",
    "commerce.quantity": "Quantity",
    "commerce.subtotal": "Subtotal",
    "commerce.total": "Total today",
    "commerce.then": "then {{amount}} {{per}}",
    "commerce.per.day": "per day",
    "commerce.per.week": "per week",
    "commerce.per.month": "per month",
    "commerce.per.year": "per year",
    "commerce.every": "every {{n}} {{unit}}",
    "commerce.unit.day": "days",
    "commerce.unit.week": "weeks",
    "commerce.unit.month": "months",
    "commerce.unit.year": "years",
    "commerce.oneTime": "one-time",
    "commerce.secure": "Secure checkout by Stripe",
    "commerce.decrease": "Decrease quantity",
    "commerce.increase": "Increase quantity",
    "commerce.continue": "Continue to payment",
    "commerce.select": "Select",
    "error.product_required": "Choose at least one product.",
    "checkout.paid.title": "Payment received",
    "checkout.paid.body": "Thank you. A receipt is on its way to your inbox.",
    "checkout.processing.title": "Confirming your payment",
    "checkout.processing.body":
      "This usually takes a few seconds. You can keep this page open.",
    "checkout.failed.title": "Payment did not go through",
    "checkout.failed.body":
      "Nothing was charged. You can try again with another payment method.",
    "checkout.failed.retry": "Try again",
    "checkout.canceled": "Checkout canceled. Your answers are still here.",
    "checkout.canceled.dismiss": "Dismiss",
    "error.checkout_unavailable":
      "Checkout is unavailable right now. Please try again in a moment.",
  },
  de: {
    "nav.back": "Zurück",
    "nav.next": "Weiter",
    "nav.stepOf": "Schritt {{n}} von {{total}}",
    "step.title.contact": "Kontakt",
    "step.title.details": "Details",
    "step.title.new": "Schritt {{n}}",
    "commerce.title": "Bestellübersicht",
    "commerce.quantity": "Menge",
    "commerce.subtotal": "Zwischensumme",
    "commerce.total": "Heute fällig",
    "commerce.then": "danach {{amount}} {{per}}",
    "commerce.per.day": "pro Tag",
    "commerce.per.week": "pro Woche",
    "commerce.per.month": "pro Monat",
    "commerce.per.year": "pro Jahr",
    "commerce.every": "alle {{n}} {{unit}}",
    "commerce.unit.day": "Tage",
    "commerce.unit.week": "Wochen",
    "commerce.unit.month": "Monate",
    "commerce.unit.year": "Jahre",
    "commerce.oneTime": "einmalig",
    "commerce.secure": "Sichere Zahlung über Stripe",
    "commerce.decrease": "Menge verringern",
    "commerce.increase": "Menge erhöhen",
    "commerce.continue": "Weiter zur Zahlung",
    "commerce.select": "Auswählen",
    "error.product_required": "Wählen Sie mindestens ein Produkt.",
    "checkout.paid.title": "Zahlung erhalten",
    "checkout.paid.body":
      "Vielen Dank. Die Quittung ist auf dem Weg in Ihr Postfach.",
    "checkout.processing.title": "Zahlung wird bestätigt",
    "checkout.processing.body":
      "Das dauert meist nur wenige Sekunden. Sie können die Seite geöffnet lassen.",
    "checkout.failed.title": "Zahlung fehlgeschlagen",
    "checkout.failed.body":
      "Es wurde nichts abgebucht. Versuchen Sie es mit einer anderen Zahlungsmethode.",
    "checkout.failed.retry": "Erneut versuchen",
    "checkout.canceled": "Zahlung abgebrochen. Ihre Angaben sind noch da.",
    "checkout.canceled.dismiss": "Ausblenden",
    "error.checkout_unavailable":
      "Die Zahlung ist derzeit nicht verfügbar. Bitte versuchen Sie es gleich noch einmal.",
  },
  fr: {
    "nav.back": "Retour",
    "nav.next": "Suivant",
    "nav.stepOf": "Étape {{n}} sur {{total}}",
    "step.title.contact": "Contact",
    "step.title.details": "Détails",
    "step.title.new": "Étape {{n}}",
    "commerce.title": "Récapitulatif",
    "commerce.quantity": "Quantité",
    "commerce.subtotal": "Sous-total",
    "commerce.total": "Total aujourd'hui",
    "commerce.then": "puis {{amount}} {{per}}",
    "commerce.per.day": "par jour",
    "commerce.per.week": "par semaine",
    "commerce.per.month": "par mois",
    "commerce.per.year": "par an",
    "commerce.every": "tous les {{n}} {{unit}}",
    "commerce.unit.day": "jours",
    "commerce.unit.week": "semaines",
    "commerce.unit.month": "mois",
    "commerce.unit.year": "ans",
    "commerce.oneTime": "paiement unique",
    "commerce.secure": "Paiement sécurisé par Stripe",
    "commerce.decrease": "Diminuer la quantité",
    "commerce.increase": "Augmenter la quantité",
    "commerce.continue": "Continuer vers le paiement",
    "commerce.select": "Sélectionner",
    "error.product_required": "Choisissez au moins un produit.",
    "checkout.paid.title": "Paiement reçu",
    "checkout.paid.body": "Merci. Votre reçu arrive dans votre boîte mail.",
    "checkout.processing.title": "Confirmation du paiement",
    "checkout.processing.body":
      "Cela ne prend généralement que quelques secondes. Vous pouvez laisser cette page ouverte.",
    "checkout.failed.title": "Le paiement n'a pas abouti",
    "checkout.failed.body":
      "Aucun montant n'a été débité. Réessayez avec un autre moyen de paiement.",
    "checkout.failed.retry": "Réessayer",
    "checkout.canceled": "Paiement annulé. Vos réponses sont conservées.",
    "checkout.canceled.dismiss": "Fermer",
    "error.checkout_unavailable":
      "Le paiement est indisponible pour le moment. Réessayez dans un instant.",
  },
  nl: {
    "nav.back": "Terug",
    "nav.next": "Volgende",
    "nav.stepOf": "Stap {{n}} van {{total}}",
    "step.title.contact": "Contact",
    "step.title.details": "Details",
    "step.title.new": "Stap {{n}}",
    "commerce.title": "Overzicht bestelling",
    "commerce.quantity": "Aantal",
    "commerce.subtotal": "Subtotaal",
    "commerce.total": "Totaal vandaag",
    "commerce.then": "daarna {{amount}} {{per}}",
    "commerce.per.day": "per dag",
    "commerce.per.week": "per week",
    "commerce.per.month": "per maand",
    "commerce.per.year": "per jaar",
    "commerce.every": "elke {{n}} {{unit}}",
    "commerce.unit.day": "dagen",
    "commerce.unit.week": "weken",
    "commerce.unit.month": "maanden",
    "commerce.unit.year": "jaar",
    "commerce.oneTime": "eenmalig",
    "commerce.secure": "Veilig betalen via Stripe",
    "commerce.decrease": "Aantal verlagen",
    "commerce.increase": "Aantal verhogen",
    "commerce.continue": "Doorgaan naar betaling",
    "commerce.select": "Selecteren",
    "error.product_required": "Kies minstens één product.",
    "checkout.paid.title": "Betaling ontvangen",
    "checkout.paid.body":
      "Bedankt. De betalingsbevestiging is onderweg naar uw inbox.",
    "checkout.processing.title": "Betaling wordt bevestigd",
    "checkout.processing.body":
      "Dit duurt meestal een paar seconden. U kunt deze pagina open laten.",
    "checkout.failed.title": "Betaling niet gelukt",
    "checkout.failed.body":
      "Er is niets afgeschreven. Probeer het opnieuw met een andere betaalmethode.",
    "checkout.failed.retry": "Opnieuw proberen",
    "checkout.canceled": "Afrekenen geannuleerd. Uw antwoorden staan er nog.",
    "checkout.canceled.dismiss": "Sluiten",
    "error.checkout_unavailable":
      "Betalen is op dit moment niet beschikbaar. Probeer het zo opnieuw.",
  },
};

/** The runtime keys that belong to multi-step navigation. */
export const STEP_CONTENT_KEYS = [
  "nav.back",
  "nav.next",
  "nav.stepOf",
] as const;

/** The runtime keys a product form needs (everything under commerce/checkout + the unavailable error). */
export const COMMERCE_CONTENT_KEYS: readonly string[] = Object.keys(
  FORM_RUNTIME_CONTENT.en,
).filter((key) => !key.startsWith("nav.") && !key.startsWith("step."));

/**
 * Default step titles, seeded into `section.<id>.title` when a form is
 * created multi-step or a step is added — a step needs a name of its own, or
 * every step shows the same form title and nothing else.
 */
export function defaultStepTitle(
  locale: FormLocale,
  which: "contact" | "details" | number,
): string {
  const table = FORM_RUNTIME_CONTENT[locale] ?? FORM_RUNTIME_CONTENT.en;
  if (typeof which === "number") {
    return fillTemplate(table["step.title.new"] ?? "Step {{n}}", { n: which });
  }
  return table[`step.title.${which}`] ?? "";
}

/**
 * Resolve a content string for a locale: the locale itself, then the form's
 * default locale, then the shipped runtime default (nav/commerce/checkout only).
 * Never falls back to the key name — any other unset string renders as empty.
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
  if (fallback != null && fallback !== "") return fallback;
  return (
    FORM_RUNTIME_CONTENT[locale]?.[key] ??
    FORM_RUNTIME_CONTENT[fallbackLocale]?.[key] ??
    ""
  );
}

/**
 * Fill `{{name}}` placeholders. Split/join rather than a regex so the same
 * code can live verbatim in the embed runtime (which may not contain `&`, and
 * whose regex escaping rules differ from a template literal's).
 */
export function fillTemplate(
  text: string,
  vars: Record<string, string | number>,
): string {
  let out = text;
  for (const key of Object.keys(vars)) {
    out = out.split(`{{${key}}}`).join(String(vars[key]));
  }
  return out;
}

/**
 * Currencies Stripe quotes in whole units. Mirror of ZERO_DECIMAL_CURRENCIES in
 * repraesent/app/lib/utils/format.ts and of the runtime's own list — the render
 * spec pins all three together.
 */
export const ZERO_DECIMAL_CURRENCIES: readonly string[] = [
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
];

/** Format a Stripe minor-unit amount for a locale. Never throws. */
export function formatMinor(
  amountMinor: number,
  currency: string,
  locale: string,
): string {
  const code = (currency || "eur").toLowerCase();
  const zero = ZERO_DECIMAL_CURRENCIES.includes(code);
  const value = zero ? amountMinor : amountMinor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code.toUpperCase(),
      minimumFractionDigits: zero ? 0 : 2,
      maximumFractionDigits: zero ? 0 : 2,
    }).format(value);
  } catch {
    return `${zero ? String(value) : value.toFixed(2)} ${code.toUpperCase()}`;
  }
}

/** Multi-step only counts when there is more than one step to move between. */
export function isMultiStep(
  definition: Pick<FormDefinition, "layout" | "sections">,
): boolean {
  return (
    definition.layout?.mode === "multi_step" &&
    (definition.sections?.length ?? 0) > 1
  );
}

/**
 * Does the submit button sit beside the input rather than under it?
 *
 * `on` and `off` are the author's word and are taken literally. `auto` asks the
 * form what it is: one page holding exactly one thing to fill in is a subscribe
 * box, and a subscribe box is an input with a button next to it. Two fields is
 * a form, and a form's button goes underneath.
 *
 * Counts value-collecting fields only — a heading above the input does not turn
 * a subscribe box into a form.
 */
export function isInlineSubmit(
  definition: Pick<FormDefinition, "layout" | "sections">,
): boolean {
  const setting = definition.layout?.inlineSubmit ?? "auto";
  if (setting === "off") return false;
  if (setting === "on") return true;
  if (isMultiStep(definition)) return false;
  const fields = (definition.sections ?? []).flatMap((s) => s.fields ?? []);
  const collecting = fields.filter(
    (f) => !(VALUELESS_TYPES as readonly string[]).includes(f.type),
  );
  return collecting.length === 1;
}

/** Fill in a stored layout, tolerating anything older definitions lack. */
export function normalizeLayout(raw: unknown): FormLayout {
  const value = (raw ?? {}) as Partial<FormLayout>;
  return {
    mode: value.mode === "multi_step" ? "multi_step" : "single",
    progress:
      value.progress === "steps" || value.progress === "none"
        ? value.progress
        : "bar",
    showStepTitles: value.showStepTitles !== false,
    inlineSubmit:
      value.inlineSubmit === "on" || value.inlineSubmit === "off"
        ? value.inlineSubmit
        : "auto",
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? Math.floor(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Fill in a stored commerce block. Returns undefined for standard forms so a
 * stray `commerce` key can never turn a lead form into a checkout — the kind
 * on the row decides, and it is immutable.
 */
export function normalizeCommerce(
  raw: unknown,
  kind: FormKind,
): FormCommerce | undefined {
  if (kind !== "product") return undefined;
  const value = (raw ?? {}) as Partial<FormCommerce>;
  const items = (Array.isArray(value.items) ? value.items : [])
    .filter(
      (item): item is FormCommerceItem =>
        !!item &&
        typeof item.priceId === "string" &&
        item.priceId !== "" &&
        !!item.snapshot,
    )
    .map((item): FormCommerceItem => {
      const recurring = item.snapshot.type === "recurring";
      const q = item.quantity ?? {
        adjustable: false,
        min: 1,
        max: 1,
        default: 1,
      };
      const min = recurring ? 1 : clampInt(q.min, 1, COMMERCE_QUANTITY_MAX, 1);
      const max = recurring
        ? 1
        : clampInt(q.max, min, COMMERCE_QUANTITY_MAX, Math.max(min, 1));
      const def = recurring ? 1 : clampInt(q.default, min, max, min);
      return {
        priceId: item.priceId,
        productId: item.productId ?? "",
        preselected: item.preselected === true,
        quantity: {
          adjustable: recurring ? false : q.adjustable === true,
          min,
          max,
          default: def,
        },
        snapshot: {
          name: item.snapshot.name ?? "",
          image: item.snapshot.image ?? null,
          unitAmount:
            typeof item.snapshot.unitAmount === "number"
              ? item.snapshot.unitAmount
              : 0,
          currency: (item.snapshot.currency ?? "eur").toLowerCase(),
          type: recurring ? "recurring" : "one_time",
          interval: recurring ? (item.snapshot.interval ?? "month") : null,
          intervalCount: recurring ? (item.snapshot.intervalCount ?? 1) : null,
        },
      };
    });

  return {
    items,
    billingAddress: value.billingAddress === "required" ? "required" : "auto",
    shipping: {
      enabled: value.shipping?.enabled === true,
      allowedCountries: Array.isArray(value.shipping?.allowedCountries)
        ? value.shipping.allowedCountries.filter(
            (c): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c),
          )
        : [],
    },
    phone: value.phone === true,
    promotionCodes: value.promotionCodes === true,
    submitType:
      value.submitType === "book" || value.submitType === "donate"
        ? value.submitType
        : "pay",
    successUrl: value.successUrl || undefined,
    cancelUrl: value.cancelUrl || undefined,
    position: value.position === "bottom" ? "bottom" : "top",
  };
}

/** Flatten every field across every section, in render order. */
export function flattenFields(definition: FormDefinition): FormField[] {
  return (definition.sections ?? []).flatMap((s) => s.fields ?? []);
}

export function isPresentational(type: FormFieldType): boolean {
  return (PRESENTATIONAL_TYPES as readonly string[]).includes(type);
}

export function isValueless(type: FormFieldType): boolean {
  return (VALUELESS_TYPES as readonly string[]).includes(type);
}

/** The product form's one product field, if placed. */
export function productField(
  definition: Pick<FormDefinition, "sections">,
): FormField | null {
  for (const section of definition.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.type === "product") return field;
    }
  }
  return null;
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
