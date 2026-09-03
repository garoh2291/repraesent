import type { FormField, FormSection } from "./schema";

/**
 * What the Build canvas currently has selected.
 *
 * Selectable regions: every field, the form header (title + description), the
 * submit button and a step (its title and description, multi-step forms
 * only). The product field is an ordinary field. The header and submit used to be
 * editable only from the Languages tab, which no longer exists — the language
 * strip replaced it, so their copy needs a home on the canvas where you can
 * see it.
 *
 * Builder-only UI state, deliberately NOT in schema.ts: that file mirrors the
 * backend contract and nothing here is ever persisted.
 */
export type BuilderSelection =
  | { kind: "field"; fieldId: string }
  | { kind: "header" }
  | { kind: "submit" }
  | { kind: "step"; stepId: string };

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
  if (a.kind === "step" && b.kind === "step") return a.stepId === b.stepId;
  return selectedFieldId(a) === selectedFieldId(b);
}

/** What the inspector is currently editing. */
export type InspectorTarget =
  | { kind: "field"; field: FormField; steps?: FormSection[]; stepId?: string }
  | { kind: "header"; showFormTitle: boolean }
  | { kind: "submit" }
  | { kind: "step"; section: FormSection; index: number; total: number };
