import type { CatalogField } from "~/lib/api/workflows";

export interface VariableItem {
  /** Dotted path, no braces. */
  path: string;
  /** What a human calls it. */
  label: string;
  /** Where the value comes from, when that isn't obvious from the label. */
  hint?: string;
}

export interface VariableGroup {
  /** i18n suffix: `workflows.variables.group_<key>`. */
  key: "record" | "person" | "workspace" | "previous";
  items: VariableItem[];
}

/**
 * The five fields a person always has, whichever table they came from.
 *
 * `recipient.*` is normalised across leads and contacts by the shared render
 * context, and it has resolved in workflow emails since they shipped — but no
 * chip has ever offered it, so the only way to discover it was to import a
 * campaign template. Writing `{{recipient.first_name}}` is the difference
 * between a template that survives being pointed at a different trigger and one
 * that does not.
 */
const PERSON_FIELDS: VariableItem[] = [
  { path: "recipient.first_name", label: "First name" },
  { path: "recipient.last_name", label: "Last name" },
  { path: "recipient.full_name", label: "Full name" },
  { path: "recipient.email", label: "Email" },
  { path: "recipient.phone", label: "Phone" },
];

const WORKSPACE_FIELDS: VariableItem[] = [
  { path: "workspace.name", label: "Workspace name" },
];

/**
 * Group the catalogue into something a person can read.
 *
 * The builder used to render one wrapping row of up to forty monospace chips
 * whose label *was* the token — `{{trigger.record.expected_close_date}}` — and
 * the catalogue's human labels were thrown away one component upstream. All
 * this does is stop discarding them and sort the result into four answers to
 * "where does this value come from".
 *
 * `trigger.old.*` deliberately excludes resolved and dynamic fields: the old
 * row is the raw snapshot the DB trigger captured and nothing enriches it, so
 * a derived field is always empty there.
 */
export function buildVariableGroups(
  fields: CatalogField[],
  options: { includePrevious?: boolean } = {},
): VariableGroup[] {
  const record: VariableItem[] = fields.map((f) => ({
    path: `trigger.record.${f.path}`,
    label: f.label,
    hint: f.resolved ? "resolved" : undefined,
  }));

  const previous: VariableItem[] = (options.includePrevious ?? true)
    ? fields
        .filter((f) => !f.dynamic && !f.resolved)
        .map((f) => ({ path: `trigger.old.${f.path}`, label: f.label }))
    : [];

  const groups: VariableGroup[] = [
    { key: "record", items: record },
    { key: "person", items: PERSON_FIELDS },
    { key: "workspace", items: WORKSPACE_FIELDS },
  ];
  if (previous.length > 0) groups.push({ key: "previous", items: previous });

  return groups.filter((g) => g.items.length > 0);
}

/** Case-insensitive match on the label or the path. */
export function filterGroups(
  groups: VariableGroup[],
  query: string,
): VariableGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) || i.path.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
}
