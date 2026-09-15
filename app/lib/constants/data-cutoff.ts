/**
 * Nothing before this date is shown anywhere in the product.
 *
 * Mirror of the backend's `src/common/data-cutoff.ts` — the backend is the
 * source of truth and floors every query regardless of what the UI sends.
 * These helpers exist so pickers don't offer ranges that can only come back
 * empty. Keep the two files in step.
 */
export const DATA_CUTOFF_DATE = "2025-01-01";

/** Local-midnight Date for calendar maths (pickers compare local days). */
export const DATA_CUTOFF = new Date(2025, 0, 1);

/** Raise a `YYYY-MM-DD` lower bound to the cutoff. */
export function clampFromDate(from?: string | null): string {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return DATA_CUTOFF_DATE;
  return from < DATA_CUTOFF_DATE ? DATA_CUTOFF_DATE : from;
}

/** Raise a Date to the cutoff. */
export function clampDate(d: Date): Date {
  return d.getTime() < DATA_CUTOFF.getTime() ? DATA_CUTOFF : d;
}
