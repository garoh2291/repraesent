import { toast } from "sonner";
import type {
  ReTranslateSettings,
  ReTranslateSwitcher,
  ReTranslateSwitcherLayout,
  ReTranslateSwitcherPosition,
  ReTranslateSwitcherShow,
} from "~/lib/wordpress/plugin-settings-types";

/** Mirrors `ReTranslate\Settings::switcher_defaults()`. */
export const DEFAULT_SWITCHER: ReTranslateSwitcher = {
  position: "bottom-right",
  layout: "inline",
  show: "label",
  hide_current: false,
  label: "",
  colors: {
    text: "",
    bg: "",
    border: "",
    active_text: "",
    active_bg: "",
  },
  radius: "",
  pad_y: "",
  pad_x: "",
  offset_y: "",
  offset_x: "",
};

export const DEFAULT_SETTINGS: ReTranslateSettings = {
  source_language: "",
  site_locale: "",
  kill_switch: false,
  delete_on_uninstall: false,
  post_types: [],
  available_post_types: [],
  languages: [],
  switcher: DEFAULT_SWITCHER,
  index: {
    status: "idle",
    total: 0,
    processed: 0,
    strings: 0,
    started_at: "",
    updated_at: "",
  },
  bulk: {
    status: "idle",
    languages: [],
    total: 0,
    processed: 0,
    failed: 0,
    current: null,
    recent: [],
    last_error: "",
    started_at: "",
    updated_at: "",
  },
  stats: { source_strings: 0, languages: {} },
};

export type TabId =
  | "overview"
  | "translate"
  | "switcher"
  | "settings";

/** Query param carrying the open tab, so a refresh or a shared link reopens it. */
export const TAB_PARAM = "tab";

/** Query param for the Translate content list page (survives back from the editor). */
export const PAGE_PARAM = "page";

/** Query param for the Translate type filter (`page`, `cookie`, `forms`, …). */
export const TYPE_PARAM = "type";

/** Plugin object types that are a single pack — open the field editor directly. */
export const SINGLETON_PLUGIN_TYPES = new Set(["cookie", "maintenance"]);

const PLUGIN_TYPE_FILTERS = new Set(["cookie", "maintenance", "reappt"]);

/** True when the Translate type filter is a bridged plugin object_type. */
export function isPluginTypeFilter(filter: string): boolean {
  return PLUGIN_TYPE_FILTERS.has(filter);
}

/** Encode the in-app type filter for `?type=`. Returns null when it should be omitted. */
export function typeToParam(filter: string): string | null {
  if (!filter || filter === "all") return null;
  if (filter === "_header_footer") return "header_footer";
  if (filter === "_rf_forms") return "forms";
  return filter;
}

/** Decode `?type=` into the in-app type filter. */
export function typeFromParam(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value || value === "all") return "all";
  if (value === "header_footer" || value === "chrome") return "_header_footer";
  if (value === "forms" || value === "rf_form") return "_rf_forms";
  if (value === "plugin") return "all";
  return value;
}

const TAB_IDS: readonly TabId[] = [
  "overview",
  "translate",
  "switcher",
  "settings",
];

/** Old links with `?tab=languages` land on Overview, where languages live now. */
const TAB_ALIASES: Record<string, TabId> = {
  general: "settings",
  languages: "overview",
};

export function tabFromParam(value: string | null): TabId {
  if (!value) return "overview";
  if (TAB_IDS.includes(value as TabId)) return value as TabId;
  return TAB_ALIASES[value] ?? "overview";
}

