import { DEFAULT_RADIUS_KM, PLACES, RADII_KM, WHEN_OPTIONS, type Address, type Filter, type Place, type When } from "./filter";
import type { Lang } from "./i18n";
import { athensDate } from "./time";

export type View = "list" | "map";

/** The whole UI state. All of it lives in the URL except `near`, the user's position. */
export interface State extends Filter {
  lang: Lang;
  view: View;
}

export type StateUpdate = Partial<State> | ((state: State) => Partial<State>);

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
  const areas = q.get("areas")?.split(",").filter(Boolean) ?? [];
  const [lat, lng] = (q.get("at") ?? "").split(",").map(Number);
  const label = q.get("addr");
  const way = Number(q.get("way"));
  let address: Address | null = null;
  if (label && Number.isFinite(lat) && Number.isFinite(lng)) {
    address = Number.isSafeInteger(way) && way > 0 ? { label, lat, lng, way } : { label, lat, lng };
  }
  let place = q.get("place") as Place | null;
  // Links from before the place filters have only areas=.
  if (!PLACES.includes(place!)) place = areas.length ? "areas" : null;
  if (place === "address" && !address) place = null;
  const radius = Number(q.get("radius") ?? DEFAULT_RADIUS_KM);
  return {
    lang: langParam === "en" ? "en" : "el",
    view: q.get("view") === "map" ? "map" : "list",
    when: WHEN_OPTIONS.includes(when) ? when : "now",
    date: q.get("date") ?? athensDate(now),
    from: q.get("from") ?? "20:00",
    to: q.get("to") ?? "23:00",
    place,
    areas,
    address,
    near: null,
    radiusKm: (RADII_KM as readonly number[]).includes(radius) ? radius : DEFAULT_RADIUS_KM,
    showClosed: q.get("closed") === "1",
  };
}

/** Only the place filter in use goes into the URL, not the inputs the others keep. */
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
  if (state.place) q.set("place", state.place);
  if (state.place === "areas" && state.areas.length) q.set("areas", state.areas.join(","));
  if (state.place === "address" && state.address) {
    q.set("addr", state.address.label);
    q.set("at", `${state.address.lat.toFixed(5)},${state.address.lng.toFixed(5)}`);
    if (state.address.way) q.set("way", String(state.address.way));
  }
  if ((state.place === "me" || state.place === "address") && state.radiusKm !== DEFAULT_RADIUS_KM) {
    q.set("radius", String(state.radiusKm));
  }
  if (state.showClosed) q.set("closed", "1");
  history.replaceState(null, "", `${location.pathname}?${q}`);
  try {
    localStorage.setItem("lang", state.lang);
  } catch {
    /* storage unavailable */
  }
}
