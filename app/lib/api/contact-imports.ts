import { apiClient } from "./axios-instance";

/**
 * Contact import v2 (CONTACT_IMPORT_PLAN.md): upload → match columns → check →
 * run → undo. The file's rows stay on the server; these calls only carry the
 * import id, the matching and the choices.
 */

export const IMPORT_TARGETS = [
  "first_name",
  "last_name",
  "full_name",
  "company_name",
  "email",
  "email_2",
  "phone",
  "job_title",
  "website",
  "address_line1",
  "address_postal_code",
  "address_city",
  "address_state",
  "address_country",
  "salutation",
  "date_of_birth",
  "locale",
  "custom",
  "skip",
] as const;

export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export interface ColumnMapping {
  column: number;
  target: ImportTarget;
  custom_key?: string;
}

export type RowKind = "person" | "company" | "auto";

export interface ImportOptions {
  row_kind: RowKind;
  existing: "update" | "skip";
}

export interface ImportColumn {
  column: number;
  header: string;
  samples: string[];
  filled: number;
  distinct: number;
  top_values: Array<{ value: string; count: number }>;
}

export interface ImportCounts {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  companies_added: number;
}

export type ImportStatus = "draft" | "checked" | "running" | "done" | "undone";

export interface ContactImport {
  id: string;
  file_name: string;
  source: string;
  status: ImportStatus;
  total_rows: number;
  headers: string[];
  columns: ImportColumn[];
  mapping: ColumnMapping[];
  options: ImportOptions;
  counts: ImportCounts;
  remaining: number;
  created_at: string;
  finished_at: string | null;
  undone_at: string | null;
  cells_available: boolean;
  known_custom_fields: string[];
  /** Turned-on workflows that start when a contact changes (filled once the import is done). */
  workflows?: Array<{ id: string; name: string }>;
}

export interface ContactImportListItem {
  id: string;
  file_name: string;
  status: ImportStatus;
  total_rows: number;
  counts: ImportCounts;
  created_at: string;
  finished_at: string | null;
  undone_at: string | null;
}

export type ImportReasonCode =
  | "no_identity"
  | "bad_email"
  | "company_name_missing"
  | "in_file_double"
  | "already_here"
  | "nothing_new"
  | "left_by_choice"
  | "stopped"
  | "email_taken"
  | "failed";

export interface FieldChange {
  field: string;
  from: string | null;
  to: string;
}

export interface ImportCheck {
  total_rows: number;
  counts: {
    add: number;
    existing: number;
    existing_unchanged: number;
    doubles: number;
    problems: number;
    without_email: number;
  };
  problems: Array<{
    code: ImportReasonCode;
    count: number;
    rows: Array<{ row_index: number; label: string; detail: string | null }>;
  }>;
  doubles: Array<{ row_index: number; of_row: number; label: string }>;
  existing: Array<{
    row_index: number;
    contact_id: string;
    contact_name: string;
    label: string;
    changes: FieldChange[];
  }>;
  existing_listed: number;
  workflows: Array<{ id: string; name: string }>;
}

export interface ImportRunResult {
  id: string;
  status: ImportStatus;
  total_rows: number;
  remaining: number;
  counts: ImportCounts;
}

export interface ImportLeftOut {
  headers: string[];
  rows: Array<{
    row_index: number;
    cells: string[];
    action: "skipped" | "failed";
    reason_code: ImportReasonCode | null;
    reason_detail: string | null;
  }>;
}

export interface ImportUndoResult {
  removed: number;
  restored: number;
  kept: Array<{ contact_id: string; name: string }>;
  kept_total: number;
}

const EXCEL = /\.(xlsx|xlsm|xls|xlsb)$/i;

export function isExcelFile(file: File): boolean {
  return EXCEL.test(file.name);
}

type SheetCell = { t?: string; v?: unknown; w?: string; z?: string | number };

/**
 * Rewrites the text of number cells so they arrive the way the owner means
 * them, whatever region the computer is set to:
 *
 * - A date is stored as a day count with a date format. Its shown text follows
 *   the computer's region ("3/1/26"), and turning it into a JS Date shifts it
 *   by the time zone (a birthday lands a day early east of Greenwich). So the
 *   day count itself is read: 2026-03-01, plus the time when there is one.
 * - A plain number with no format (a long phone number, a customer number) is
 *   shown by Excel as 4.91511E+12 once it is wide enough. The digits are kept.
 * - Anything the owner formatted on purpose (1,234.50, 20%) stays as shown.
 */
export function normalizeSheetCells(
  sheet: Record<string, unknown>,
  ssf: {
    is_date: (fmt: string) => boolean;
    parse_date_code: (v: number) => { y: number; m: number; d: number; H: number; M: number; S: number } | null;
  },
): void {
  const pad = (n: number) => String(n).padStart(2, "0");
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address] as SheetCell;
    if (cell.t !== "n" || typeof cell.v !== "number" || !Number.isFinite(cell.v)) continue;
    const format = typeof cell.z === "string" ? cell.z : "";
    if (format && format !== "General" && ssf.is_date(format)) {
      const p = ssf.parse_date_code(cell.v);
      if (!p) continue;
      const day = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
      // A pure time (day count below 1) has no date to show.
      if (cell.v < 1) cell.w = `${pad(p.H)}:${pad(p.M)}`;
      else cell.w = p.H + p.M + p.S > 0 ? `${day} ${pad(p.H)}:${pad(p.M)}` : day;
      continue;
    }
    if (!format || format === "General") {
      cell.w = Number.isInteger(cell.v)
        ? cell.v.toLocaleString("fullwide", { useGrouping: false })
        : String(cell.v);
    }
  }
}

