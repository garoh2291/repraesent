/**
 * Time zones people recognise: a city they know, its country and the zone's
 * everyday name — not the old Windows list ("(GMT+1) Casablanca",
 * "Midway Island"). NN/g's advice for time-zone pickers, which Google
 * Calendar and Calendly follow too: label by city + country + offset, let
 * people search by any of those or by the zone's name, common ones on top.
 *
 * Every label is computed with `Intl` at the moment it's shown, so offsets
 * follow summer time and names follow the app language
 * ("Mitteleuropäische Zeit" in German).
 */

export type ZoneEntry = {
  /** IANA id, the value we store. */
  zone: string;
  /** The city people know it by (English; the country is localised). */
  city: string;
  /** ISO 3166 code; null for UTC. */
  country: string | null;
  /** Extra words that find it: other cities, the country in its own language. */
  aliases?: string[];
};

/** Shown first: where our customers are, and our own team. */
export const COMMON_ZONES = [
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/London",
  "Asia/Yerevan",
] as const;

/** The default for a new calendar, whatever the browser says. */
export const DEFAULT_ZONE = "Europe/Berlin";

export const ZONES: ZoneEntry[] = [
  { zone: "UTC", city: "UTC", country: null, aliases: ["GMT", "Coordinated Universal Time"] },
  // Europe
  { zone: "Europe/London", city: "London", country: "GB", aliases: ["UK", "England", "Britain", "Manchester", "Edinburgh"] },
  { zone: "Europe/Dublin", city: "Dublin", country: "IE" },
  { zone: "Europe/Lisbon", city: "Lisbon", country: "PT", aliases: ["Lisboa", "Porto"] },
  { zone: "Atlantic/Canary", city: "Canary Islands", country: "ES", aliases: ["Tenerife", "Gran Canaria", "Las Palmas"] },
  { zone: "Atlantic/Azores", city: "Azores", country: "PT", aliases: ["Ponta Delgada"] },
  { zone: "Atlantic/Reykjavik", city: "Reykjavik", country: "IS" },
  { zone: "Europe/Berlin", city: "Berlin", country: "DE", aliases: ["Deutschland", "München", "Munich", "Hamburg", "Köln", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "CET", "MEZ"] },
  { zone: "Europe/Paris", city: "Paris", country: "FR", aliases: ["Lyon", "Marseille", "Toulouse", "Nice"] },
  { zone: "Europe/Amsterdam", city: "Amsterdam", country: "NL", aliases: ["Nederland", "Holland", "Rotterdam", "Den Haag", "The Hague", "Utrecht", "Eindhoven"] },
  { zone: "Europe/Brussels", city: "Brussels", country: "BE", aliases: ["Bruxelles", "Brüssel", "Brussel", "Antwerp", "Antwerpen", "Gent", "Liège", "Belgique", "België"] },
  { zone: "Europe/Luxembourg", city: "Luxembourg", country: "LU", aliases: ["Luxemburg"] },
  { zone: "Europe/Vienna", city: "Vienna", country: "AT", aliases: ["Wien", "Österreich", "Graz", "Salzburg", "Linz", "Innsbruck"] },
  { zone: "Europe/Zurich", city: "Zurich", country: "CH", aliases: ["Zürich", "Schweiz", "Suisse", "Geneva", "Genève", "Genf", "Bern", "Basel", "Lausanne"] },
  { zone: "Europe/Rome", city: "Rome", country: "IT", aliases: ["Roma", "Milan", "Milano", "Italia"] },
  { zone: "Europe/Madrid", city: "Madrid", country: "ES", aliases: ["Barcelona", "Valencia", "Sevilla", "España"] },
  { zone: "Europe/Copenhagen", city: "Copenhagen", country: "DK", aliases: ["København"] },
  { zone: "Europe/Stockholm", city: "Stockholm", country: "SE" },
  { zone: "Europe/Oslo", city: "Oslo", country: "NO" },
  { zone: "Europe/Warsaw", city: "Warsaw", country: "PL", aliases: ["Warszawa", "Kraków", "Polska"] },
  { zone: "Europe/Prague", city: "Prague", country: "CZ", aliases: ["Praha", "Prag"] },
  { zone: "Europe/Budapest", city: "Budapest", country: "HU" },
  { zone: "Europe/Belgrade", city: "Belgrade", country: "RS", aliases: ["Beograd"] },
  { zone: "Europe/Zagreb", city: "Zagreb", country: "HR" },
  { zone: "Europe/Athens", city: "Athens", country: "GR", aliases: ["Athen", "Thessaloniki"] },
  { zone: "Europe/Bucharest", city: "Bucharest", country: "RO", aliases: ["București"] },
  { zone: "Europe/Sofia", city: "Sofia", country: "BG" },
  { zone: "Europe/Helsinki", city: "Helsinki", country: "FI" },
  { zone: "Europe/Tallinn", city: "Tallinn", country: "EE" },
  { zone: "Europe/Riga", city: "Riga", country: "LV" },
  { zone: "Europe/Vilnius", city: "Vilnius", country: "LT" },
  { zone: "Europe/Kyiv", city: "Kyiv", country: "UA", aliases: ["Kiev", "Kiew", "Lviv", "Odesa"] },
  { zone: "Europe/Chisinau", city: "Chișinău", country: "MD", aliases: ["Chisinau"] },
  { zone: "Europe/Istanbul", city: "Istanbul", country: "TR", aliases: ["Ankara", "Türkiye", "Turkey"] },
  { zone: "Europe/Minsk", city: "Minsk", country: "BY" },
  { zone: "Europe/Moscow", city: "Moscow", country: "RU", aliases: ["Moskau", "Moskva", "St Petersburg"] },
  // Caucasus, Middle East, Africa
  { zone: "Asia/Yerevan", city: "Yerevan", country: "AM", aliases: ["Armenia", "Hayastan", "Երևան", "Gyumri"] },
  { zone: "Asia/Tbilisi", city: "Tbilisi", country: "GE", aliases: ["Batumi"] },
  { zone: "Asia/Baku", city: "Baku", country: "AZ" },
  { zone: "Asia/Dubai", city: "Dubai", country: "AE", aliases: ["Abu Dhabi", "UAE"] },
  { zone: "Asia/Qatar", city: "Doha", country: "QA" },
  { zone: "Asia/Riyadh", city: "Riyadh", country: "SA", aliases: ["Jeddah", "Kuwait"] },
  { zone: "Asia/Tehran", city: "Tehran", country: "IR" },
  { zone: "Asia/Jerusalem", city: "Jerusalem", country: "IL", aliases: ["Tel Aviv"] },
  { zone: "Asia/Beirut", city: "Beirut", country: "LB" },
  { zone: "Asia/Amman", city: "Amman", country: "JO" },
  { zone: "Africa/Cairo", city: "Cairo", country: "EG" },
  { zone: "Africa/Casablanca", city: "Casablanca", country: "MA", aliases: ["Rabat", "Marrakesh"] },
  { zone: "Africa/Algiers", city: "Algiers", country: "DZ" },
  { zone: "Africa/Tunis", city: "Tunis", country: "TN" },
  { zone: "Africa/Lagos", city: "Lagos", country: "NG", aliases: ["Abuja"] },
  { zone: "Africa/Accra", city: "Accra", country: "GH" },
  { zone: "Africa/Nairobi", city: "Nairobi", country: "KE" },
  { zone: "Africa/Johannesburg", city: "Johannesburg", country: "ZA", aliases: ["Cape Town", "Pretoria"] },
  // Asia, Pacific
  { zone: "Asia/Karachi", city: "Karachi", country: "PK", aliases: ["Lahore", "Islamabad"] },
  { zone: "Asia/Tashkent", city: "Tashkent", country: "UZ" },
  { zone: "Asia/Almaty", city: "Almaty", country: "KZ", aliases: ["Astana"] },
  { zone: "Asia/Kolkata", city: "Mumbai", country: "IN", aliases: ["Delhi", "New Delhi", "Bangalore", "Kolkata", "Chennai", "India"] },
  { zone: "Asia/Kathmandu", city: "Kathmandu", country: "NP" },
  { zone: "Asia/Dhaka", city: "Dhaka", country: "BD" },
  { zone: "Asia/Bangkok", city: "Bangkok", country: "TH" },
  { zone: "Asia/Ho_Chi_Minh", city: "Ho Chi Minh City", country: "VN", aliases: ["Saigon", "Hanoi"] },
  { zone: "Asia/Jakarta", city: "Jakarta", country: "ID" },
  { zone: "Asia/Singapore", city: "Singapore", country: "SG" },
  { zone: "Asia/Kuala_Lumpur", city: "Kuala Lumpur", country: "MY" },
  { zone: "Asia/Manila", city: "Manila", country: "PH" },
  { zone: "Asia/Hong_Kong", city: "Hong Kong", country: "HK" },
  { zone: "Asia/Shanghai", city: "Beijing", country: "CN", aliases: ["Shanghai", "Shenzhen", "China"] },
  { zone: "Asia/Taipei", city: "Taipei", country: "TW" },
  { zone: "Asia/Seoul", city: "Seoul", country: "KR" },
  { zone: "Asia/Tokyo", city: "Tokyo", country: "JP", aliases: ["Osaka"] },
  { zone: "Australia/Perth", city: "Perth", country: "AU" },
  { zone: "Australia/Adelaide", city: "Adelaide", country: "AU" },
  { zone: "Australia/Brisbane", city: "Brisbane", country: "AU" },
  { zone: "Australia/Sydney", city: "Sydney", country: "AU", aliases: ["Melbourne", "Canberra"] },
  { zone: "Pacific/Auckland", city: "Auckland", country: "NZ", aliases: ["Wellington"] },
  { zone: "Pacific/Honolulu", city: "Honolulu", country: "US", aliases: ["Hawaii"] },
  // Americas
  { zone: "America/Anchorage", city: "Anchorage", country: "US", aliases: ["Alaska"] },
  { zone: "America/Los_Angeles", city: "Los Angeles", country: "US", aliases: ["Pacific Time", "San Francisco", "Seattle", "San Diego", "Las Vegas", "PST", "PT"] },
  { zone: "America/Vancouver", city: "Vancouver", country: "CA" },
  { zone: "America/Phoenix", city: "Phoenix", country: "US", aliases: ["Arizona"] },
  { zone: "America/Denver", city: "Denver", country: "US", aliases: ["Mountain Time", "Salt Lake City", "MST", "MT"] },
  { zone: "America/Chicago", city: "Chicago", country: "US", aliases: ["Central Time", "Dallas", "Houston", "Austin", "CST", "CT"] },
  { zone: "America/Mexico_City", city: "Mexico City", country: "MX", aliases: ["Ciudad de México", "Guadalajara"] },
  { zone: "America/New_York", city: "New York", country: "US", aliases: ["Eastern Time", "Miami", "Washington", "Boston", "Atlanta", "EST", "ET"] },
  { zone: "America/Toronto", city: "Toronto", country: "CA", aliases: ["Montreal", "Ottawa"] },
  { zone: "America/Bogota", city: "Bogotá", country: "CO", aliases: ["Bogota"] },
  { zone: "America/Lima", city: "Lima", country: "PE" },
  { zone: "America/Halifax", city: "Halifax", country: "CA", aliases: ["Atlantic Time"] },
  { zone: "America/Caracas", city: "Caracas", country: "VE" },
  { zone: "America/Santiago", city: "Santiago", country: "CL" },
  { zone: "America/Argentina/Buenos_Aires", city: "Buenos Aires", country: "AR" },
  { zone: "America/Sao_Paulo", city: "São Paulo", country: "BR", aliases: ["Sao Paulo", "Rio de Janeiro", "Brasília", "Brazil"] },
  { zone: "America/St_Johns", city: "St. John's", country: "CA", aliases: ["Newfoundland"] },
];

