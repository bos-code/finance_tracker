/**
 * Formats a Date object as a local calendar date string: "YYYY-MM-DD".
 *
 * Using `Date.toISOString()` converts to UTC, which can shift the date by a
 * day for users in negative UTC offsets. This helper always returns the
 * local date so that calendar grouping and summaries are consistent with
 * what the user sees on their device.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Reconstructs a Date from a "YYYY-MM-DD" local date string without UTC
 * shifting (i.e., treats it as a local midnight, not UTC midnight).
 */
export function fromLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
