import { apiClient } from "./axios-instance";

export interface CsvFieldMapping {
  csvColumn: string;
  leadField: string;
}

export interface LeadImportRow {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ParseLeadsCsvResponse {
  fieldMapping: CsvFieldMapping[];
  rows: LeadImportRow[];
  totalRows: number;
}

export interface UploadLeadsImportResponse {
  created: number;
  ids: string[];
}

export async function parseLeadsCsv(
  file: File
): Promise<ParseLeadsCsvResponse> {
  const formData = new FormData();
  formData.append("file", file);

  // Omit Content-Type so browser sets multipart/form-data with boundary
  // AI mapping can take 30-60+ seconds for larger CSVs
  const res = await apiClient.post<ParseLeadsCsvResponse>(
    "/leads/import/parse",
    formData,
    {
      timeout: 120000, // 2 minutes for AI processing
      headers: {
        "Content-Type": undefined, // Let browser set multipart boundary
      },
    }
  );
  return res.data;
}

export async function uploadLeadsImport(payload: {
  rows: LeadImportRow[];
  source: "website";
}): Promise<UploadLeadsImportResponse> {
  const res = await apiClient.post<UploadLeadsImportResponse>(
    "/leads/import/upload",
    payload
  );
  return res.data;
}
