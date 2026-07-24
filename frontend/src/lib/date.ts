/**
 * Centralized date utility.
 *
 * Returns today's real date so entries logged and displayed match the actual
 * day the user is using the app — not a hardcoded demo date.
 */

/** Today as YYYY-MM-DD based on the user's local time. */
export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Current time as HH:MM. */
export function getNowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Full ISO timestamp for "now" on today. */
export function getNowISO(): string {
  return `${getToday()}T${getNowHHMM()}:00`;
}

/**
 * Local calendar day (YYYY-MM-DD) for any timestamp.
 * Normalizes both UTC ("...Z", from the backend) and naive-local strings
 * (from local logging) to the user's local day, so grouping/filtering is
 * consistent across both sources.
 */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
