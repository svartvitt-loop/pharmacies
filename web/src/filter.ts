import type { Interval, Pharmacy } from "./data";
import { distanceKm, type LatLng } from "./geo";
import { HOUR, addDays, athensDate, athensTime, parseClock } from "./time";

export const WHEN_OPTIONS = ["now", "next3h", "tonight", "today", "tomorrow", "custom"] as const;
export type When = (typeof WHEN_OPTIONS)[number];
export const RADII_KM = [0, 1, 2, 5, 10] as const; // 0 = any distance

/** Which pharmacies to show: the part of the app state that filtering reads. */
export interface Filter {
  when: When;
  date: string; // custom window: Athens date + clock times
  from: string;
  to: string;
  areas: string[];
  radiusKm: number;
  showClosed: boolean; // also list pharmacies not on duty in the window
  near: LatLng | null;
}

/** The [from, to] instants the user is asking about. from === to means "at this moment". */
export function timeWindow(filter: Filter, now: number): [number, number] {
  const today = athensDate(now);
  const tomorrow = addDays(today, 1);
  switch (filter.when) {
    case "now":
      return [now, now];
    case "next3h":
      return [now, now + 3 * HOUR];
    case "tonight": {
      const morning = athensTime(today, 8 * 60);
      if (now < morning) return [now, morning]; // already past midnight: the rest of this night
      return [Math.max(now, athensTime(today, 21 * 60)), athensTime(tomorrow, 8 * 60)];
    }
    case "today":
      return [now, athensTime(tomorrow)];
    case "tomorrow":
      return [athensTime(tomorrow), athensTime(addDays(tomorrow, 1))];
    case "custom": {
      const from = parseClock(filter.from);
      let to = parseClock(filter.to);
      if (to <= from) to += 24 * 60; // e.g. 22:00 → 02:00 runs past midnight
      return [athensTime(filter.date, from), athensTime(filter.date, to)];
    }
  }
}

function overlaps(interval: Interval, [from, to]: [number, number]): boolean {
  return from === to ? interval.start <= from && from < interval.end : interval.start < to && interval.end > from;
}

export interface Result {
  pharmacy: Pharmacy;
  matched: Interval[]; // empty: not on duty in the window (only with showClosed)
  current: Interval | null; // interval open at this moment
  next: Interval | null; // first interval that hasn't ended yet
  distanceKm: number | null;
}

export function onDuty(result: Result): boolean {
  return result.matched.length > 0;
}

export type Status = "open" | "closing" | "later" | "closed";

/** The same for cards, popups and map markers. */
export function status(result: Result, now: number): Status {
  if (!onDuty(result)) return "closed";
  if (!result.current) return "later";
  return result.current.end - now <= HOUR ? "closing" : "open";
}

export function filterPharmacies(pharmacies: Pharmacy[], filter: Filter, now: number): Result[] {
  const window = timeWindow(filter, now);
  const areas = new Set(filter.areas);
  const results: Result[] = [];
  for (const pharmacy of pharmacies) {
    if (areas.size && !areas.has(pharmacy.area)) continue;
    const matched = pharmacy.intervals.filter((i) => overlaps(i, window));
    if (!matched.length && !filter.showClosed) continue;
    let distance: number | null = null;
    if (filter.near && pharmacy.lat !== null && pharmacy.lng !== null) {
      distance = distanceKm(filter.near, { lat: pharmacy.lat, lng: pharmacy.lng });
      if (filter.radiusKm && distance > filter.radiusKm) continue;
    }
    const current = pharmacy.intervals.find((i) => i.start <= now && now < i.end) ?? null;
    const next = pharmacy.intervals.find((i) => i.end > now) ?? null;
    results.push({ pharmacy, matched, current, next, distanceKm: distance });
  }
  // Pharmacies on duty first, then the closed ones; within each group nearest or soonest first.
  return results.sort((a, b) => {
    if (onDuty(a) !== onDuty(b)) return onDuty(a) ? -1 : 1;
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (onDuty(a) && !!a.current !== !!b.current) return a.current ? -1 : 1;
    const start = (r: Result) => (r.matched[0] ?? r.next)?.start ?? Infinity;
    return start(a) - start(b) || a.pharmacy.area.localeCompare(b.pharmacy.area, "el");
  });
}

/** Whether the published schedule covers the whole window (it only runs a couple of weeks ahead). */
export function windowCovered(dates: string[], filter: Filter, now: number): boolean {
  const [, to] = timeWindow(filter, now);
  const last = dates[dates.length - 1];
  return !last || to <= athensTime(addDays(last, 1));
}
