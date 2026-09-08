/**
 * Human file size. Knowledge documents are typically a few KB — shown as
 * "0.0 MB" they looked empty, next to a parse failure that also said 0 pages.
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
