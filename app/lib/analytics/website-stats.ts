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

// ─── Explorer (/analytics) ─────────────────────────────────────────────────

export type ExplorerInterval = "hour" | "day" | "week" | "month";

function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseLocalDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function rangeDays(from: string, to: string): number {
  const ms = parseLocalDay(to).getTime() - parseLocalDay(from).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Intervals that make sense for a range, the first being the default. */
export function intervalsFor(from: string, to: string): ExplorerInterval[] {
  const days = rangeDays(from, to);
  if (days <= 1) return ["hour"];
  if (days <= 7) return ["day", "hour"];
  if (days <= 31) return ["day", "week"];
  if (days <= 92) return ["day", "week", "month"];
  if (days <= 366) return ["week", "day", "month"];
  return ["month", "week"];
}

/**
 * Every bucket between `from` and `to` in the viewer's own time zone — the
 * same strings the server returns when given that zone — with zeros where the
 * server had no row. Future hours of today are left out.
 */
export function fillSlots(
  points: { date: string; value: number }[],
  interval: ExplorerInterval,
  from: string,
  to: string,
  now = new Date(),
): { date: string; value: number }[] {
  const map = new Map(points.map((p) => [p.date, p.value]));
  const slots: string[] = [];
  const start = parseLocalDay(from);
  const end = parseLocalDay(to);
  if (interval === "hour") {
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      for (let h = 0; h < 24; h++) {
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h);
        if (at > now) break;
        slots.push(`${localDay(d)} ${pad(h)}:00:00`);
      }
    }
  } else if (interval === "week") {
    const d = new Date(start);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    for (; d <= end; d.setDate(d.getDate() + 7)) slots.push(localDay(d));
  } else if (interval === "month") {
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    for (; d <= end; d.setMonth(d.getMonth() + 1)) slots.push(localDay(d));
  } else {
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) slots.push(localDay(d));
  }
  return slots.map((date) => ({ date, value: map.get(date) ?? 0 }));
}

/** Axis / tooltip label for an explorer bucket (already in local time). */
export function explorerLabel(date: string, interval: ExplorerInterval, long = false): string {
  const [day, time] = date.split(" ");
  const d = parseLocalDay(day);
  if (interval === "hour") {
    const hour = Number((time ?? "00").slice(0, 2));
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour);
    const t = at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return long ? `${formatDateShort(d)}, ${t}` : t;
  }
  if (interval === "month") {
    return d.toLocaleDateString(undefined, { month: long ? "long" : "short", year: "numeric" });
  }
  return formatDateShort(d);
}

/** Names for the region codes our customers see most (local spelling). */
const REGION_NAMES: Record<string, string> = {
  "DE-BW": "Baden-Württemberg", "DE-BY": "Bayern", "DE-BE": "Berlin", "DE-BB": "Brandenburg",
  "DE-HB": "Bremen", "DE-HH": "Hamburg", "DE-HE": "Hessen", "DE-MV": "Mecklenburg-Vorpommern",
  "DE-NI": "Niedersachsen", "DE-NW": "Nordrhein-Westfalen", "DE-RP": "Rheinland-Pfalz",
  "DE-SL": "Saarland", "DE-SN": "Sachsen", "DE-ST": "Sachsen-Anhalt",
  "DE-SH": "Schleswig-Holstein", "DE-TH": "Thüringen",
  "AT-1": "Burgenland", "AT-2": "Kärnten", "AT-3": "Niederösterreich", "AT-4": "Oberösterreich",
  "AT-5": "Salzburg", "AT-6": "Steiermark", "AT-7": "Tirol", "AT-8": "Vorarlberg", "AT-9": "Wien",
  "CH-ZH": "Zürich", "CH-BE": "Bern", "CH-LU": "Luzern", "CH-BS": "Basel-Stadt", "CH-BL": "Basel-Landschaft",
  "CH-SG": "St. Gallen", "CH-AG": "Aargau", "CH-TG": "Thurgau", "CH-TI": "Ticino", "CH-VD": "Vaud",
  "CH-GE": "Genève", "CH-ZG": "Zug", "CH-GR": "Graubünden", "CH-SO": "Solothurn", "CH-FR": "Fribourg",
  "NL-DR": "Drenthe", "NL-FL": "Flevoland", "NL-FR": "Fryslân", "NL-GE": "Gelderland",
  "NL-GR": "Groningen", "NL-LI": "Limburg", "NL-NB": "Noord-Brabant", "NL-NH": "Noord-Holland",
  "NL-OV": "Overijssel", "NL-UT": "Utrecht", "NL-ZE": "Zeeland", "NL-ZH": "Zuid-Holland",
  "BE-BRU": "Bruxelles", "BE-VLG": "Vlaanderen", "BE-WAL": "Wallonie",
  "FR-IDF": "Île-de-France", "FR-ARA": "Auvergne-Rhône-Alpes", "FR-PAC": "Provence-Alpes-Côte d'Azur",
  "FR-GES": "Grand Est", "FR-HDF": "Hauts-de-France", "FR-OCC": "Occitanie", "FR-NAQ": "Nouvelle-Aquitaine",
};

export function regionName(code: string): string {
  return REGION_NAMES[code] ?? code;
}

/** Filters in the URL: one JSON param, so values may hold any character. */
export function readFilters<T extends { dim: string; op: string; values: string[] }>(
  raw: string | null,
  dims: readonly string[],
): T[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (f): f is T =>
        !!f &&
        dims.includes((f as T).dim) &&
        ["is", "is_not", "contains"].includes((f as T).op) &&
        Array.isArray((f as T).values) &&
        (f as T).values.every((v) => typeof v === "string"),
    );
  } catch {
    return [];
  }
}
