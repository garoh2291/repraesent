import type { FormField } from "./schema";

/**
 * What the Build canvas currently has selected.
 *
 * Three regions are selectable: every field, the form header (title +
 * description) and the submit button. The last two used to be editable only
 * from the Languages tab, which no longer exists — the language strip replaced
 * it, so their copy needs a home on the canvas where you can see it.
 *
 * Builder-only UI state, deliberately NOT in schema.ts: that file mirrors the
 * backend contract and nothing here is ever persisted.
 */
export type BuilderSelection =
  | { kind: "field"; fieldId: string }
  | { kind: "header" }
  | { kind: "submit" };

/** The selected field's id, or null when a non-field region is selected. */
export function selectedFieldId(
  selection: BuilderSelection | null,
): string | null {
  return selection?.kind === "field" ? selection.fieldId : null;
}

export function isSameSelection(
  a: BuilderSelection | null,
  b: BuilderSelection | null,
): boolean {
  if (a == null || b == null) return a === b;
  if (a.kind !== b.kind) return false;
  return selectedFieldId(a) === selectedFieldId(b);
}

/** What the inspector is currently editing. */
export type InspectorTarget =
  | { kind: "field"; field: FormField }
  | { kind: "header"; showFormTitle: boolean }
  | { kind: "submit" };
