import { WHEN_OPTIONS, type Filter, type When } from "./filter";
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