const BY_ZONE = new Map(ZONES.map((z) => [z.zone, z]));

/** Whether this runtime knows the zone (bad ids would throw in Intl). */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The entry for a zone; one we don't list (an older choice) gets a plain one, so no value is lost. */
export function zoneEntry(zone: string): ZoneEntry {
  return (
    BY_ZONE.get(zone) ?? {
      zone,
      city: (zone.split("/").pop() ?? zone).replace(/_/g, " "),
      country: null,
    }
  );
}

function part(zone: string, locale: string, timeZoneName: Intl.DateTimeFormatOptions["timeZoneName"], at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "GMT+1", "GMT+5:30", "GMT" — today's offset, summer time included. */
export function zoneOffsetLabel(zone: string, at: Date = new Date()): string {
  return part(zone, "en-US", "shortOffset", at) || "GMT";
}

/** Offset in minutes, for sorting. */
export function zoneOffsetMinutes(zone: string, at: Date = new Date()): number {
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(zoneOffsetLabel(zone, at));
  if (!m) return 0;
  const v = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -v : v;
}

/** "Central European Time" / "Mitteleuropäische Zeit"; empty when the runtime can't say. */
export function zoneGenericName(zone: string, locale: string, at: Date = new Date()): string {
  const name = part(zone, locale, "longGeneric", at);
  // Runtimes without a name fall back to "GMT+01:00" — that's the offset again, not a name.
  return /^(GMT|UTC)([+-]|$)/.test(name) ? "" : name;
}

const countryNames = new Map<string, Intl.DisplayNames | null>();
export function countryName(code: string | null, locale: string): string {
  if (!code) return "";
  if (!countryNames.has(locale)) {
    try {
      countryNames.set(locale, new Intl.DisplayNames([locale], { type: "region" }));
    } catch {
      countryNames.set(locale, null);
    }
  }
  return countryNames.get(locale)?.of(code) ?? code;
}

/** "14:32" in that zone now. */
export function zoneClock(zone: string, locale: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(at);
  } catch {
    return "";
  }
}

