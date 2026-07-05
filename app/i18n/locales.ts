// Supported UI locales for Repraesent. Mirrors the backend `SUPPORTED_LOCALES`
// (nestjs-monolith/src/common/locale.ts). `de` stays the fallback for historical
// reasons and for server render when no signal is available.
export const SUPPORTED_LOCALES = ["en", "de", "fr", "nl"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "de";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value as string);
}

/**
 * Coerce anything (a full BCP-47 tag like `fr-BE`, or junk) into a supported
 * locale, matching on the primary subtag. Falls back to {@link DEFAULT_LOCALE}.
 */
export function normalizeLocale(value: unknown): SupportedLocale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const primary = value.toLowerCase().split("-")[0];
  return isSupportedLocale(primary) ? primary : DEFAULT_LOCALE;
}

/**
 * Server-side detection of the initial language from request headers, in the
 * same priority order the client uses: the `personal_lang` cookie (an explicit
 * user choice) wins; otherwise the highest-q supported `Accept-Language`; else
 * {@link DEFAULT_LOCALE}. Returns `null` if no supported signal exists.
 */
export function detectLocaleFromHeaders(headers: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): SupportedLocale | null {
  const cookieMatch = (headers.cookie ?? "").match(
    /(?:^|;\s*)personal_lang=([^;]+)/,
  );
  if (cookieMatch) {
    const primary = decodeURIComponent(cookieMatch[1])
      .toLowerCase()
      .split("-")[0];
    if (isSupportedLocale(primary)) return primary;
  }

  const accept = headers.acceptLanguage ?? "";
  const ranked = accept
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const quality = q ? parseFloat(q.slice(2)) : 1;
      return { tag: tag.toLowerCase().split("-")[0], q: isNaN(quality) ? 0 : quality };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (isSupportedLocale(tag)) return tag;
  }
  return null;
}
