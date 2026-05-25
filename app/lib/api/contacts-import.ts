import { apiClient } from "./axios-instance";

export interface ContactCsvFieldMapping {
  csvColumn: string;
  contactField: string;
}

export interface ContactImportAddress {
  type?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface ContactImportRow {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  notes?: string | null;
  contact_type?: string | null;
  addresses?: ContactImportAddress[];
  metadata?: Record<string, unknown>;
}

export interface ParseContactsCsvResponse {
  fieldMapping: ContactCsvFieldMapping[];
  rows: ContactImportRow[];
  totalRows: number;
}

export interface ParseContactsVcardResponse extends ParseContactsCsvResponse {
  errors?: Array<{ index: number; reason: string }>;
}

export interface UploadContactsImportResponse {
  created: number;
  ids: string[];
  skipped: number;
  errors: Array<{ index: number; reason: string }>;
}

export async function parseContactsCsv(
  file: File
): Promise<ParseContactsCsvResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiClient.post<ParseContactsCsvResponse>(
    "/contacts/import/parse",
    formData,
    {
      timeout: 120000,
      headers: {
        "Content-Type": undefined,
      },
    }
  );
  return res.data;
}

export async function uploadContactsImport(payload: {
  rows: ContactImportRow[];
  source?: "csv_import" | "vcard_import" | "xlsx_import";
}): Promise<UploadContactsImportResponse> {
  const res = await apiClient.post<UploadContactsImportResponse>(
    "/contacts/import/upload",
    {
      ...payload,
      source: payload.source ?? "csv_import",
    }
  );
  return res.data;
}

export async function parseContactsXlsx(
  file: File
): Promise<ParseContactsCsvResponse> {
  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("xlsx_empty");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const csv = utils.sheet_to_csv(sheet, { FS: ",", blankrows: false });
  const csvBlob = new Blob([csv], { type: "text/csv" });
  const csvName = file.name.replace(/\.(xlsx|xlsm|xls|xlsb)$/i, "") + ".csv";
  const csvFile = new File([csvBlob], csvName, { type: "text/csv" });
  return parseContactsCsv(csvFile);
}

export async function parseContactsVcard(
  file: File
): Promise<ParseContactsVcardResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiClient.post<ParseContactsVcardResponse>(
    "/contacts/import/vcard/parse",
    formData,
    {
      timeout: 120000,
      headers: {
        "Content-Type": undefined,
      },
    }
  );
  return res.data;
}
