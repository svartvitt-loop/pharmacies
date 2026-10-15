import "./style.css";
import { loadDataset, type Dataset } from "./data";
import { fold } from "./greek";
import { closedCountLabel, inMapAreaLabel, resultsLabel, setLang, t } from "./i18n";
import { renderList } from "./list";
import { PharmacyMap, type Bounds } from "./map";
import { display, el } from "./render";
import {
  RADII_KM,
  WHEN_OPTIONS,
  filterPharmacies,
  onDuty,
  readState,
  windowCovered,
  writeState,
  type Result,
  type View,
} from "./state";
import { athensDate, formatClock, formatDay } from "./time";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const state = readState(Date.now());
let data: Dataset | null = null;
let fitPending = false;
let results: Result[] = [];
let emptyMessage = "";
// With list and map side by side, the list follows the visible map area.
const sideBySide = matchMedia("(min-width: 1024px)");
let mapBounds: Bounds | null = null;

const listEl = $("list");
const mapEl = $("map");
const map = new PharmacyMap(mapEl, (bounds) => {
  mapBounds = bounds;
  renderResults();
});
const areaSearch = $<HTMLInputElement>("area-search");
const suggestions = $<HTMLUListElement>("area-suggestions");
const customDate = $<HTMLInputElement>("custom-date");
const customFrom = $<HTMLInputElement>("custom-from");
const customTo = $<HTMLInputElement>("custom-to");
const radius = $<HTMLSelectElement>("radius");

/** Apply a state change. The map keeps its current position; only pins and list update. */
function commit(): void {
  writeState(state);
  renderControls();
  render();
}

/** fit is only used for the first render, before the user has a map position to keep. */
function render(fit = false): void {
  if (!data) return;
  const now = Date.now();
  results = filterPharmacies(data.pharmacies, state, now);
  emptyMessage = windowCovered(data.dates, state, now) ? t("noResults") : t("outOfRange");
  renderResults(now);
  const mapVisible = mapEl.offsetWidth > 0;
  // Without an area or location filter, results span all of Attica; zooming to them hides the city.
  const fitMode = state.areas.length || state.near ? "results" : "athens";
  map.update(results, now, state.near, fit && mapVisible ? fitMode : false);
  if (fit && !mapVisible) fitPending = true;
}

function inBounds({ pharmacy: p }: Result, b: Bounds): boolean {
  if (p.lat === null || p.lng === null) return true;
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
}

/** Result count and list; on wide screens only the pharmacies inside the visible map area. */
function renderResults(now = Date.now()): void {
  if (!data) return;
  const bounds = sideBySide.matches ? mapBounds : null;
  const shown = bounds ? results.filter((r) => inBounds(r, bounds)) : results;
  // The counts are about pharmacies on duty; closed ones (if shown) are counted separately.
  const total = results.filter(onDuty).length;
  const shownOpen = shown.filter(onDuty).length;
  const shownClosed = shown.length - shownOpen;
  const count = $("result-count");
  const closedNote = shownClosed ? [" · ", closedCountLabel(shownClosed)] : [];
  if (shownOpen < total) {
    const showAll = el("button", { type: "button", className: "link-button" }, t("showAll"));
    showAll.addEventListener("click", () => map.fitResults(true));
    count.replaceChildren(inMapAreaLabel(shownOpen, total), ...closedNote, " · ", showAll);
  } else {
    count.replaceChildren(resultsLabel(total), ...closedNote);
  }
  renderList(listEl, shown, now, total ? t("noneInMapArea") : emptyMessage, showOnMap);
}

sideBySide.addEventListener("change", () => renderResults());

function showOnMap(id: string): void {
  if (getComputedStyle(mapEl).display === "none" || mapEl.offsetWidth === 0) setView("map");
  map.focus(id);
}

function setView(view: View): void {
  state.view = view;
  commit();
  if (view === "map") {
    map.resize();
    if (fitPending) {
      fitPending = false;
      render(true);
    }
  }
}

// --- Controls -------------------------------------------------------------

