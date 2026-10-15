import type { Interval, Pharmacy } from "./data";
import type { Lang } from "./i18n";
import { HOUR, addDays, athensDate, athensTime, parseClock } from "./time";

export const WHEN_OPTIONS = ["now", "next3h", "tonight", "today", "tomorrow", "custom"] as const;
export type When = (typeof WHEN_OPTIONS)[number];
export type View = "list" | "map";
export const RADII_KM = [0, 1, 2, 5, 10] as const; // 0 = any distance

export interface LatLng {
  lat: number;
  lng: number;
}

export interface State {
  lang: Lang;
  view: View;
  when: When;
  date: string; // custom window: Athens date + clock times
  from: string;
  to: string;
  areas: string[];
  radiusKm: number;
  showClosed: boolean; // also list pharmacies not on duty in the window
  near: LatLng | null; // never stored in the URL
}

export function readState(now: number): State {
  const q = new URLSearchParams(location.search);
  const when = q.get("when") as When;
  let storedLang: string | null = null;
  try {
    storedLang = localStorage.getItem("lang");
  } catch {
    /* storage unavailable */
  }
  const langParam = q.get("lang") ?? storedLang ?? (navigator.language.startsWith("el") ? "el" : "en");
  return {
    lang: langParam === "en" ? "en" : "el",
    view: q.get("view") === "map" ? "map" : "list",
    when: WHEN_OPTIONS.includes(when) ? when : "now",
    date: q.get("date") ?? athensDate(now),
    from: q.get("from") ?? "20:00",
    to: q.get("to") ?? "23:00",
    areas: q.get("areas")?.split(",").filter(Boolean) ?? [],
    radiusKm: Number(q.get("radius")) || 0,
    showClosed: q.get("closed") === "1",
    near: null,
  };
}

export function writeState(state: State): void {
  const q = new URLSearchParams();
  q.set("lang", state.lang);
  if (state.view !== "list") q.set("view", state.view);
  if (state.when !== "now") q.set("when", state.when);
  if (state.when === "custom") {
    q.set("date", state.date);
    q.set("from", state.from);
    q.set("to", state.to);
  }
  if (state.areas.length) q.set("areas", state.areas.join(","));
  if (state.radiusKm) q.set("radius", String(state.radiusKm));
  if (state.showClosed) q.set("closed", "1");
  history.replaceState(null, "", `${location.pathname}?${q}`);
  try {
    localStorage.setItem("lang", state.lang);
  } catch {
    /* storage unavailable */
  }
}

/** The [from, to] instants the user is asking about. from === to means "at this moment". */
export function timeWindow(state: State, now: number): [number, number] {
  const today = athensDate(now);
  const tomorrow = addDays(today, 1);
  switch (state.when) {
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
      const from = parseClock(state.from);
      let to = parseClock(state.to);
      if (to <= from) to += 24 * 60; // e.g. 22:00 → 02:00 runs past midnight
      return [athensTime(state.date, from), athensTime(state.date, to)];
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

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

export function filterPharmacies(pharmacies: Pharmacy[], state: State, now: number): Result[] {
  const window = timeWindow(state, now);
  const areas = new Set(state.areas);
  const results: Result[] = [];
  for (const pharmacy of pharmacies) {
    if (areas.size && !areas.has(pharmacy.area)) continue;
    const matched = pharmacy.intervals.filter((i) => overlaps(i, window));
    if (!matched.length && !state.showClosed) continue;
    let distance: number | null = null;
    if (state.near && pharmacy.lat !== null && pharmacy.lng !== null) {
      distance = distanceKm(state.near, { lat: pharmacy.lat, lng: pharmacy.lng });
      if (state.radiusKm && distance > state.radiusKm) continue;
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
export function windowCovered(dates: string[], state: State, now: number): boolean {
  const [, to] = timeWindow(state, now);
  const last = dates[dates.length - 1];
  return !last || to <= athensTime(addDays(last, 1));
}