export type ZoneOption = ZoneEntry & {
  countryLabel: string;
  name: string;
  offset: string;
  offsetMinutes: number;
  /** Lower-case, accent-free words the search matches. */
  haystack: string;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function zoneOption(entry: ZoneEntry, locale: string, at: Date = new Date()): ZoneOption {
  const countryLabel = countryName(entry.country, locale);
  const name = zoneGenericName(entry.zone, locale, at);
  const offset = zoneOffsetLabel(entry.zone, at);
  const haystack = fold(
    [
      entry.city,
      ...(entry.aliases ?? []),
      countryLabel,
      countryName(entry.country, "en"),
      name,
      zoneGenericName(entry.zone, "en", at),
      offset,
      offset.replace("GMT", "UTC"),
      entry.zone.replace(/_/g, " "),
    ].join(" | "),
  );
  return { ...entry, countryLabel, name, offset, offsetMinutes: zoneOffsetMinutes(entry.zone, at), haystack };
}

/** Every option, the current value included even when we don't list it, west to east. */
export function zoneOptions(locale: string, current?: string | null, at: Date = new Date()): ZoneOption[] {
  const entries = [...ZONES];
  if (current && !BY_ZONE.has(current) && isValidZone(current)) entries.push(zoneEntry(current));
  return entries
    .map((e) => zoneOption(e, locale, at))
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city, locale));
}

/** Does the option match what was typed? Every word has to be found somewhere. */
export function matchesZone(option: ZoneOption, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.every((w) => option.haystack.includes(w));
}

/** "Berlin" for a stored zone; "Berlin time" is the caller's sentence. */
export function zoneCity(zone: string): string {
  return zoneEntry(zone).city;
}
