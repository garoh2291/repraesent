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

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { InlineText } from "~/components/forms/InlineText";
import { getAppointmentAvailability } from "~/lib/api/forms";
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

// ---------------------------------------------------------------------------
// Appointment slot picker
// ---------------------------------------------------------------------------

/** getDay() index → the lowercase keys the definition stores. */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const APPT_PER_PAGE = 7;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD by hand — toISOString would shift the day near midnight. */
function dayString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * The same DOM shape the backend renderer emits (`.rf-appt` > `.rf-appt-nav`
 * (prev, `.rf-appt-days`, next) > `.rf-appt-slots` + a hidden input), styled by
 * the same `.rf-appt*` CSS block — so the builder preview, the hosted page and
 * the pasted snippet all look identical.
 *
 * Preview mode renders placeholders: a draft has no published availability to
 * fetch, so the day strip shows the next seven days with the first bookable one
 * selected, and the slot grid shows four times spaced by the configured
 * duration from the window start. Live mode pages through real days and asks
 * the public availability endpoint per picked day.
 */
function AppointmentControl({
  field,
  inputId,
  value,
  disabled,
  t,
  onChange,
  live,
  formId,
  locale,
}: {
  field: FormField;
  inputId: string;
  value: unknown;
  disabled?: boolean;
  t: (key: string) => string;
  onChange: (value: unknown) => void;
  live: boolean;
  formId?: string;
  locale?: string;
}) {
  const ap = field.appointment;
  const weekdays = ap?.weekdays ?? ["mon", "tue", "wed", "thu", "fri"];
  const duration = ap?.durationMinutes ?? 30;
  const maxDaysAhead = ap?.maxDaysAhead ?? 30;
  const windowStart = ap?.window?.start ?? "09:00";
  const timezone = ap?.timezone;

  const [page, setPage] = useState(0);
  const [pickedDay, setPickedDay] = useState("");

  const canFetch = live && !!formId && pickedDay !== "";
  const slotsQuery = useQuery({
    queryKey: ["form-appt-slots", formId, field.id, pickedDay],
    queryFn: () => getAppointmentAvailability(formId!, field.id, pickedDay),
    enabled: canFetch,
    retry: false,
    // Short: another visitor can book a slot away at any moment, and a stale
    // list only turns into slot_unavailable at submit.
    staleTime: 30_000,
  });

  const today = new Date();
  const days = Array.from({ length: APPT_PER_PAGE }, (_, i) => {
    const offset = page * APPT_PER_PAGE + i;
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
    );
    // The weekday is read in the visitor's local calendar, exactly like the
    // embed runtime; the server re-derives it in the form's timezone and simply
    // returns [] for a day that only looks open from here.
    const open =
      weekdays.includes(DAY_KEYS[d.getDay()]) && offset <= maxDaysAhead;
    return { date: d, str: dayString(d), open };
  });

  // Preview: the first bookable day reads as selected, so the control shows its
  // working state rather than an untouched skeleton.
  const selectedDay = live ? pickedDay : (days.find((d) => d.open)?.str ?? "");

  const weekdayLabel = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    } catch {
      return DAY_KEYS[d.getDay()];
    }
  };

  /**
   * The slot's OWN timezone, not the visitor's: the bookable window was
   * configured as wall-clock time there, and that is what whoever set the form
   * up expects the visitor to read back.
   */
  const timeLabel = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(iso));
    } catch {
      return iso.slice(11, 16);
    }
  };

  /** Placeholder times for the preview: window start + n × duration. */
  const previewSlotLabel = (n: number) => {
    const [h, m] = windowStart.split(":").map(Number);
    const minutes = (h || 9) * 60 + (m || 0) + n * duration;
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2000, 0, 1, 0, minutes)));
    } catch {
      return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
    }
  };

  const selected = String(value ?? "");

  let slotGrid: ReactNode;
  if (!live) {
    slotGrid = Array.from({ length: 4 }, (_, n) => (
      <button
        key={n}
        type="button"
        disabled={disabled}
        className={`rf-appt-slot${n === 0 ? " rf-on" : ""}`}
      >
        {previewSlotLabel(n)}
      </button>
    ));
  } else if (pickedDay === "") {
    slotGrid = null;
  } else if (slotsQuery.isPending) {
    slotGrid = (
      <div className="rf-appt-loading">
        {t("appointment.loading") || "Loading times..."}
      </div>
    );
  } else if (slotsQuery.isError) {
    slotGrid = (
      <div className="rf-appt-empty">
        {t(contentKey.errorGeneric()) || "Something went wrong."}
      </div>
    );
  } else if ((slotsQuery.data?.slots.length ?? 0) === 0) {
    slotGrid = (
      <div className="rf-appt-empty">
        {t("appointment.empty") || "No free times on this day."}
      </div>
    );
  } else {
    slotGrid = slotsQuery.data!.slots.map((slot) => (
      <button
        key={slot}
        type="button"
        disabled={disabled}
        className={`rf-appt-slot${slot === selected ? " rf-on" : ""}`}
        aria-pressed={slot === selected}
        onClick={() => onChange(slot)}
      >
        {timeLabel(slot.split("--")[0])}
      </button>
    ));
  }

  return (
    <div className="rf-appt" role="group" aria-labelledby={inputId}>
      <div className="rf-appt-nav">
        <button
          type="button"
          className="rf-appt-prev"
          aria-label="Previous days"
          disabled={disabled || page === 0}
          onClick={() => live && setPage((p) => Math.max(0, p - 1))}
        >
          ‹
        </button>
        <div className="rf-appt-days">
          {days.map((d) => (
            <button
              key={d.str}
              type="button"
              className={`rf-appt-day${d.str === selectedDay ? " rf-on" : ""}`}
              disabled={disabled || !d.open}
              onClick={() => live && setPickedDay(d.str)}
            >
              <span className="rf-appt-day-wk">{weekdayLabel(d.date)}</span>
              <span className="rf-appt-day-num">{d.date.getDate()}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rf-appt-next"
          aria-label="Next days"
          disabled={
            disabled || (page + 1) * APPT_PER_PAGE > maxDaysAhead
          }
          onClick={() => live && setPage((p) => p + 1)}
        >
          ›
        </button>
      </div>
      <div className="rf-appt-slots">{slotGrid}</div>
      <input type="hidden" id={inputId} value={selected} readOnly />
    </div>
  );
}