function renderControls(): void {
  document.body.dataset.view = state.view;
  $("lang-toggle").textContent = state.lang === "el" ? "EN" : "ΕΛ";
  $("lang-toggle").setAttribute("aria-label", state.lang === "el" ? "English" : "Ελληνικά");

  $("when-presets").replaceChildren(
    ...WHEN_OPTIONS.map((when) => {
      const button = el("button", { type: "button", className: "chip" }, t(when));
      button.setAttribute("aria-pressed", String(state.when === when));
      button.addEventListener("click", () => {
        state.when = when;
        commit();
      });
      return button;
    }),
  );
  $("custom-range").hidden = state.when !== "custom";
  customDate.value = state.date;
  customFrom.value = state.from;
  customTo.value = state.to;
  if (data) {
    customDate.min = athensDate(Date.now());
    customDate.max = data.dates[data.dates.length - 1];
  }

  $("area-chips").replaceChildren(
    ...state.areas.map((area) => {
      const chip = el("button", { type: "button", className: "chip selected", title: t("removeArea") }, `${display(area)} ✕`);
      chip.addEventListener("click", () => {
        state.areas = state.areas.filter((a) => a !== area);
        commit();
      });
      return chip;
    }),
  );
  areaSearch.placeholder = t("areaPlaceholder");

  const near = $("near-me");
  near.textContent = state.near ? t("nearMeOn") : t("nearMe");
  near.setAttribute("aria-pressed", String(!!state.near));
  $("radius-label").hidden = !state.near;
  $("show-closed").setAttribute("aria-pressed", String(state.showClosed));
  radius.replaceChildren(
    ...RADII_KM.map((km) => el("option", { value: String(km), selected: km === state.radiusKm }, km ? `${km} km` : t("anyDistance"))),
  );

  for (const tab of [$("tab-list"), $("tab-map")]) {
    tab.setAttribute("aria-selected", String(tab.dataset.view === state.view));
  }

  if (data) {
    const loc = state.lang === "el" ? "el-GR" : "en-GB";
    $("updated").textContent = `${t("updated")}: ${formatDay(data.generatedAt, loc)} ${formatClock(data.generatedAt, loc)}`;
  }
}

function showSuggestions(): void {
  if (!data) return;
  const query = fold(areaSearch.value.trim());
  // Count pharmacies per area in the current time window, ignoring the area filter itself.
  const counts = new Map<string, number>();
  for (const r of filterPharmacies(data.pharmacies, { ...state, areas: [], near: null, showClosed: false }, Date.now())) {
    counts.set(r.pharmacy.area, (counts.get(r.pharmacy.area) ?? 0) + 1);
  }
  const matches = data.areas
    .filter((a) => !state.areas.includes(a.name) && (!query || a.key.includes(query)))
    .sort((a, b) => (query ? 0 : (counts.get(b.name) ?? 0) - (counts.get(a.name) ?? 0)))
    .slice(0, 10);

  suggestions.replaceChildren(
    ...matches.map((area) => {
      const item = el(
        "li",
        { role: "option" },
        display(area.name),
        el("span", { className: "muted" }, String(counts.get(area.name) ?? 0)),
      );
      // mousedown fires before the input's blur hides the list.
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        addArea(area.name);
      });
      return item;
    }),
  );
  suggestions.hidden = !matches.length;
}

function addArea(area: string): void {
  state.areas = [...state.areas, area];
  areaSearch.value = "";
  suggestions.hidden = true;
  commit();
}

areaSearch.addEventListener("input", showSuggestions);
areaSearch.addEventListener("focus", showSuggestions);
areaSearch.addEventListener("blur", () => (suggestions.hidden = true));
areaSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const first = suggestions.querySelector("li");
    first?.dispatchEvent(new MouseEvent("mousedown", { cancelable: true }));
  } else if (event.key === "Escape") {
    suggestions.hidden = true;
  } else if (event.key === "Backspace" && !areaSearch.value && state.areas.length) {
    state.areas = state.areas.slice(0, -1);
    commit();
  }
});

for (const input of [customDate, customFrom, customTo]) {
  input.addEventListener("change", () => {
    if (!customDate.value || !customFrom.value || !customTo.value) return;
    state.date = customDate.value;
    state.from = customFrom.value;
    state.to = customTo.value;
    commit();
  });
}

$("near-me").addEventListener("click", () => {
  const status = $("near-status");
  if (state.near) {
    state.near = null;
    status.textContent = "";
    commit();
    return;
  }
  status.textContent = t("locating");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.near = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!state.radiusKm) state.radiusKm = 2;
      status.textContent = "";
      commit();
    },
    () => (status.textContent = t("locationError")),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
  );
});

radius.addEventListener("change", () => {
  state.radiusKm = Number(radius.value);
  commit();
});

$("show-closed").addEventListener("click", () => {
  state.showClosed = !state.showClosed;
  commit();
});

for (const tab of [$("tab-list"), $("tab-map")]) {
  tab.addEventListener("click", () => setView(tab.dataset.view as View));
}

$("lang-toggle").addEventListener("click", () => {
  state.lang = state.lang === "el" ? "en" : "el";
  setLang(state.lang);
  commit();
});

// Keep "open now" statuses fresh.
setInterval(() => render(false), 60_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") render(false);
});

// --- Start ------------------------------------------------------------------

setLang(state.lang);
renderControls();
listEl.replaceChildren(el("p", { className: "empty" }, t("loading")));

loadDataset()
  .then((dataset) => {
    data = dataset;
    renderControls();
    render(true);
  })
  .catch((error) => {
    console.error(error);
    listEl.replaceChildren(el("p", { className: "empty error" }, t("loadError")));
  });
