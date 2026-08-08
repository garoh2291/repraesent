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
  /** Resolves a content key for the active locale. */
  t: (key: string) => string;
  onChange: (value: unknown) => void;
}

export function FormFieldControl({
  field,
  inputId,
  value,
  invalid,
  disabled,
  t,
  onChange,
}: Props) {
  const placeholder = t(contentKey.fieldPlaceholder(field.id));
  const required = field.validation?.required === true;
  const aria = {
    id: inputId,
    "aria-invalid": invalid || undefined,
    "aria-required": required || undefined,
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
            {t(contentKey.fieldLabel(field.id))}
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

    case "email":
    case "phone":
    case "url":
    default:
      return (
        <input
          {...aria}
          type={
            field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : field.type === "url"
                  ? "url"
                  : "text"
          }
          autoComplete={
            field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : undefined
          }
          className="rf-input"
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
