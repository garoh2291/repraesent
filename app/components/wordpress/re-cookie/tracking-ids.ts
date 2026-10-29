/**
 * Tracking-ID shapes the re:cookie plugin accepts, mirrored on this side so a
 * bad value is caught while it is still editable.
 *
 * The plugin's sanitizer (SiteSettingsPage::sanitize_tracked_id) validates each
 * ID and, on a mismatch, KEEPS THE PREVIOUSLY STORED VALUE rather than saving
 * what was posted. Without a check here the save appears to succeed while
 * WordPress quietly discards it — the most common way an AW- tag ends up
 * "configured" on a site and never loading.
 */

export type TrackingIdProvider = "gtm" | "google_ads" | "ga4" | "meta";

const PATTERNS: Record<TrackingIdProvider, RegExp | null> = {
  gtm: /^GTM-[A-Z0-9]+$/i,
  google_ads: /^AW-\d+$/i,
  ga4: /^G-\w+$/,
  // The plugin stores the Meta pixel ID with sanitize_text_field and no shape
  // check, so neither does this.
  meta: null,
};

/** The id of each provider's input on the Tracking screen. */
export const ID_INPUT: Record<TrackingIdProvider, string> = {
  gtm: "re-cookie-gtm-container-id",
  google_ads: "re-cookie-google-ads-conversion-id",
  ga4: "re-cookie-ga4-measurement-id",
  meta: "re-cookie-meta-pixel-id",
};

/** Where each provider's ID lives inside `settings.integrations`. */
export const ID_FIELD: Record<TrackingIdProvider, string> = {
  gtm: "container_id",
  google_ads: "conversion_id",
  ga4: "measurement_id",
  meta: "pixel_id",
};

export const PROVIDER_LABEL: Record<TrackingIdProvider, string> = {
  gtm: "Google Tag Manager",
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  meta: "Meta Pixel",
};

/** Why an ID won't be stored; the screen words each one in the open language. */
export type TrackingIdProblem = "ads_label" | "ads" | "gtm" | "ga4";

/**
 * Null when `value` is empty (an empty ID is always allowed — it just means the
 * integration is unconfigured) or well-formed; otherwise what is wrong with it.
 */
export function validateTrackingId(
  provider: TrackingIdProvider,
  value: string,
): TrackingIdProblem | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const pattern = PATTERNS[provider];
  if (!pattern || pattern.test(trimmed)) return null;

  switch (provider) {
    case "google_ads":
      // AW-1234567890/AbC-D_efGh is what a conversion-action snippet gives you;
      // only the part before the slash belongs in this field.
      return trimmed.includes("/") ? "ads_label" : "ads";
    case "gtm":
      return "gtm";
    case "ga4":
      return "ga4";
    default:
      return null;
  }
}

/**
 * Providers whose ID WordPress would reject. Saving them anyway loses what
 * was typed (the plugin keeps the old value), so the save waits for a fix.
 */
export function invalidTrackingIds(settings: unknown): TrackingIdProvider[] {
  const providers: TrackingIdProvider[] = ["gtm", "google_ads", "ga4", "meta"];
  return providers.filter((provider) => {
    const value = readId(settings, provider);
    return value !== undefined && validateTrackingId(provider, value) !== null;
  });
}

type IntegrationsShape = Record<string, unknown>;

function readId(
  settings: unknown,
  provider: TrackingIdProvider,
): string | undefined {
  const integrations = (settings as { integrations?: IntegrationsShape })
    ?.integrations;
  const entry = integrations?.[provider] as
    | Record<string, unknown>
    | undefined;
  const value = entry?.[ID_FIELD[provider]];
  return typeof value === "string" ? value : undefined;
}

/**
 * IDs WordPress did not store as sent — i.e. the plugin's sanitizer rejected
 * them and kept the old value. Compare what a save submitted against what the
 * API reports was applied.
 */
export function describeRejectedIds(
  submitted: unknown,
  applied: unknown,
): string[] {
  const providers: TrackingIdProvider[] = ["gtm", "google_ads", "ga4", "meta"];
  const rejected: string[] = [];

  for (const provider of providers) {
    const sent = readId(submitted, provider);
    const stored = readId(applied, provider);
    if (sent === undefined || stored === undefined || sent === stored) continue;
    rejected.push(
      `${PROVIDER_LABEL[provider]}: "${sent}" was rejected — WordPress kept "${stored}".`,
    );
  }

  return rejected;
}
