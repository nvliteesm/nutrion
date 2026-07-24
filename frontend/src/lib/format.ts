/** Small presentation helpers. */

/** 1420 -> "1,420" */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** ISO timestamp -> "10:05 AM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ISO date/timestamp -> "Thursday, July 24" */
export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Time-of-day greeting based on the local hour. */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** First name from a full name, for greetings. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