export function pageFromParam(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export type PatchSettings = (
  updater: (prev: ReTranslateSettings) => ReTranslateSettings,
) => void;

export const SWITCHER_POSITIONS: readonly ReTranslateSwitcherPosition[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
];

export const SWITCHER_LAYOUTS: readonly ReTranslateSwitcherLayout[] = [
  "inline",
  "dropdown",
];

export const SWITCHER_SHOW_MODES: readonly ReTranslateSwitcherShow[] = [
  "label",
  "code",
  "flag",
  "flag_label",
  "flag_code",
];

/**
 * The optional lengths, mirroring `Settings::SWITCHER_LENGTHS`.
 *
 * `max` is the plugin's own ceiling; `sliderMax` is a saner range for a slider
 * (the plugin accepts a 400px offset, but nobody drags to it). `fallback` is
 * where the slider rests while the setting is empty — the stylesheet's own
 * default in the pixels it works out to at a normal font size, so letting go of
 * an untouched slider does not jump the switcher.
 */
export const SWITCHER_LENGTHS = {
  radius: { max: 99, sliderMax: 24, fallback: 4 },
  pad_y: { max: 40, sliderMax: 24, fallback: 6 },
  pad_x: { max: 60, sliderMax: 40, fallback: 11 },
  offset_y: { max: 400, sliderMax: 200, fallback: 0 },
  offset_x: { max: 400, sliderMax: 200, fallback: 0 },
} as const;

export type SwitcherLengthKey = keyof typeof SWITCHER_LENGTHS;

/**
 * What an untouched bottom offset works out to, matching switcher.css: enough
 * to line the pill up with a cookie manager button, which re:cookie pins at
 * `bottom: 20px` — 16px of inset plus 4. Nothing sits along the top edge by
 * convention, so that direction defaults to nothing.
 */
const BOTTOM_ALIGN = 4;

export function offsetFallback(position: string): number {
  return position.startsWith("bottom") ? BOTTOM_ALIGN : 0;
}

/**
 * Language names and flags — the same catalog `Language_Detector` uses, so the
 * preview and the language list read properly even when the stored record was
 * saved without a label or a flag.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  ar: "العربية",
  bg: "Български",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  fa: "فارسی",
  fi: "Suomi",
  fr: "Français",
  he: "עברית",
  hi: "हिन्दी",
  hr: "Hrvatski",
  hu: "Magyar",
  id: "Bahasa Indonesia",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  nl: "Nederlands",
  no: "Norsk",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  ru: "Русский",
  sk: "Slovenčina",
  sl: "Slovenščina",
  sr: "Српски",
  sv: "Svenska",
  th: "ไทย",
  tr: "Türkçe",
  uk: "Українська",
  ur: "اردو",
  vi: "Tiếng Việt",
  zh: "中文",
};

const FLAG_COUNTRY: Record<string, string> = {
  ar: "SA",
  bg: "BG",
  cs: "CZ",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "GB",
  es: "ES",
  fa: "IR",
  fi: "FI",
  fr: "FR",
  he: "IL",
  hi: "IN",
  hr: "HR",
  hu: "HU",
  id: "ID",
  it: "IT",
  ja: "JP",
  ko: "KR",
  nl: "NL",
  no: "NO",
  pl: "PL",
  pt: "PT",
  ro: "RO",
  ru: "RU",
  sk: "SK",
  sl: "SI",
  sr: "RS",
  sv: "SE",
  th: "TH",
  tr: "TR",
  uk: "UA",
  ur: "PK",
  vi: "VN",
  zh: "CN",
};

/** Two-letter country code to its regional-indicator pair. */
function countryFlag(country: string): string {
  if (!/^[A-Za-z]{2}$/.test(country)) return "";
  return [...country.toUpperCase()]
    .map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65))
    .join("");
}

/**
 * Flag for a language code. A regional code names its own country outright —
 * "en-us" is the one case where the flag is not a guess at all — so it wins
 * over the language's conventional one.
 */
export function languageFlag(code: string): string {
  const region = languageRegion(code);
  if (region) return countryFlag(region);
  return countryFlag(FLAG_COUNTRY[baseLanguage(code)] ?? "");
}

/**
 * Human name for a language code. A regional code inherits its language's name
 * ("en-us" → "English"), so lists stay readable; use {@link languageRegionName}
 * when two entries of the same language have to be told apart.
 *
 * The catalog wins over a stored label: a bad/stale `label` in wp_options
 * (or a garbled unserialize) must not show "Arabic" next to a German flag.
 */
export function languageName(code: string, fallback = ""): string {
  const normalized = normalizeLanguageCode(code);
  return (
    LANGUAGE_NAMES[normalized] ??
    LANGUAGE_NAMES[baseLanguage(code)] ??
    (fallback || languageDisplayCode(code))
  );
}

