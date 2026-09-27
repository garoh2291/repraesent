/**
 * "Hide for 14 days" / "Not now for 7 days", remembered per device in
 * localStorage. Private mode or blocked storage: hidden for this visit only.
 */
export function isSnoozed(key: string): boolean {
  try {
    const until = Number(window.localStorage.getItem(key) ?? 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function snooze(key: string, days: number) {
  try {
    window.localStorage.setItem(key, String(Date.now() + days * 86_400_000));
  } catch {
    /* hidden for this visit only */
  }
}

export const INSTALL_CARD_KEY = "pwa-install-card-until";
export const ALERTS_ASK_KEY = "pwa-alerts-ask-until";
