/** All schedule times are Athens wall-clock times, whatever the visitor's own time zone. */

export const TZ = "Europe/Athens";
export const HOUR = 3_600_000;

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function athensParts(ms: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(ms)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

function offsetMs(ms: number): number {
  const p = athensParts(ms);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** "YYYY-MM-DD" (Athens) of an instant. */
export function athensDate(ms: number): string {
  const p = athensParts(ms);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Instant of an Athens wall-clock time: a date plus minutes after its midnight (may exceed 24h). */
export function athensTime(date: string, minutes = 0): number {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  const guess = wall - offsetMs(wall);
  return wall - offsetMs(guess);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "HH:MM" → minutes after midnight. */
export function parseClock(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatClock(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

export function formatDay(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric" }).format(ms);
}
