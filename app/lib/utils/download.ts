/**
 * The house download idiom (object URL + synthetic anchor click), extracted —
 * the same ten lines were copy-pasted five times across the brand export
 * code before this file existed.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download a same-or-CORS-readable URL as a file. A plain <a download> is
 * ignored cross-origin, so the bytes are fetched into a Blob first (the media
 * bucket's CORS already allows GET from the app origins).
 */
export async function downloadFromUrl(
  url: string,
  filename: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  downloadBlob(await res.blob(), filename);
}
