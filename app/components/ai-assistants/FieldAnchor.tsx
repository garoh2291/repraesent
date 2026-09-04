import { useEffect, useRef } from "react";
import { fieldAnchorId } from "~/lib/ai-assistants/validate";
import { cn } from "~/lib/utils";

/**
 * Wraps one editable control so a validation issue can point AT it.
 *
 * The id is the config path (`ai-field-actions.0.url`), which is exactly what
 * both `validateDraft` and the API's `issues[].path` speak — so a rule only the
 * server knows still finds its control. The ring is painted from a `data-invalid`
 * attribute set by `revealField`, not from React state: the highlight is a
 * transient "look here", not part of the draft.
 */
export function FieldAnchor({
  path,
  className,
  children,
}: {
  path: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={fieldAnchorId(path)}
      data-field-path={path}
      className={cn(
        "scroll-mt-28 rounded-lg ring-offset-2 ring-offset-background transition-shadow motion-reduce:transition-none",
        "data-[invalid]:ring-2 data-[invalid]:ring-destructive",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Fired before scrolling, so collapsed accordions can open the right item. */
export const REVEAL_EVENT = "ai-assistant:reveal-field";

/**
 * Subscribe to reveal requests — used by the panels whose fields live inside a
 * collapsed accordion (actions, per-locale strings), which have to open before
 * the anchor exists in the DOM.
 */
export function useRevealListener(handler: (path: string) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onReveal = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (typeof path === "string") ref.current(path);
    };
    window.addEventListener(REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_EVENT, onReveal);
  }, []);
}

const HIGHLIGHT_MS = 2000;

/**
 * Scroll a config path into view and ring it briefly.
 *
 * Retries across a few frames because the tab panel (and possibly an accordion
 * item) mounts after the click that asked for it, and falls back to the nearest
 * ancestor path — `actions.0` for `actions.0.url` — when the exact control is
 * still collapsed out of the DOM.
 */
export function revealField(path: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: path }));

  const candidates: string[] = [];
  const parts = path.split(".");
  for (let i = parts.length; i > 0; i--) {
    candidates.push(parts.slice(0, i).join("."));
  }

  let tries = 0;
  const attempt = () => {
    const el = candidates
      .map((p) => document.getElementById(fieldAnchorId(p)))
      .find((node): node is HTMLElement => !!node);
    if (!el) {
      if (tries++ < 20) window.requestAnimationFrame(attempt);
      return;
    }
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
    el.setAttribute("data-invalid", "");
    const clear = () => {
      el.removeAttribute("data-invalid");
      window.clearTimeout(timer);
      el.removeEventListener("input", clear);
      el.removeEventListener("change", clear);
    };
    const timer = window.setTimeout(clear, HIGHLIGHT_MS);
    el.addEventListener("input", clear);
    el.addEventListener("change", clear);
    el.querySelector<HTMLElement>("input, textarea, [role='combobox']")?.focus({
      preventScroll: true,
    });
  };
  window.requestAnimationFrame(attempt);
}
