/**
 * The visitor language a site can pin with a cookie.
 *
 * A multilingual host site usually already knows which language its visitor is
 * reading in, and `navigator.language` does not: that is only how the device
 * was configured, so someone reading a German site on an English laptop gets
 * offered English. Setting `repraesent_lang` lets the site say which it is.
 *
 * The embed and inline form snippets read the same cookie from the host page —
 * see `langCookie` in `form-render.service.ts`, which this mirrors. Keep the
 * two in step.
 */
export const LANG_COOKIE = "repraesent_lang";

/**
 * The primary subtag of `repraesent_lang`, lowercased, or `""` for no opinion.
 *
 * "de-DE", "de_DE" and "DE" all read as "de", matching how the
 * `navigator.language` fallback is normalised. Returns "" rather than throwing
 * on the server, where there is no `document` — callers run it in an effect.
 */
export function readLangCookie(): string {
  if (typeof document === "undefined") return "";

  let raw: string;
  try {
    raw = document.cookie || "";
  } catch {
    // Some embedded browsers throw on cookie access rather than returning "".
    return "";
  }

  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== LANG_COOKIE) continue;

    let value = part.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // A malformed percent-escape is not worth failing the whole read over.
    }
    return value.split(/[-_]/)[0].toLowerCase();
  }

  return "";
}
