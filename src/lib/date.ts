/** Format a Date as YYYY-MM-DD in the local timezone. */
export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return today's date as YYYY-MM-DD in local timezone. */
export function today(): string {
  return localDate(new Date());
}

/** Return a date N days ago as YYYY-MM-DD in local timezone. */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
}
