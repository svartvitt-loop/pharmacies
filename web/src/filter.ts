import type { Interval, Pharmacy } from "./data";
import { boundsOf, circleBounds, distanceKm, type Bounds, type LatLng } from "./geo";
import { HOUR, addDays, athensDate, athensTime, parseClock } from "./time";

export const WHEN_OPTIONS = ["now", "next3h", "tonight", "today", "tomorrow", "custom"] as const;
export type When = (typeof WHEN_OPTIONS)[number];
/** The place filters; at most one applies at a time (none: all of Attica). */
export const PLACES = ["me", "address", "areas"] as const;
export type Place = (typeof PLACES)[number];
export const RADII_KM = [1, 2, 5, 10] as const; // the slider steps; no limit is the Everywhere place
export const DEFAULT_RADIUS_KM = 2;

/** A geocoded address the user picked. */
export interface Address extends LatLng {
  label: string;
  way?: number; // a whole street (no house number): one of its OpenStreetMap ways, to draw the street
}

/** Which pharmacies to show: the part of the app state that filtering reads. */
export interface Filter {
  when: When;
  date: string; // custom window: Athens date + clock times
  from: string;
  to: string;
  place: Place | null;
  // Each place filter keeps its input while another one is chosen, so switching back restores it.
  areas: string[]; // place "areas"
  address: Address | null; // place "address"
  near: LatLng | null; // place "me": the user's position, once known
  radiusKm: number; // places "me" and "address"
  showClosed: boolean; // also list pharmacies not on duty in the window
}

/** The point distances are measured from: the user's position or the chosen address. */
export function origin(filter: Filter): LatLng | null {
  if (filter.place === "me") return filter.near;
  if (filter.place === "address") return filter.address;
  return null;
}

/**
 * Where the map should look after the place filter changes: a box (around the radius, or around
 * the chosen areas' pharmacies), or null to stay put.
 */
export type Frame = Bounds | null;

export function placeFrame(filter: Filter, pharmacies: Pharmacy[]): Frame {
  if (filter.place === "areas") {
    // All the areas' pharmacies, not only those on duty: the box doesn't jump with the time window.
    const areas = new Set(filter.areas);
    return boundsOf(pharmacies.filter((p) => areas.has(p.area)));
  }
  const from = origin(filter);
  return from && circleBounds(from, filter.radiusKm);
}

/** Changes whenever the place filter does, and only then; the map moves when it changes. */
export function placeKey(filter: Filter): string {
  if (filter.place === "areas") return `areas:${filter.areas.join(",")}`;
  const from = origin(filter);
  return `${filter.place}:${from ? `${from.lat},${from.lng}` : "-"}:${filter.radiusKm}`;
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
  const areas = new Set(filter.place === "areas" ? filter.areas : []);
  const from = origin(filter);
  const results: Result[] = [];
  for (const pharmacy of pharmacies) {
    if (areas.size && !areas.has(pharmacy.area)) continue;
    const matched = pharmacy.intervals.filter((i) => overlaps(i, window));
    if (!matched.length && !filter.showClosed) continue;
    let distance: number | null = null;
    if (from && pharmacy.lat !== null && pharmacy.lng !== null) {
      distance = distanceKm(from, { lat: pharmacy.lat, lng: pharmacy.lng });
      if (distance > filter.radiusKm) continue;
    }
    const current = pharmacy.intervals.find((i) => i.start <= now && now < i.end) ?? null;
    const next = pharmacy.intervals.find((i) => i.end > now) ?? null;
    results.push({ pharmacy, matched, current, next, distanceKm: distance });
  }
  // Pharmacies on duty first, then the closed ones; within each group nearest (from the user's position
  // or the address) or soonest first.
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
