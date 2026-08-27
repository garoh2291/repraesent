/**
 * OpenAI Ads money values are micros — millionths of the ad account's
 * currency unit — kept as integers through the whole API. These two helpers
 * are the only place the factor lives on the client.
 *
 * The account currency is not exposed by the connection endpoint yet; EUR is
 * the launch default (OpenAI Ads is currently Europe-only) and the parameter
 * exists so a later account-currency field slots in without touching callers.
 */

export function formatMicros(
  micros: number | null | undefined,
  currency = "EUR",
  locale?: string,
): string {
  if (micros == null || !Number.isFinite(micros)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(micros / 1_000_000);
}

export function toMicros(value: string | number): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1_000_000);
}

export function formatCount(
  value: number | null | undefined,
  locale?: string,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { notation: "compact" }).format(value);
}

export function formatPercent(
  ratio: number | null | undefined,
  locale?: string,
): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(ratio);
}
