/**
 * Base URL for the public booking page (e.g. https://app.example.com).
 * Set VITE_PUBLIC_BOOKING_BASE_URL in .env. Falls back to current origin in browser.
 */
export function getPublicBookingBaseUrl(): string {
  const env = import.meta.env.VITE_PUBLIC_BOOKING_BASE_URL;
  if (env && typeof env === "string") return env.replace(/\/?$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Build full public booking URL for a config: {baseUrl}/book/{configId} */
export function buildPublicBookingUrl(configId: string): string {
  const base = getPublicBookingBaseUrl();
  return `${base}/book/${configId}`;
}
