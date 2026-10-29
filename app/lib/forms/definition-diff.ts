import {
  contentKey,
  type FormDefinition,
  type FormField,
  type FormLocale,
} from "~/lib/forms/schema";

/**
 * What the working draft has that the live form does not, in pieces the
 * status popover can name in plain words. Both sides must already have been
 * through normalizeDefinition(), or every default the server fills in reads
 * as a change.
 */
export type DefinitionChange =
  | { kind: "fieldAdded"; fieldId: string; label: string }
  | { kind: "fieldRemoved"; fieldId: string; label: string }
  | { kind: "fieldChanged"; fieldId: string; label: string }
  | { kind: "order" }
  | { kind: "text"; locale: FormLocale }
  | { kind: "look" }
  | { kind: "afterSending" }
  | { kind: "products" }
  | { kind: "answersGo" }
  | { kind: "other" };

/** Key-sorted JSON, so two equal objects with keys in another order compare equal. */
function stable(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

function fieldsById(definition: FormDefinition): Map<string, FormField> {
  const map = new Map<string, FormField>();
  for (const section of definition.sections) {
    for (const field of section.fields) map.set(field.id, field);
  }
  return map;
}

function fieldLabel(
  definition: FormDefinition,
  field: FormField,
  locale: FormLocale,
): string {
  const content = definition.content[locale] ?? {};
  const label = content[contentKey.fieldLabel(field.id)]?.trim();
  return label || field.key;
}

/**
 * Field ids that a text change already explains, so "question X changed" is
 * not listed next to "text changed" for the same edit.
 */
function textOnlyFieldIds(key: string): string | null {
  const match = /^field\.([^.]+)\./.exec(key);
  return match ? match[1] : null;
}

export function diffDefinitions(
  draft: FormDefinition,
  live: FormDefinition,
  locale: FormLocale,
): DefinitionChange[] {
  const changes: DefinitionChange[] = [];
  const draftFields = fieldsById(draft);
  const liveFields = fieldsById(live);

  for (const [id, field] of draftFields) {
    const before = liveFields.get(id);
    if (!before) {
      changes.push({ kind: "fieldAdded", fieldId: id, label: fieldLabel(draft, field, locale) });
    } else if (stable(field) !== stable(before)) {
      changes.push({ kind: "fieldChanged", fieldId: id, label: fieldLabel(draft, field, locale) });
    }
  }
  for (const [id, field] of liveFields) {
    if (!draftFields.has(id)) {
      changes.push({ kind: "fieldRemoved", fieldId: id, label: fieldLabel(live, field, locale) });
    }
  }

  // Same questions, different arrangement: moved, or split into other steps.
  const shape = (d: FormDefinition) =>
    d.sections.map((s) => [s.id, s.fields.map((f) => f.id)]);
  const addedOrRemoved = changes.some(
    (c) => c.kind === "fieldAdded" || c.kind === "fieldRemoved",
  );
  if (!addedOrRemoved && stable(shape(draft)) !== stable(shape(live))) {
    changes.push({ kind: "order" });
  }

  // Text per language. Labels of questions just added or removed are part of
  // that change already, so they do not count twice.
  const explained = new Set(
    changes
      .filter((c) => c.kind === "fieldAdded" || c.kind === "fieldRemoved")
      .map((c) => (c as { fieldId: string }).fieldId),
  );
  const locales = new Set([
    ...Object.keys(draft.content),
    ...Object.keys(live.content),
  ]) as Set<FormLocale>;
  for (const l of locales) {
    const a = draft.content[l] ?? {};
    const b = live.content[l] ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const id = textOnlyFieldIds(key);
      if (id && explained.has(id)) continue;
      if ((a[key] ?? "") !== (b[key] ?? "")) {
        changes.push({ kind: "text", locale: l });
        break;
      }
    }
  }

  if (
    stable(draft.theme) !== stable(live.theme) ||
    stable(draft.layout) !== stable(live.layout) ||
    draft.showLanguageSwitcher !== live.showLanguageSwitcher
  ) {
    changes.push({ kind: "look" });
  }
  if (stable(draft.success) !== stable(live.success)) {
    changes.push({ kind: "afterSending" });
  }
  if (stable(draft.commerce) !== stable(live.commerce)) {
    changes.push({ kind: "products" });
  }
  if ((draft.crm?.save !== false) !== (live.crm?.save !== false)) {
    changes.push({ kind: "answersGo" });
  }
  const { lastPayload: _a, ...draftIntake } = draft.intake ?? {};
  const { lastPayload: _b, ...liveIntake } = live.intake ?? {};
  if (
    stable(draft.utm) !== stable(live.utm) ||
    stable(draft.antiSpam) !== stable(live.antiSpam) ||
    stable(draftIntake) !== stable(liveIntake)
  ) {
    changes.push({ kind: "other" });
  }

  return changes;
}
