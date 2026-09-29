/**
 * Small pure helpers for the onboarding wizard. The server re-validates
 * everything; these exist so the customer sees the result while typing.
 */

export type WebsiteCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: "empty" | "invalid" | "protocol" | "ip" | "local" | "no_tld" };

/** Mirrors nestjs-monolith onboarding-v2/website.util.ts (shape only). */
export function checkWebsite(raw: string): WebsiteCheck {
  let input = raw.trim().replace(/^["'<]+|["'>]+$/g, "").trim();
  if (!input) return { ok: false, reason: "empty" };
  if (/\s/.test(input)) return { ok: false, reason: "invalid" };
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(input);
  if (scheme) {
    if (!/^https?$/i.test(scheme[1])) return { ok: false, reason: "protocol" };
  } else if (/^(mailto|javascript|ftp|tel):/i.test(input)) {
    return { ok: false, reason: "protocol" };
  } else {
    input = `https://${input.replace(/^\/+/, "")}`;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return { ok: false, reason: "ip" };
  if (host === "localhost" || /\.(local|localhost|internal|lan|test)$/.test(host)) return { ok: false, reason: "local" };
  const labels = host.split(".");
  if (labels.length < 2 || labels.some((l) => !l) || !/^(xn--[a-z0-9-]+|[a-z]{2,63})$/.test(labels[labels.length - 1])) {
    return { ok: false, reason: "no_tld" };
  }
  const path = url.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}${path}`, host };
}

/** Pretty host for copy: `www.kuechen.de` → `kuechen.de`. */
export function displayHost(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── email typos ──────────────────────────────────────────────────────────────

const COMMON_DOMAINS = [
  "gmail.com", "googlemail.com", "gmx.de", "gmx.net", "gmx.at", "gmx.ch", "web.de", "t-online.de",
  "outlook.com", "outlook.de", "hotmail.com", "hotmail.de", "live.com", "yahoo.com", "yahoo.de",
  "icloud.com", "me.com", "aol.com", "freenet.de", "posteo.de", "mail.de", "bluewin.ch",
  "orange.fr", "free.fr", "wanadoo.fr", "sfr.fr", "laposte.net", "ziggo.nl", "kpnmail.nl",
  "hotmail.nl", "telenet.be", "skynet.be", "sympatico.ca", "videotron.ca", "shaw.ca", "rogers.com",
];

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** "anna@gmial.com" → "anna@gmail.com"; null when it looks fine. */
export function suggestEmail(email: string): string | null {
  const m = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec(email.trim().toLowerCase());
  if (!m) return null;
  const [, local, domain] = m;
  if (COMMON_DOMAINS.includes(domain)) return null;
  let best: { d: string; dist: number } | null = null;
  for (const d of COMMON_DOMAINS) {
    const dist = distance(domain, d);
    if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best ? `${local}@${best.d}` : null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── money ────────────────────────────────────────────────────────────────────

const INTL: Record<string, string> = { en: "en-GB", de: "de-DE", fr: "fr-CA", nl: "nl-NL" };

/** Minor units → "€300" / "300 €" / "300,00 $ CA" in the UI language. */
export function formatMoney(cents: number, currency: string, lang: string, decimals: "auto" | 0 | 2 = "auto"): string {
  const whole = cents % 100 === 0;
  const digits = decimals === "auto" ? (whole ? 0 : 2) : decimals;
  return new Intl.NumberFormat(INTL[lang] ?? "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/** Browser timezone, or null. */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Nested get: get(data, "contact.contact_person") */
export function getPath(data: Record<string, Record<string, unknown>> | undefined, path: string): unknown {
  const [section, field] = path.split(".");
  return data?.[section]?.[field];
}

export const PROFILE_ENUMS = {
  legalForm: [
    "gmbh", "ug", "ag", "ek", "gbr", "kg", "ohg", "gmbh_co_kg", "einzelunternehmen",
    "sarl", "sas", "sa", "ei", "bv", "nv", "vof", "eenmanszaak",
    "inc", "ltd", "llc", "corp", "sole_proprietor", "partnership", "other",
  ],
  presenceKind: ["physical", "online", "service_area", "hybrid"],
  priceSegment: ["budget", "mid", "premium", "luxury"],
  customerType: ["b2c", "b2b", "both"],
  teamSize: ["1", "2-5", "6-10", "11-25", "26-50", "50+"],
  emailProvider: ["google_workspace", "microsoft_365", "other", "none"],
  primaryGoals: ["more_enquiries", "more_appointments", "google_presence", "reviews", "sell_online", "save_time", "brand_awareness"],
  leadChannels: ["walk_in", "google", "website", "social", "referrals", "ads", "trade_fairs", "partners", "other"],
  monthlyInquiries: ["0-10", "11-30", "31-100", "100+", "unknown"],
  websitePlan: ["keep", "refresh", "rebuild"],
  yesMaybeNo: ["yes", "maybe", "no"],
  aiVisibility: ["yes", "more_info", "no"],
  // Keep in lockstep with nestjs-monolith …/profile/profile.schema.ts ENUMS.
  registrar: [
    "ionos", "strato", "godaddy", "all_inkl", "hetzner", "namecheap", "cloudflare", "ovh",
    "one_com", "transip", "netcup", "host_europe", "squarespace", "wix", "agency_registrar", "other", "unknown",
  ],
  domainTransfer: ["yes", "more_info", "no", "unknown"],
  loginAccess: ["login_me", "login_agency", "login_nobody", "unknown"],
  siteCaretaker: ["care_me", "care_agency", "care_nobody", "unknown"],
  hostingContract: ["contract_under_3m", "contract_3_12m", "contract_over_12m", "contract_none", "unknown"],
  adsRunning: ["ads_google", "ads_meta", "ads_both", "ads_other", "ads_none", "unknown"],
  adsBudget: ["budget_under_500", "budget_500_1500", "budget_1500_5000", "budget_over_5000", "unknown"],
  goLive: ["live_asap", "live_month", "live_quarter", "live_looking", "unknown"],
  heardFrom: ["heard_google", "heard_recommendation", "heard_brand", "heard_trade_fair", "heard_social", "heard_ads", "heard_other", "unknown"],
  enquiryHandler: ["handler_owner", "handler_team", "handler_whoever", "handler_nobody", "unknown"],
  replyTime: ["reply_hour", "reply_day", "reply_days", "unknown"],
} as const;

/** Legal forms that make sense per country (the rest stay reachable under "other"). */
export function legalFormsFor(country: string | null | undefined): readonly string[] {
  switch ((country ?? "").toUpperCase()) {
    case "DE":
    case "AT":
      return ["gmbh", "gmbh_co_kg", "ug", "ag", "ek", "einzelunternehmen", "gbr", "kg", "ohg", "other"];
    case "CH":
      return ["gmbh", "ag", "einzelunternehmen", "kg", "other"];
    case "FR":
    case "BE":
    case "LU":
      return ["sarl", "sas", "sa", "ei", "bv", "nv", "other"];
    case "NL":
      return ["bv", "nv", "vof", "eenmanszaak", "other"];
    case "CA":
    case "US":
    case "GB":
      return ["inc", "ltd", "llc", "corp", "sole_proprietor", "partnership", "other"];
    default:
      return PROFILE_ENUMS.legalForm;
  }
}