/**
 * A language's full name for a list a person reads: the language, plus the
 * country when the code carries one, so two English rows are tellable apart.
 * The bare {@link languageName} is what belongs on the site itself.
 */
export function languageDisplayName(code: string, fallback = ""): string {
  const region = languageRegionName(code);
  const name = languageName(code, fallback);
  return region ? `${name} (${region})` : name;
}

/** A language as the switcher preview needs it: always labelled, often flagged. */
export type PreviewLanguage = {
  code: string;
  label: string;
  flag: string;
  current: boolean;
};

export function previewLanguage(
  language: { code: string; label?: string; flag?: string },
  current = false,
): PreviewLanguage {
  return {
    code: language.code,
    label: languageName(language.code, language.label),
    flag: resolveLanguageFlag(language.flag, language.code),
    current,
  };
}

/**
 * A post type slug as a human label. WordPress owns the real labels and they
 * need WordPress running to read, so "product_variation" becomes "Product
 * variation" rather than being shown raw.
 */
export function postTypeLabel(name: string): string {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type TranslateFn = (key: string, fallback: string) => string;

/** Post type slug as a UI label, using locale strings when we have them. */
export function translatedPostTypeLabel(
  name: string,
  t: TranslateFn,
): string {
  return t(`wordpress.reTranslate.postType.${name}`, postTypeLabel(name));
}

/** Bridged plugin object_type as a UI label (dropdown + list rows). */
export function translatedPluginLabel(
  objectType: string,
  t: TranslateFn,
  displayName?: string,
): string {
  return t(
    `wordpress.reTranslate.pluginType.${objectType}`,
    displayName?.trim() || postTypeLabel(objectType),
  );
}

/**
 * Field key → short label a translator reads ("Heading", "Paragraph").
 * Mirrors the API / plugin `Field_Labels` so a stale or missing `label` still
 * never dumps the raw `block:0.0.1:core/heading:…` path into the UI.
 */
export function humanizeFieldKey(key: string): string {
  const special: Record<string, string> = {
    post_title: "Title",
    post_excerpt: "Excerpt",
    "media:featured": "Featured image",
    "form.title": "Form title",
    "form.description": "Form description",
    "form.submit": "Submit button",
    "form.submit_label": "Submit button",
  };
  if (special[key]) return special[key];

  const parts = key.split(":");
  if ((parts[0] ?? "").toLowerCase() === "block") {
    const blockName = (parts[2] ?? "").toLowerCase();
    const known: Record<string, string> = {
      "core/paragraph": "Paragraph",
      "core/heading": "Heading",
      "core/list": "List",
      "core/list-item": "List item",
      "core/quote": "Quote",
      "core/button": "Button",
      "core/image": "Image",
      "core/cover": "Cover",
      "core/gallery": "Gallery",
      "core/table": "Table",
      "core/freeform": "Classic content",
      "core/html": "Custom HTML",
    };
    let label =
      blockName === ""
        ? "Classic content"
        : (known[blockName] ??
          humanizeWords(
            blockName.includes("/")
              ? blockName.slice(blockName.indexOf("/") + 1)
              : blockName,
          ));
    const attrAt = parts.findIndex((p) => p.toLowerCase() === "attr");
    if (attrAt >= 0 && parts[attrAt + 1]) {
      label = `${label} — ${parts[attrAt + 1]}`;
    }
    return label;
  }

  return humanizeWords(key.replace(/^(seo|field|meta):/, ""));
}

function humanizeWords(value: string): string {
  const cleaned = value
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return value;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function flash(text: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(text);
  else toast.success(text);
}

/* ── Language catalog ────────────────────────────────────────────────── */

/**
 * Regional variants offered alongside each bare language — mirrors
 * `Language_Detector::REGIONS` in the plugin.
 *
 * A language is not a country, and plenty of sites want plain "German". These
 * are for the ones that genuinely serve one market differently from another: a
 * Brazilian shop and a Portuguese one do not read the same. The list stops at
 * the splits people actually ask for rather than enumerating every ISO pairing.
 */
const LANGUAGE_REGIONS: Record<string, string[]> = {
  ar: ["SA", "AE", "EG", "MA"],
  de: ["DE", "AT", "CH"],
  el: ["GR"],
  en: ["US", "GB", "AU", "CA", "IE", "NZ", "ZA"],
  es: ["ES", "MX", "AR", "CO", "CL"],
  fr: ["FR", "BE", "CA", "CH"],
  it: ["IT", "CH"],
  nl: ["NL", "BE"],
  pt: ["PT", "BR"],
  sv: ["SE", "FI"],
  zh: ["CN", "TW", "HK"],
};

const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BE: "Belgium",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  DE: "Germany",
  EG: "Egypt",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  HK: "Hong Kong",
  IE: "Ireland",
  IT: "Italy",
  MA: "Morocco",
  MX: "Mexico",
  NL: "Netherlands",
  NZ: "New Zealand",
  PT: "Portugal",
  SA: "Saudi Arabia",
  SE: "Sweden",
  TW: "Taiwan",
  US: "United States",
  ZA: "South Africa",
};

/** WordPress locales that aren't simply `language_REGION`. */
const REGION_LOCALES: Record<string, string> = {
  "zh-hk": "zh_HK",
  "zh-tw": "zh_TW",
};

/** Default WordPress locale per bare language — mirrors the plugin's table. */
const LANGUAGE_LOCALES: Record<string, string> = {
  ar: "ar",
  bg: "bg_BG",
  cs: "cs_CZ",
  da: "da_DK",
  de: "de_DE",
  el: "el",
  en: "en_US",
  es: "es_ES",
  fa: "fa_IR",
  fi: "fi",
  fr: "fr_FR",
  he: "he_IL",
  hi: "hi_IN",
  hr: "hr",
  hu: "hu_HU",
  id: "id_ID",
  it: "it_IT",
  ja: "ja",
  ko: "ko_KR",
  nl: "nl_NL",
  no: "nb_NO",
  pl: "pl_PL",
  pt: "pt_PT",
  ro: "ro_RO",
  ru: "ru_RU",
  sk: "sk_SK",
  sl: "sl_SI",
  sr: "sr_RS",
  sv: "sv_SE",
  th: "th",
  tr: "tr_TR",
  uk: "uk",
  ur: "ur",
  vi: "vi",
  zh: "zh_CN",
};

/**
 * A language code as the plugin will store it — mirrors
 * `Languages::normalize_code()`.
 *
 * The plugin lowercases everything and collapses a WordPress locale to its
 * language ("de_DE" → "de") while keeping a dashed code whole ("en-US" →
 * "en-us"). Anything comparing a picked code against a stored one has to go
 * through here, or the picker keeps offering a language that is already added.
 */
export function normalizeLanguageCode(code: string): string {
  let out = code.toLowerCase().trim();
  if (out.includes("_")) out = out.split("_")[0] ?? out;
  return out.replace(/[^a-z0-9-]/g, "").slice(0, 10);
}

/** The language part of a code: "en-us" and "en" both give "en". */
function baseLanguage(code: string): string {
  const normalized = normalizeLanguageCode(code);
  return normalized.includes("-")
    ? (normalized.split("-")[0] ?? normalized)
    : normalized;
}

/**
 * Short code for the switcher: "de" and "de-de" both show as "DE".
 * Mirrors `Language_Detector::display_code()` — the region already lives in
 * the flag, so uppercasing the whole stored code would print "DE-DE".
 */
export function languageDisplayCode(code: string): string {
  return baseLanguage(code).toUpperCase();
}

/**
 * A usable flag emoji for a language row.
 *
 * Prefer the catalog flag for the code — a stored emoji can be wrong or a
 * leftover from another language after a bad write. Fall back to a bare
 * two-letter country someone saved as the "flag", then to whatever was stored.
 */
export function resolveLanguageFlag(
  flag: string | undefined,
  code: string,
): string {
  const fromCode = languageFlag(code);
  if (fromCode) return fromCode;
  const trimmed = (flag || "").trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return countryFlag(trimmed);
  return trimmed;
}

/** Uppercase region of a code ("en-us" → "US"), or "" when it has none. */
export function languageRegion(code: string): string {
  const normalized = normalizeLanguageCode(code);
  if (!normalized.includes("-")) return "";
  return normalized.slice(normalized.indexOf("-") + 1).toUpperCase();
}

/** Country name behind a regional code, e.g. "en-us" → "United States". */
export function languageRegionName(code: string): string {
  const region = languageRegion(code);
  if (!region) return "";
  return COUNTRY_NAMES[region] ?? region;
}

export type LanguageCatalogEntry = {
  /** BCP-47 form, e.g. "en-US" — the plugin stores it lowercased. */
  code: string;
  /** Plain language name; this is what the front-end switcher displays. */
  label: string;
  /** Country name, empty for a bare language. Disambiguates the picker only. */
  region: string;
  locale: string;
  flag: string;
};

/**
 * Every language on offer: each one bare, then once per regional variant.
 * Mirrors `Language_Detector::known()` so the two pickers agree.
 *
 * DE, FR, NL, EN (and their regional variants) are listed first — the markets
 * Repraesent sites care about most — then the rest of the catalog.
 */
const LANGUAGE_CATALOG_UNSORTED: LanguageCatalogEntry[] = Object.keys(
  LANGUAGE_NAMES,
).flatMap((code) => {
  const bare: LanguageCatalogEntry = {
    code,
    label: LANGUAGE_NAMES[code],
    region: "",
    locale: LANGUAGE_LOCALES[code] ?? code,
    flag: languageFlag(code),
  };

  const regional = (LANGUAGE_REGIONS[code] ?? []).map((country) => {
    // Store the same lowercase form the plugin persists ("de-de"), so selects
    // and exclude-sets compare equal without a second normalize pass.
    const regionalCode = normalizeLanguageCode(`${code}-${country}`);
    return {
      code: regionalCode,
      label: LANGUAGE_NAMES[code],
      region: COUNTRY_NAMES[country] ?? country,
      locale: REGION_LOCALES[regionalCode] ?? `${code}_${country}`,
      flag: countryFlag(country),
    };
  });

  return [bare, ...regional];
});

/** Site-priority languages — shown first in pickers and language lists. */
const PRIORITY_LANGUAGE_BASES = ["de", "fr", "nl", "en"] as const;

function languagePriorityRank(code: string): number {
  const idx = PRIORITY_LANGUAGE_BASES.indexOf(
    baseLanguage(code) as (typeof PRIORITY_LANGUAGE_BASES)[number],
  );
  return idx === -1 ? PRIORITY_LANGUAGE_BASES.length : idx;
}

/** Stable sort: DE → FR → NL → EN first (bare before regional), then A–Z. */
export function sortLanguagesByPriority<T extends { code: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const rankA = languagePriorityRank(a.code);
    const rankB = languagePriorityRank(b.code);
    if (rankA !== rankB) return rankA - rankB;

    const regionalA = a.code.includes("-") ? 1 : 0;
    const regionalB = b.code.includes("-") ? 1 : 0;
    if (regionalA !== regionalB) return regionalA - regionalB;

    return normalizeLanguageCode(a.code).localeCompare(
      normalizeLanguageCode(b.code),
    );
  });
}

export const LANGUAGE_CATALOG: LanguageCatalogEntry[] = sortLanguagesByPriority(
  LANGUAGE_CATALOG_UNSORTED,
);

/* ── Stats summary (mirrors plugin summarise()) ──────────────────────── */

export type TranslateStatsSummary = {
  languageCount: number;
  translatedPercent: number;
  needsUpdating: number;
  untranslated: number;
};

export function summariseStats(settings: ReTranslateSettings): TranslateStatsSummary {
  const langs = Object.values(settings.stats.languages);
  const languageCount = settings.languages.length;

  if (langs.length === 0) {
    return { languageCount, translatedPercent: 0, needsUpdating: 0, untranslated: 0 };
  }

  let totalStrings = 0;
  let totalTranslated = 0;
  let totalStale = 0;

  for (const lang of langs) {
    totalStrings += lang.total;
    totalTranslated += lang.translated;
    totalStale += lang.stale;
  }

  const translatedPercent =
    totalStrings > 0 ? Math.round((totalTranslated / totalStrings) * 100) : 0;
  const untranslated = totalStrings - totalTranslated;

  return {
    languageCount,
    translatedPercent,
    needsUpdating: totalStale,
    untranslated,
  };
}
