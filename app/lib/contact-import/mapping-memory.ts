import type { ImportTarget, RowKind } from "~/lib/api/contact-imports";

/**
 * Remembers how the owner matched a file layout, so the same export brought
 * in again next month is matched the same way. Per browser only: a
 * convenience, never the record of anything. Every access is guarded because
 * storage can be blocked or full.
 */

const KEY = "contact-import:layouts:v1";
const MAX_LAYOUTS = 20;

export interface RememberedLayout {
  choices: Array<{ target: ImportTarget; name: string }>;
  rowKind: RowKind;
}

/** Two files have the same layout when their headers match in order. */
export function layoutSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).join("\u001f");
}

function readAll(): Record<string, RememberedLayout & { at: number }> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function recallLayout(headers: string[]): RememberedLayout | null {
  const hit = readAll()[layoutSignature(headers)];
  if (!hit || !Array.isArray(hit.choices) || hit.choices.length !== headers.length) return null;
  return { choices: hit.choices, rowKind: hit.rowKind };
}

export function rememberLayout(headers: string[], layout: RememberedLayout): void {
  try {
    const all = readAll();
    all[layoutSignature(headers)] = { ...layout, at: Date.now() };
    const kept = Object.entries(all)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_LAYOUTS);
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Not being able to remember is fine.
  }
}

export function forgetLayout(headers: string[]): void {
  try {
    const all = readAll();
    delete all[layoutSignature(headers)];
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
