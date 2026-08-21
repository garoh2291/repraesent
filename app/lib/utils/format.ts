import i18n from "~/i18n";
import { format as dateFnsFormat, formatDistanceToNow as dateFnsDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";

/**
 * Returns the Intl locale string based on current i18n language.
 * "de" -> "de-DE", "en" -> "en-US"
 */
export function getIntlLocale(): string {
  return i18n.language === "de" ? "de-DE" : "en-US";
}

/** Returns the date-fns locale object based on current i18n language. */
export function getDateFnsLocale() {
  return i18n.language === "de" ? de : enUS;
}

// --------------- Numbers ---------------

/** Format a plain number with locale-aware thousand separators and decimals. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getIntlLocale()).format(value);
}

/** Format a number with fixed decimal places, locale-aware. */
export function formatDecimal(value: number, decimals = 2): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// --------------- Currency ---------------

/**
 * Format an amount in EUR (major units, e.g. 12.50 not 1250 cents).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a Stripe-style amount (in cents) as EUR.
 */
export function formatCurrencyFromCents(amountCents: number): string {
  return formatCurrency(amountCents / 100);
}

/**
 * Format a minor-unit amount in an arbitrary currency.
 *
 * Separate from `formatCurrency`, which hardcodes EUR: a connected Stripe
 * account sets its own currency per price, and rendering a USD product with a
 * € sign is a wrong number, not a cosmetic slip.
 *
 * Zero-decimal currencies (JPY, KRW, …) do not multiply by 100 in Stripe, so
 * they must not be divided by 100 here either.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function formatMoneyFromMinor(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amountMinor === null || amountMinor === undefined) return "—";

  const code = (currency || "eur").toLowerCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(code);
  const value = isZeroDecimal ? amountMinor : amountMinor / 100;

  try {
    return new Intl.NumberFormat(getIntlLocale(), {
      style: "currency",
      currency: code.toUpperCase(),
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    // Intl throws on an unknown currency code rather than degrading.
    return `${formatDecimal(value, isZeroDecimal ? 0 : 2)} ${code.toUpperCase()}`;
  }
}

// --------------- Dates ---------------

/**
 * Locale-aware wrapper around date-fns `format`.
 * Automatically picks de or enUS locale.
 */
export function formatDate(
  date: Date | number | string,
  formatStr: string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(d, formatStr, { locale: getDateFnsLocale() });
}

/**
 * Locale-aware wrapper around date-fns `formatDistanceToNow`.
 */
export function formatRelativeTime(
  date: Date | number | string,
  options?: { addSuffix?: boolean },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFnsDistanceToNow(d, {
    addSuffix: options?.addSuffix ?? true,
    locale: getDateFnsLocale(),
  });
}

/**
 * Format a date using Intl.DateTimeFormat with the current locale.
 * Useful when you need specific Intl options (timezone, dateStyle, etc.)
 */
export function formatDateIntl(
  date: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(getIntlLocale(), options).format(
    typeof d === "number" ? d : d instanceof Date ? d : new Date(d),
  );
}

/**
 * Format a date for display in locale-aware short format (e.g. "31. Marz" or "Mar 31").
 */
export function formatDateShort(date: Date | number | string): string {
  return formatDateIntl(date, { month: "short", day: "numeric" });
}

/**
 * Format a date for display in locale-aware medium format (e.g. "31. Marz 2026" or "Mar 31, 2026").
 */
export function formatDateMedium(date: Date | number | string): string {
  return formatDateIntl(date, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Format a date for display in locale-aware long format (e.g. "Montag, 31. Marz 2026" or "Monday, March 31, 2026").
 */
export function formatDateLong(date: Date | number | string): string {
  return formatDateIntl(date, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/**
 * Format time only, locale-aware (e.g. "14:30" for de, "2:30 PM" for en).
 */
export function formatTime(
  date: Date | number | string,
  options?: { hour12?: boolean; timeZone?: string },
): string {
  return formatDateIntl(date, {
    hour: "2-digit",
    minute: "2-digit",
    ...(options?.hour12 !== undefined ? { hour12: options.hour12 } : {}),
    ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
  });
}
