/**
 * OpenAI Ads measurement on public pages (hosted forms, booking).
 *
 * Two independent halves:
 * - `injectOpenaiPixel` loads OpenAI's own SDK, which handles browser events
 *   and stores the `oppref` click id in a first-party `__oppref` cookie.
 * - `readOppref` reads the click id for the submit payload, URL first (the
 *   visitor just clicked the ad) then cookie (they navigated within the site
 *   before submitting). The server needs it explicitly because the
 *   server-side Conversions API send cannot see the visitor's cookies.
 */

const SDK_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

declare global {
  interface Window {
    oaiq?: (...args: unknown[]) => void;
  }
}

export function injectOpenaiPixel(pixelId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.oaiq) return; // already installed — init is one-shot

  const q = function (...args: unknown[]) {
    (q as unknown as { q: unknown[] }).q.push(args);
  };
  (q as unknown as { q: unknown[] }).q = [];
  window.oaiq = q as unknown as Window["oaiq"];

  const script = document.createElement("script");
  script.async = true;
  script.src = SDK_URL;
  document.head.appendChild(script);

  window.oaiq!("init", { pixelId });
}

export function readOppref(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get("oppref");
    if (fromUrl) return fromUrl.slice(0, 512);
  } catch {
    // malformed query string — fall through to the cookie
  }

  try {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith("__oppref="));
    if (match) {
      const value = decodeURIComponent(match.slice("__oppref=".length));
      return value ? value.slice(0, 512) : null;
    }
  } catch {
    // cookie access blocked — attribution simply degrades
  }
  return null;
}
