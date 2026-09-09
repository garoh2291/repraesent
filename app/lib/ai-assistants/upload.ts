/**
 * The MIME type a knowledge upload is declared with. Browsers report .csv as
 * text/csv, application/vnd.ms-excel (Windows) or nothing at all, and .md
 * often as nothing — so the extension decides, and the browser's guess is
 * only the fallback.
 */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

export function uploadMimeOf(file: File): string {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return MIME_BY_EXT[ext] ?? file.type ?? "";
}
