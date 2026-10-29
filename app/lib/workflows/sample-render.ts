import type { CatalogField } from "~/lib/api/workflows";
import { buildVariableGroups } from "./variables";

type T = (key: string, opts?: Record<string, unknown>) => string;

/** `{{ trigger.record.customer }}` or `{{ x | default: "y" }}` → the path. */
const TOKEN = /\{\{\s*([\w.]+)\s*(?:\|[^}]*)?\}\}/g;

/** Paths used in a template, in order of first use. */
export function templatePaths(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(TOKEN)) seen.add(match[1]);
  return [...seen];
}

/** Plain name for a path, from the same catalogue the Insert list uses. */
export function variableLabels(fields: CatalogField[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const group of buildVariableGroups(fields)) {
    for (const item of group.items) labels.set(item.path, item.label);
  }
  return labels;
}

/**
 * A believable stand-in for one value, by what the last segment of the path
 * means. Anything unknown shows its plain name in brackets, so the owner sees
 * where it lands without a fake value pretending to be real.
 */
function sampleFor(path: string, labels: Map<string, string>, t: T): string {
  const key = path.split(".").pop() ?? path;
  const sample = (name: string) => t(`workflows.emailPreview.sample_${name}`);
  switch (key) {
    case "customer":
    case "customer_name":
    case "full_name":
    case "name":
    case "contact_name":
      return sample("name");
    case "first_name":
      return sample("firstName");
    case "last_name":
      return sample("lastName");
    case "email":
    case "customer_email":
      return sample("email");
    case "phone":
    case "customer_phone":
      return sample("phone");
    case "start_local":
      return `${sample("date")}, ${sample("time")}`;
    case "date_local":
      return sample("date");
    case "time_local":
      return sample("time");
    case "calendar_name":
      return sample("calendar");
    case "location":
      return sample("location");
    case "company_name":
    case "workspace_name":
      return sample("company");
    case "manage_url":
    case "meeting_url":
    case "unsubscribe_url":
      return "#";
    default:
      return `[${labels.get(path) ?? key.replace(/_/g, " ")}]`;
  }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Fill a template with sample details, for when the workspace has no record of
 * this kind yet. Clearly labelled by the caller as an example — never passed
 * off as what a real person would receive.
 */
export function renderWithSamples(
  template: string,
  fields: CatalogField[],
  t: T,
  options: { escape: boolean },
): string {
  const labels = variableLabels(fields);
  return template.replace(TOKEN, (_, path: string) => {
    const value = sampleFor(path, labels, t);
    return options.escape ? escapeHtml(value) : value;
  });
}
