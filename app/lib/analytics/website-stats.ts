import { formatDateShort } from "~/lib/utils/format";
import type { PlausiblePeriod } from "~/lib/api/workspaces";

/**
 * Helpers for website visitor stats (pa-002 ClickHouse via
 * /users/me/workspace/plausible-stats). Shared by the Website card and the
 * /analytics page. The server buckets in UTC: "YYYY-MM-DD HH:00:00" for
 * today, "YYYY-MM-DD" for days, "YYYY-MM-01" for all time.
 */

export const WEBSITE_PERIODS: { value: PlausiblePeriod; labelKey: string }[] = [
  { value: "1d", labelKey: "home.period1d" },
  { value: "7d", labelKey: "home.period7d" },
  { value: "30d", labelKey: "home.period30d" },
  { value: "all_time", labelKey: "home.periodAllTime" },
];

export type SeriesPoint = { date: string; visitors: number; pageviews: number };

const pad = (n: number) => String(n).padStart(2, "0");
const utcDay = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Every bucket of the period, with zeros where the server had no row. */
export function fillSeriesGaps(
  series: SeriesPoint[],
  period: PlausiblePeriod,
  now = new Date(),
): SeriesPoint[] {
  const map = new Map(series.map((p) => [p.date.replace("T", " "), p]));
  const slots: string[] = [];

  if (period === "1d") {
    for (let h = 0; h <= now.getUTCHours(); h++) {
      slots.push(`${utcDay(now)} ${pad(h)}:00:00`);
    }
  } else if (period === "7d" || period === "30d") {
    const count = period === "7d" ? 7 : 30;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      slots.push(utcDay(d));
    }
  } else {
    // All time: months from the first data point up to this month.
    if (series.length === 0) return series;
    const [fy, fm] = series[0].date.split("-").map(Number);
    let y = fy;
    let m = fm;
    const endY = now.getUTCFullYear();
    const endM = now.getUTCMonth() + 1;
    while (y < endY || (y === endY && m <= endM)) {
      slots.push(`${y}-${pad(m)}-01`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }

  return slots.map(
    (key) => map.get(key) ?? { date: key, visitors: 0, pageviews: 0 },
  );
}

/** Axis / tooltip label for one bucket, in the reader's own time and words. */
export function formatBucketLabel(date: string, period: PlausiblePeriod): string {
  if (period === "1d") {
    const at = new Date(`${date.replace(" ", "T").slice(0, 19)}Z`);
    if (Number.isNaN(at.getTime())) return date;
    return at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const [year, month, day] = date.split("-").map(Number);
  if (period === "all_time") {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(undefined, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  return formatDateShort(new Date(year, month - 1, day));
}

/**
 * Seconds as one short phrase that fits a stat on a phone: 45 → "45 sec",
 * 95 → "2 min", 3900 → "1 hr 5 min" (browser unit names, no i18n keys).
 */
export function secondsToWords(seconds: number, locale: string): string {
  const unit = (n: number, u: "second" | "minute" | "hour") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "short" }).format(n);
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return unit(s, "second");
  if (s < 3600) return unit(Math.round(s / 60), "minute");
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${unit(h, "hour")} ${unit(m, "minute")}` : unit(h, "hour");
}

/** Flag emoji from a two-letter country code ("DE" → 🇩🇪). */
export function flagEmoji(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
