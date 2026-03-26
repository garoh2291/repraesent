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

/** API origin (e.g. http://localhost:8001) for static assets like logo */
export function getApiOrigin(): string {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8001/api";
  return apiUrl.replace(/\/api\/?$/, "") || "http://localhost:8001";
}

/** Full URL for appointment logo (path from API e.g. /uploads/appointments/xxx/logo.png) */
export function getLogoFullUrl(path: string | null | undefined): string {
  if (!path) return "";
  const origin = getApiOrigin();
  return path.startsWith("http")
    ? path
    : `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
