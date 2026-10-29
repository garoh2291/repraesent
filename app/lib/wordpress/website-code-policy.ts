import type { CspPolicy, WebsiteCodePolicy } from "~/lib/api/wordpress-hub";
import type { ReCookieSettings } from "~/lib/wordpress/plugin-settings-types";

/**
 * Does the website's Content-Security-Policy let this pasted code load?
 *
 * Our web servers send a fleet-wide allow-list; a browser blocks code from any
 * address not on it and says so only in its developer console. So the Code tab
 * reads the addresses out of each snippet and checks them here, the same way a
 * browser would, to tell the customer before they wonder why nothing happens.
 */

type Directive = "script-src" | "frame-src" | "img-src" | "style-src";

export type CodeUse = { host: string; directive: Directive };

export type CodeCheck = {
  /** Addresses the policy blocks, each once. */
  blockedHosts: string[];
  /** Inline code the policy blocks (no 'unsafe-inline'). */
  inlineBlocked: boolean;
};

/** Addresses code names without loading anything from them (XML namespaces, schema). */
const NOT_LOADED = new Set(["www.w3.org", "w3.org", "schema.org", "ogp.me"]);

const URL_IN_TEXT = /(?:https?:)?\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?=[/"'`?#\s)]|$)/gi;

/** Where a snippet loads things from, and as what. */
export function codeUses(html: string): { uses: CodeUse[]; hasInline: boolean } {
  const uses: CodeUse[] = [];
  let hasInline = false;
  if (typeof document === "undefined" || !html.trim()) return { uses, hasInline };
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const root = tpl.content;
  const add = (raw: string | null, directive: Directive) => {
    const host = hostOf(raw);
    if (host) uses.push({ host, directive });
  };
  root.querySelectorAll("script").forEach((el) => {
    if (el.getAttribute("src")) {
      add(el.getAttribute("src"), "script-src");
      return;
    }
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (type && !/javascript|module/.test(type)) return; // JSON, templates
    const code = el.textContent ?? "";
    if (!code.trim()) return;
    hasInline = true;
    // A loader script names the address it pulls the real code from.
    for (const m of code.matchAll(URL_IN_TEXT)) uses.push({ host: m[1].toLowerCase(), directive: "script-src" });
  });
  root.querySelectorAll("iframe[src]").forEach((el) => add(el.getAttribute("src"), "frame-src"));
  root.querySelectorAll("img[src]").forEach((el) => add(el.getAttribute("src"), "img-src"));
  root.querySelectorAll('link[rel~="stylesheet"][href]').forEach((el) => add(el.getAttribute("href"), "style-src"));
  // Bare code without <script> tags runs as one inline script.
  if (!root.querySelector("*") && html.trim()) {
    hasInline = true;
    for (const m of html.matchAll(URL_IN_TEXT)) uses.push({ host: m[1].toLowerCase(), directive: "script-src" });
  }
  return { uses, hasInline };
}

/** What in this snippet the site's policy would block. Nothing when there is no policy. */
export function checkCode(html: string, policy: WebsiteCodePolicy | undefined): CodeCheck {
  const none: CodeCheck = { blockedHosts: [], inlineBlocked: false };
  if (!policy?.enforced || policy.policies.length === 0) return none;
  const { uses, hasInline } = codeUses(html);
  const siteHost = policy.site_host;
  const blocked = new Set<string>();
  for (const use of uses) {
    if ((siteHost && use.host === siteHost) || NOT_LOADED.has(use.host)) continue;
    if (!policy.policies.every((p) => allows(p, use.directive, use.host, siteHost))) {
      blocked.add(use.host);
    }
  }
  const inlineBlocked =
    hasInline && !policy.policies.every((p) => allowsInline(sources(p, "script-src")));
  return { blockedHosts: [...blocked].sort(), inlineBlocked };
}

/** The sources a directive falls back to, or null when the policy doesn't restrict it. */
function sources(policy: CspPolicy, directive: Directive): string[] | null {
  return policy[directive] ?? policy["default-src"] ?? null;
}

function allows(policy: CspPolicy, directive: Directive, host: string, siteHost: string | null): boolean {
  const list = sources(policy, directive);
  if (!list) return true;
  return list.some((src) => sourceMatches(src, host, siteHost));
}

function allowsInline(list: string[] | null): boolean {
  if (!list) return true;
  // With a nonce or hash, browsers ignore 'unsafe-inline'; pasted code has neither.
  if (list.some((s) => s.startsWith("'nonce-") || /^'sha(256|384|512)-/.test(s))) return false;
  return list.includes("'unsafe-inline'");
}

function sourceMatches(src: string, host: string, siteHost: string | null): boolean {
  if (src === "*" || src === "https:" || src === "http:") return true;
  if (src === "'self'") return siteHost !== null && host === siteHost;
  if (src.startsWith("'")) return false; // 'none', 'unsafe-*', nonces, hashes
  const bare = src.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[:/].*$/, "");
  if (bare.startsWith("*.")) {
    const base = bare.slice(2);
    return host.endsWith(`.${base}`);
  }
  return bare === host;
}

function hostOf(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^(?:https?:)?\/\//i.test(s)) return null; // relative: the site itself
  try {
    return new URL(s.startsWith("//") ? `https:${s}` : s).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * What pasted code repeats, if anything — the same rule as re:cookie's
 * GenericScripts::duplicate_of(), which leaves such copies out: Plausible
 * while Repraesent's visitor statistics load it, or a tag switched on under
 * Tracking (same ID). Loading either twice counts every visit twice.
 */
export function duplicateOf(
  script: string,
  integrations: ReCookieSettings["integrations"],
  plausibleOn: boolean,
): string | null {
  const code = script.toLowerCase();
  if (plausibleOn && code.includes("plausible")) return "Plausible";
  const tags: [boolean, string, string][] = [
    [integrations.gtm.enabled, integrations.gtm.container_id, "Google Tag Manager"],
    [integrations.ga4.enabled, integrations.ga4.measurement_id, "Google Analytics 4"],
    [integrations.google_ads.enabled, integrations.google_ads.conversion_id, "Google Ads"],
    // A pixel ID is only digits: count it only inside Meta's own snippet.
    [integrations.meta.enabled && code.includes("fbq"), integrations.meta.pixel_id, "Meta Pixel"],
  ];
  for (const [on, id, name] of tags) {
    const wanted = id.trim().toLowerCase();
    if (on && wanted && code.includes(wanted)) return name;
  }
  return null;
}
