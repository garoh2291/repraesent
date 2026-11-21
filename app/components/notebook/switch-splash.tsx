import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "./brand-splash";

/**
 * Opening a business through an agency (AGENCY_MODE_PLAN.md): the business's
 * own context has to load first, which can take seconds. The start screen's
 * look covers it — ink, the "re:praesent" wordmark drawing in, "Opening
 * <business>…" and a slow line — so nobody looks at the agency's page while
 * the business is on its way, and nothing seems frozen.
 *
 * Fast switches never see it (it appears only after 150 ms); once it is up it
 * stays at least 600 ms so it doesn't blink. Driven from `setCurrentWorkspace`
 * (use-auth.ts) through `startSwitch` / `endSwitch`.
 */

const SHOW_AFTER_MS = 150;
const MIN_VISIBLE_MS = 600;
const EXIT_MS = 280;

let current: { name: string; token: number } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A business is being opened. Returns a token; only the latest switch may end it. */
export function startSwitch(name: string): number {
  seq += 1;
  current = { name, token: seq };
  emit();
  return seq;
}

/** The switch landed (or failed). An older switch's end is ignored. */
export function endSwitch(token: number): void {
  if (!current || current.token !== token) return;
  current = null;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function SwitchSplash() {
  const { t } = useTranslation();
  const state = useSyncExternalStore(subscribe, () => current, () => null);
  const [phase, setPhase] = useState<"hidden" | "show" | "leaving">("hidden");
  const [name, setName] = useState("");
  const shownAt = useRef(0);

  useEffect(() => {
    if (state) {
      setName(state.name);
      if (phase === "show") return;
      // Only switches that take a moment get the screen.
      const timer = window.setTimeout(() => {
        shownAt.current = performance.now();
        setPhase("show");
      }, phase === "leaving" ? 0 : SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "show") {
      setPhase("hidden");
      return;
    }
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    const leave = window.setTimeout(() => setPhase("leaving"), wait);
    return () => window.clearTimeout(leave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const done = window.setTimeout(() => setPhase("hidden"), EXIT_MS);
    return () => window.clearTimeout(done);
  }, [phase]);

  if (phase === "hidden") return null;
  return (
    <div className="rp-splash rp-switch" data-leaving={phase === "leaving" ? "" : undefined}>
      <div className="rp-switch__stack">
        <BrandMark />
        <p className="rp-switch__caption" role="status" aria-live="polite">
          {t("agency.switching", { business: name })}
        </p>
        <span className="rp-switch__line" aria-hidden />
      </div>
    </div>
  );
}
