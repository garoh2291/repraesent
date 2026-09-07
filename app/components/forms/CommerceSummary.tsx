/**
 * The order summary of a product form: what is being bought, at what price,
 * how many, and what is due today. Rendered by FormRenderer in both preview
 * and live mode with the same classes the embed runtime emits, so the
 * mirrored stylesheet covers all four delivery modes.
 *
 * Imports zero i18next — every string is form content (commerce.*).
 */

import { useEffect, useRef, useState } from "react";
import {
  computeTotals,
  intervalLabel,
  quantityFor,
} from "~/lib/forms/commerce";
import {
  formatMinor,
  type FormCommerce,
  type FormDefinition,
  type FormLocale,
  fillTemplate,
} from "~/lib/forms/schema";

interface Props {
  definition: FormDefinition;
  commerce: FormCommerce;
  locale: FormLocale;
  fallbackLocale: FormLocale;
  quantities: Record<string, number>;
  onQuantityChange?: (priceId: string, quantity: number) => void;
  /** Ticked price ids. The buyer chooses; Checkout is built from these. */
  selection: ReadonlySet<string>;
  onSelectionChange?: (priceId: string, selected: boolean) => void;
  /** The product field's key — the error slot's address. */
  fieldKey: string;
  /** "product_required" when nothing is ticked at submit. */
  error?: string | null;
  t: (key: string) => string;
  mode: "preview" | "live";
  regionProps?: Record<string, unknown>;
}

export function CommerceSummary({
  definition,
  commerce,
  locale,
  fallbackLocale,
  quantities,
  onQuantityChange,
  selection,
  onSelectionChange,
  fieldKey,
  error,
  t,
  mode,
  regionProps,
}: Props) {
  const totals = computeTotals(commerce, quantities, selection);
  const money = (minor: number) => formatMinor(minor, totals.currency, locale);
  const per = (interval: string | null, count: number | null) =>
    intervalLabel(definition, locale, fallbackLocale, interval, count);

  return (
    <section className="rf-commerce" data-rf-commerce {...(regionProps ?? {})}>
      <h3 className="rf-commerce-title">{t("commerce.title")}</h3>
      <ul className="rf-commerce-lines">
        {totals.lines.map(({ item, quantity, total, selected }) => {
          const s = item.snapshot;
          const badge =
            s.type === "recurring" ? per(s.interval, s.intervalCount) : "";
          const adjustable = s.type === "one_time" && item.quantity.adjustable;
          return (
            <li
              className="rf-commerce-line"
              key={item.priceId}
              data-rf-line={item.priceId}
              {...(selected ? {} : { "data-rf-off": "" })}
            >
              <input
                className="rf-commerce-check"
                type="checkbox"
                data-rf-select={item.priceId}
                checked={selected}
                disabled={mode === "preview"}
                aria-label={`${t("commerce.select")} ${s.name}`}
                onChange={(e) =>
                  onSelectionChange?.(item.priceId, e.target.checked)
                }
              />
              {s.image ? (
                <img
                  className="rf-commerce-img"
                  src={s.image}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="rf-commerce-img rf-empty" aria-hidden="true">
                  <BagGlyph />
                </span>
              )}
              <span className="rf-commerce-info">
                <span className="rf-commerce-name">{s.name}</span>
                <span className="rf-commerce-price">
                  <span data-rf-unit>{money(s.unitAmount)}</span>
                  {badge ? (
                    <span className="rf-commerce-badge" data-rf-badge>
                      {badge}
                    </span>
                  ) : null}
                </span>
              </span>
              {adjustable ? (
                <QuantityStepper
                  value={quantity}
                  min={item.quantity.min}
                  max={item.quantity.max}
                  disabled={mode === "preview" || !selected}
                  decreaseLabel={t("commerce.decrease")}
                  increaseLabel={t("commerce.increase")}
                  quantityLabel={t("commerce.quantity")}
                  onChange={(n) => onQuantityChange?.(item.priceId, n)}
                  priceId={item.priceId}
                />
              ) : quantity > 1 ? (
                <span className="rf-qty-fixed">× {quantity}</span>
              ) : null}
              <Money
                className="rf-commerce-line-total"
                value={money(total)}
                attr="data-rf-line-total"
              />
            </li>
          );
        })}
      </ul>
      <dl className="rf-commerce-total">
        <dt data-rf-c="commerce.total">{t("commerce.total")}</dt>
        <dd>
          <Money
            className="rf-money"
            value={money(totals.today)}
            attr="data-rf-total"
            strong
          />
        </dd>
        {totals.recurring ? (
          <dd className="rf-commerce-then" data-rf-then>
            {fillTemplate(t("commerce.then"), {
              amount: money(totals.recurring.amount),
              per: per(
                totals.recurring.interval,
                totals.recurring.intervalCount,
              ),
            })}
          </dd>
        ) : null}
      </dl>
      <p className="rf-commerce-secure">
        <LockGlyph />
        {t("commerce.secure")}
      </p>
      <p className="rf-err" role="alert" data-rf-err={fieldKey}>
        {error ? t(`error.${error}`) || t("error.generic") : ""}
      </p>
    </section>
  );
}

/** A money figure that ticks (scale-in) when its value changes. */
function Money({
  value,
  className,
  attr,
  strong,
}: {
  value: string;
  className: string;
  attr: string;
  strong?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTick((n) => n + 1);
  }, [value]);
  const props = {
    className,
    [attr]: "",
    ...(tick > 0 ? { "data-tick": tick } : {}),
  };
  return strong ? (
    <strong key={tick} {...props}>
      {value}
    </strong>
  ) : (
    <span key={tick} {...props}>
      {value}
    </span>
  );
}

function QuantityStepper({
  value,
  min,
  max,
  disabled,
  decreaseLabel,
  increaseLabel,
  quantityLabel,
  onChange,
  priceId,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  quantityLabel: string;
  onChange: (n: number) => void;
  priceId: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    onChange(clamp(n));
  };
  return (
    <span
      className="rf-qty"
      role="group"
      aria-label={quantityLabel}
      data-rf-qty={priceId}
    >
      <button
        type="button"
        className="rf-qty-btn"
        data-rf-dec
        aria-label={decreaseLabel}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        className="rf-qty-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        aria-label={quantityLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        className="rf-qty-btn"
        data-rf-inc
        aria-label={increaseLabel}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </span>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function BagGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 8h12l-1 11H7L6 8z" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export { quantityFor };
