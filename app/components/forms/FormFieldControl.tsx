/**
 * One input, for one field type.
 *
 * Deliberately built from plain HTML elements styled by the generated form CSS
 * (app/lib/forms/css.ts) rather than from the app's shadcn components. The
 * pasted HTML snippet is plain markup with that same stylesheet, so using
 * anything else here would make the builder preview and the real form diverge —
 * and preview parity is the whole point of the design tab.
 *
 * NO i18next in this file. Everything a visitor reads is form content, resolved
 * by the caller through app/lib/forms/content.ts. See FormRenderer's header.
 */

import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppointmentControl } from "~/components/forms/AppointmentControl";
import { InlineText } from "~/components/forms/InlineText";
import {
  PHONE_COUNTRIES,
  countryForInternational,
  countryName,
  defaultPhoneCountry,
  joinPhone,
  phoneCountry,
  splitPhone,
} from "~/lib/forms/phone";
import {
  contentKey,
  type FormField,
  type FormFieldAddressParts,
} from "~/lib/forms/schema";

const ADDRESS_PARTS: (keyof FormFieldAddressParts)[] = [
  "street",
  "zip",
  "city",
  "country",
];

interface Props {
  field: FormField;
  inputId: string;
  value: unknown;
  invalid: boolean;
  disabled?: boolean;
  /** False when the field's label is blank, so the control must name itself. */
  labelled?: boolean;
  /** Resolves a content key for the active locale. */
  t: (key: string) => string;
  onChange: (value: unknown) => void;
  /**
   * Appointment fields only. The slot picker is the one control whose content
   * (free times) lives server-side, so live mode needs the form id to ask the
   * public availability endpoint — and preview mode, which has no published
   * availability to ask, renders placeholders instead. Every other type
   * renders identically in both modes and ignores all three.
   */
  mode?: "preview" | "live";
  formId?: string;
  locale?: string;
}

