/**
 * Websites are saved as typed ("example.com", "https://example.com/shop").
 * Links need a scheme; labels read better without one.
 */
export function websiteHref(url: string): string {
  const trimmed = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function websiteLabel(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

/** Same rule as the server: something with a dot and no spaces. */
export function isWebsite(url: string): boolean {
  return /^\S+\.\S+$/.test(url.trim());
}
