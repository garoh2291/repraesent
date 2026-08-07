/**
 * UTM / attribution capture for the hosted form page.
 *
 * Same rule as the generated snippet's inlined copy: fresh params in the URL
 * always win and are stored for the session, and a later page view that has
 * lost them falls back to what was captured earlier. Without that fallback,
 * a visitor who lands on /?utm_source=fb, browses, then comes back to the form
 * arrives with no attribution at all.
 */

import { UTM_CAPTURE_KEYS, type FormUtmCapture } from "./schema";

const STORAGE_KEY = "rf_utm";

export function captureUtm(config?: FormUtmCapture): Record<string, string> {
  if (typeof window === "undefined") return {};
  if (config && !config.enabled) return {};

  const keys = config?.keys?.length ? config.keys : [...UTM_CAPTURE_KEYS];

  const found: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of keys) {
      const value = params.get(key);
      if (value) found[key] = value;
    }
  } catch {
    /* malformed query string — fall through to storage */
  }

  let stored: Record<string, string> = {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) ?? {};
  } catch {
    stored = {};
  }

  const merged: Record<string, string> = { ...stored, ...found };

  // page_url answers "which page did they submit from", so it is always the
  // current one. referrer below is first-touch attribution, so a stored value
  // wins.
  if (keys.includes("page_url")) {
    merged.page_url = window.location.href;
  }
  if (keys.includes("referrer") && !merged.referrer && document.referrer) {
    merged.referrer = document.referrer;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* private mode — the in-memory copy still works for this page view */
  }

  return merged;
}
