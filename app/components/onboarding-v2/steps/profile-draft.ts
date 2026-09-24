import { useMemo, useState } from "react";
import type { FieldSource, ProfileData } from "~/lib/api/onboarding-v2";
import { fieldErrorsOf } from "~/lib/api/onboarding-v2";

/**
 * A local, editable copy of part of the business profile.
 * `patch()` returns only what the person actually changed (so saving a
 * found value unchanged doesn't count as editing it) and `confirmPaths()`
 * lists found values they saw and kept.
 */
export function useProfileDraft(
  data: ProfileData | undefined,
  sources: Record<string, FieldSource> | undefined,
  paths: string[],
) {
  const original = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const p of paths) {
      const [s, f] = p.split(".");
      o[p] = data?.[s]?.[f] ?? null;
    }
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), paths.join(",")]);
  const [draft, setDraft] = useState<Record<string, unknown>>(original);

  const get = <T,>(path: string): T | undefined => (draft[path] ?? undefined) as T | undefined;
  const set = (path: string, value: unknown) => setDraft((d) => ({ ...d, [path]: value }));

  const patch = (): ProfileData => {
    const out: ProfileData = {};
    for (const p of paths) {
      const before = original[p];
      let after = draft[p];
      if (typeof after === "string") after = after.trim() === "" ? null : after;
      if (Array.isArray(after) && after.length === 0 && (before === null || before === undefined)) continue;
      if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) continue;
      const [s, f] = p.split(".");
      (out[s] ??= {})[f] = after ?? null;
    }
    return out;
  };

  const confirmPaths = (): string[] =>
    paths.filter((p) => {
      const src = sources?.[p];
      return src && !src.confirmed && src.source !== "user" && draft[p] !== null && draft[p] !== undefined;
    });

  return { get, set, patch, confirmPaths, draft, original };
}

/** Server field errors → { path: message } using i18n reasons. */
export function mapFieldErrors(error: unknown, t: (k: string) => string): Record<string, string> {
  const raw = fieldErrorsOf(error);
  const out: Record<string, string> = {};
  for (const [path, reason] of Object.entries(raw)) {
    const key = `onb.fieldErrors.${reason}`;
    const msg = t(key);
    out[path] = msg === key ? t("onb.fieldErrors.invalid") : msg;
  }
  return out;
}

/** Focus the first field with an error (after React paints the messages). */
export function focusFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}
