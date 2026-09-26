/**
 * A duration in minutes as plain words in the reader's language, using the
 * browser's own unit names (no i18n keys): 42 → "42 minutes",
 * 130 → "2 hours 10 minutes", 3000 → "2 days 2 hours". Two units at most.
 */
export function durationWords(minutes: number, locale: string): string {
  const unit = (n: number, u: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "long" }).format(n);
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return unit(m, "minute");
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${unit(h, "hour")} ${unit(rest, "minute")}` : unit(h, "hour");
  }
  const d = Math.floor(m / (60 * 24));
  const h = Math.round((m % (60 * 24)) / 60);
  return h ? `${unit(d, "day")} ${unit(h, "hour")}` : unit(d, "day");
}