export function FormFieldControl({
  field,
  inputId,
  value,
  invalid,
  disabled,
  labelled = true,
  t,
  onChange,
  mode = "preview",
  formId,
  locale,
}: Props) {
  const placeholder = t(contentKey.fieldPlaceholder(field.id));
  const required = field.validation?.required === true;
  const aria = {
    id: inputId,
    "aria-invalid": invalid || undefined,
    "aria-required": required || undefined,
    // With no label there is no <label for> to name the input, so it reaches a
    // screen reader as an anonymous edit box. Borrow the placeholder, then the
    // key.
    "aria-label": labelled ? undefined : placeholder || field.key,
    disabled,
  };

  switch (field.type) {
    case "long_text":
      return (
        <textarea
          {...aria}
          className="rf-textarea"
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "dropdown":
      return (
        <select
          {...aria}
          className="rf-select"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.id} value={option.value}>
              {t(contentKey.fieldOption(field.id, option.id)) || option.value}
            </option>
          ))}
        </select>
      );

    case "radio_group":
      return (
        <div className="rf-choices" role="radiogroup" aria-labelledby={inputId}>
          {(field.options ?? []).map((option) => (
            <label className="rf-choice" key={option.id}>
              <input
                type="radio"
                name={inputId}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              <span>
                {t(contentKey.fieldOption(field.id, option.id)) || option.value}
              </span>
            </label>
          ))}
        </div>
      );

    case "checkbox_group": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="rf-choices" role="group" aria-labelledby={inputId}>
          {(field.options ?? []).map((option) => (
            <label className="rf-choice" key={option.id}>
              <input
                type="checkbox"
                value={option.value}
                checked={selected.includes(option.value)}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, option.value]
                      : selected.filter((v) => v !== option.value),
                  )
                }
              />
              <span>
                {t(contentKey.fieldOption(field.id, option.id)) || option.value}
              </span>
            </label>
          ))}
        </div>
      );
    }

    case "checkbox":
      // Carries its own inline label — FormRenderer suppresses the standalone one.
      return (
        <label className="rf-choice rf-consent" htmlFor={inputId}>
          <input
            {...aria}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            <InlineText text={t(contentKey.fieldLabel(field.id))} />
            {required ? <span className="rf-req"> *</span> : null}
          </span>
        </label>
      );

    case "rating": {
      const max = field.ratingMax ?? 5;
      const current = Number(value) || 0;
      return (
        <div className="rf-rating" role="group" aria-labelledby={inputId}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              className={`rf-star${n <= current ? " rf-on" : ""}`}
              aria-label={String(n)}
              aria-pressed={n === current}
              onClick={() => onChange(n === current ? "" : n)}
            >
              <Star fill="currentColor" strokeWidth={0} />
            </button>
          ))}
        </div>
      );
    }

    case "scale": {
      const min = field.scale?.min ?? 1;
      const max = field.scale?.max ?? 10;
      const current = String(value ?? "");
      const steps: number[] = [];
      for (let n = min; n <= max; n++) steps.push(n);
      return (
        <div className="rf-scale" role="group" aria-labelledby={inputId}>
          {steps.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              className={`rf-scale-btn${current === String(n) ? " rf-on" : ""}`}
              aria-pressed={current === String(n)}
              onClick={() => onChange(current === String(n) ? "" : n)}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }

    case "appointment":
      return (
        <AppointmentControl
          field={field}
          inputId={inputId}
          value={value}
          disabled={disabled}
          t={t}
          onChange={onChange}
          live={mode === "live"}
          formId={formId}
          locale={locale}
        />
      );

    case "address": {
      const enabled = field.addressParts ?? {
        street: true,
        city: true,
        zip: true,
        country: false,
      };
      const parts = (value ?? {}) as Record<string, string>;
      return (
        <div className="rf-address">
          {ADDRESS_PARTS.filter((part) => enabled[part]).map((part) => {
            const partLabel = t(contentKey.fieldAddressPart(field.id, part));
            return (
              <input
                key={part}
                type="text"
                className={`rf-input rf-${part}`}
                placeholder={partLabel}
                aria-label={partLabel}
                disabled={disabled}
                value={parts[part] ?? ""}
                onChange={(e) => onChange({ ...parts, [part]: e.target.value })}
              />
            );
          })}
        </div>
      );
    }

    case "number":
      return (
        <input
          {...aria}
          type="number"
          className="rf-input"
          placeholder={placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
          step={field.validation?.step}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "date":
      return (
        <input
          {...aria}
          type="date"
          className="rf-input"
          min={field.validation?.minDate}
          max={field.validation?.maxDate}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "phone":
      return (
        <PhoneControl
          aria={aria}
          placeholder={placeholder}
          label={t(contentKey.fieldLabel(field.id)) || placeholder || field.key}
          value={String(value ?? "")}
          locale={locale}
          onChange={onChange}
        />
      );

    case "email":
    case "url":
    default:
      return (
        <input
          {...aria}
          type={
            field.type === "email"
              ? "email"
              : field.type === "url"
                ? "url"
                : "text"
          }
          autoComplete={field.type === "email" ? "email" : undefined}
          className="rf-input"
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Appointment slot picker
// ---------------------------------------------------------------------------

/** getDay() index → the lowercase keys the definition stores. */
/**
 * Phone: a flag + calling code (the device's own picker opens on tap) and the
 * number. The same markup as the website runtime (form-render.service.ts),
 * so the builder preview matches the embedded form. Saves "+491511234567".
 */
function PhoneControl({
  aria,
  placeholder,
  label,
  value,
  locale,
  onChange,
}: {
  aria: {
    id: string;
    "aria-invalid"?: true;
    "aria-required"?: true;
    "aria-label"?: string;
    disabled?: boolean;
  };
  placeholder: string;
  label: string;
  value: string;
  locale?: string;
  onChange: (value: unknown) => void;
}) {
  const fallback = defaultPhoneCountry(locale);
  const [iso, setIso] = useState(() => splitPhone(value, fallback).iso);
  const [national, setNational] = useState(() => splitPhone(value, fallback).national);

  // Before a number is typed, the country follows a language switch.
  const [startedOn, setStartedOn] = useState(fallback);
  useEffect(() => {
    if (fallback === startedOn) return;
    if (!national && iso === startedOn) setIso(fallback);
    setStartedOn(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  // The form cleared itself (sent, or reset): clear the number too.
  useEffect(() => {
    if (!value && national) setNational("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = phoneCountry(iso) ?? phoneCountry(fallback) ?? PHONE_COUNTRIES[0];
  const options = useMemo(() => {
    const named = PHONE_COUNTRIES.map((c) => ({ ...c, name: countryName(c.iso, locale) }));
    named.sort((a, b) => a.name.localeCompare(b.name, locale || "en"));
    const top = named.find((c) => c.iso === fallback);
    return { top, all: named };
  }, [locale, fallback]);

  return (
    <div className="rf-phone">
      <span className="rf-phone-cc">
        <img
          className="rf-phone-flag"
          src={`/flags/${country.iso.toLowerCase()}.svg`}
          alt=""
          width={21}
          height={14}
        />
        <span className="rf-phone-dial">+{country.dial}</span>
        <svg className="rf-phone-chev" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <select
          className="rf-phone-select"
          aria-label={label}
          value={country.iso}
          disabled={aria.disabled}
          onChange={(e) => {
            const next = e.target.value;
            setIso(next);
            onChange(joinPhone(next, national));
          }}
        >
          {options.top ? (
            <option value={options.top.iso}>
              {options.top.name} +{options.top.dial}
            </option>
          ) : null}
          {options.top ? <option disabled>──────────</option> : null}
          {options.all.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} +{c.dial}
            </option>
          ))}
        </select>
      </span>
      <input
        {...aria}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="rf-input rf-phone-num"
        placeholder={placeholder}
        value={national}
        onChange={(e) => {
          const typed = e.target.value;
          setNational(typed);
          let next = iso;
          // "+33 6…" typed or pasted: follow it to that country.
          if (/^(\+|00)/.test(typed.trim())) {
            const match = countryForInternational(typed, iso);
            if (match) {
              next = match.iso;
              setIso(match.iso);
            }
          }
          onChange(joinPhone(next, typed));
        }}
      />
    </div>
  );
}
