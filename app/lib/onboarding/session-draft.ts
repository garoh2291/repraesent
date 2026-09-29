/**
 * Onboarding keeps a few things in the tab's sessionStorage before the server
 * has them: the business name typed on step 1 (`onb:name`, no business exists
 * yet) and whether the intro was seen (`onb:intro-seen`).
 *
 * sessionStorage belongs to the browser tab, not to an account. Signing out
 * and creating a second account in the same tab used to hand the second
 * account the first one's business name and skip its intro, so the wizard
 * opened on step 2 with someone else's data. Everything under `onb:` is
 * therefore wiped whenever the signed-in person can change: on sign-out and on
 * every fresh sign-in.
 */

const PREFIX = "onb:";

export function clearOnboardingSession(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) window.sessionStorage.removeItem(k);
  } catch {
    /* storage blocked: nothing stored either */
  }
}
