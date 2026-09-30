import { apiClient } from "./axios-instance";

/**
 * Team → "What the inquiry message shows" (INQUIRY_ALERTS.md). One list per
 * business; who gets the message is the per-person switch on the team page.
 */

export const CORE_ALERT_FIELDS = [
  "name",
  "phone",
  "email",
  "source",
  "message",
  "stage",
  "form",
] as const;
export type CoreAlertField = (typeof CORE_ALERT_FIELDS)[number];

export type AlertFieldRef =
  | { key: CoreAlertField; kind: "core" }
  | { key: string; kind: "meta" }
  /** "All other details": every detail not picked on its own, even new ones. */
  | { key: "all"; kind: "all" };

export const ALL_DETAILS_REF: AlertFieldRef = { key: "all", kind: "all" };
/** Same cap as the server (alert-fields.ts MAX_ALL_ROWS). */
export const MAX_ALL_ROWS = 15;

export interface AlertFieldsConfig {
  /** false = never changed; `fields` is then the standard (name, phone, source). */
  customised: boolean;
  fields: AlertFieldRef[];
  can_edit: boolean;
}

export interface AvailableMetaField {
  key: string;
  label: string;
  example: string | null;
  count: number;
}

export interface AlertRow {
  key: string;
  kind: "core" | "meta" | "more";
  label: string;
  value: string;
}

export interface AvailableAlertFields {
  core: CoreAlertField[];
  meta: AvailableMetaField[];
  /** How many recent inquiries were looked at. */
  scanned: number;
  /**
   * Every field of the newest inquiry, for the live preview: the core fields
   * plus every showable detail it carries (kind "meta", alphabetical).
   */
  sample: { id: string; created_at: string; rows: AlertRow[] } | null;
}

export const DEFAULT_ALERT_FIELDS: AlertFieldRef[] = [
  { key: "name", kind: "core" },
  { key: "phone", kind: "core" },
  { key: "source", kind: "core" },
];

export async function getAlertFields(): Promise<AlertFieldsConfig> {
  const { data } = await apiClient.get<AlertFieldsConfig>("/inquiry-alerts/fields");
  return data;
}

export async function saveAlertFields(fields: AlertFieldRef[]): Promise<AlertFieldsConfig> {
  const { data } = await apiClient.put<AlertFieldsConfig>("/inquiry-alerts/fields", { fields });
  return data;
}

export async function resetAlertFields(): Promise<AlertFieldsConfig> {
  const { data } = await apiClient.delete<AlertFieldsConfig>("/inquiry-alerts/fields");
  return data;
}

export async function getAvailableAlertFields(locale: string): Promise<AvailableAlertFields> {
  const { data } = await apiClient.get<AvailableAlertFields>("/inquiry-alerts/available", {
    params: { locale },
  });
  return data;
}

export async function sendAlertTest(): Promise<{ sent: boolean; to?: string; used_inquiry?: boolean }> {
  const { data } = await apiClient.post("/inquiry-alerts/test");
  return data;
}

export const alertFieldId = (f: AlertFieldRef) => `${f.kind}:${f.key}`;