/**
 * Excel workbooks are turned into CSV in the browser. The first sheet that
 * actually holds rows is used (a cover or empty sheet in front is skipped);
 * see `normalizeSheetCells` for how dates and numbers are written.
 */
export async function excelToCsvFile(file: File): Promise<File> {
  const { read, utils, SSF } = await import("xlsx");
  // cellNF keeps each cell's number format, which is how a date is told from a number.
  const workbook = read(await file.arrayBuffer(), { type: "array", cellNF: true });
  let csv = "";
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet || !sheet["!ref"]) continue;
    normalizeSheetCells(sheet as Record<string, unknown>, SSF);
    const text = utils.sheet_to_csv(sheet, { FS: ",", blankrows: false, rawNumbers: false });
    // A header line plus at least one more line with something in it.
    const lines = text.split(/\r?\n/).filter((l) => l.replace(/[,\s"]/g, "") !== "");
    if (lines.length >= 2) {
      csv = text;
      break;
    }
    if (!csv && lines.length === 1) csv = text; // header only: the server says so plainly
  }
  if (!csv) throw new Error("xlsx_empty");
  // Keeps the owner's file name ("contacts.xlsx") so past imports show the
  // file they actually chose.
  return new File([new Blob([csv], { type: "text/csv" })], file.name, { type: "text/csv" });
}

async function toCsvFile(file: File): Promise<File> {
  return isExcelFile(file) ? excelToCsvFile(file) : file;
}

export async function uploadContactImport(file: File): Promise<ContactImport> {
  const source = isExcelFile(file) ? "xlsx_import" : "csv_import";
  const form = new FormData();
  form.append("file", await toCsvFile(file));
  const res = await apiClient.post<ContactImport>(`/contacts/imports?source=${source}`, form, {
    timeout: 120_000,
    headers: { "Content-Type": undefined },
  });
  return res.data;
}

export async function getContactImport(id: string): Promise<ContactImport> {
  return (await apiClient.get<ContactImport>(`/contacts/imports/${id}`)).data;
}

export async function listContactImports(): Promise<ContactImportListItem[]> {
  return (await apiClient.get<ContactImportListItem[]>("/contacts/imports")).data;
}

export async function checkContactImport(
  id: string,
  body: { mapping: ColumnMapping[]; options: ImportOptions },
): Promise<ImportCheck> {
  return (
    await apiClient.post<ImportCheck>(`/contacts/imports/${id}/check`, body, { timeout: 120_000 })
  ).data;
}

/** One slice of the import (the server works ~20 s per call). */
export async function runContactImport(
  id: string,
  rowChoices?: Record<string, "update" | "skip">,
): Promise<ImportRunResult> {
  return (
    await apiClient.post<ImportRunResult>(
      `/contacts/imports/${id}/run`,
      { row_choices: rowChoices ?? {} },
      { timeout: 120_000 },
    )
  ).data;
}

/** Ends a half-finished import: what is saved stays, the rest is left out. */
export async function stopContactImport(id: string): Promise<ImportRunResult> {
  return (
    await apiClient.post<ImportRunResult>(`/contacts/imports/${id}/stop`, {}, { timeout: 120_000 })
  ).data;
}

export async function getImportLeftOut(id: string): Promise<ImportLeftOut> {
  return (await apiClient.get<ImportLeftOut>(`/contacts/imports/${id}/left-out`)).data;
}

/**
 * Takes an import back. The server works in short slices; this keeps calling
 * until nothing is left and adds the slices up. Safe to call again after an
 * error: lines already taken back are not touched twice.
 */
export async function undoContactImport(
  id: string,
  onProgress?: (remaining: number) => void,
): Promise<ImportUndoResult> {
  const total: ImportUndoResult = { removed: 0, restored: 0, kept: [], kept_total: 0 };
  for (;;) {
    const res = (
      await apiClient.post<ImportUndoResult & { remaining?: number }>(
        `/contacts/imports/${id}/undo`,
        {},
        { timeout: 120_000 },
      )
    ).data;
    total.removed += res.removed;
    total.restored += res.restored;
    total.kept_total += res.kept_total;
    if (total.kept.length < 200) total.kept.push(...res.kept.slice(0, 200 - total.kept.length));
    if (!res.remaining) return total;
    onProgress?.(res.remaining);
  }
}

export async function updateContactCustomFields(
  contactId: string,
  body: { set?: Record<string, string>; remove?: string[] },
): Promise<{ metadata: Record<string, unknown> }> {
  return (
    await apiClient.patch<{ metadata: Record<string, unknown> }>(
      `/contacts/${contactId}/custom-fields`,
      body,
    )
  ).data;
}

/** The same key rule the server uses, so a typed name and its key agree. */
export function customKeyFor(label: string): string {
  return label
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/** "follow_up_sent" → "Follow up sent". */
export function customFieldLabel(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
