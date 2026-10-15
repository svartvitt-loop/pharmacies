import { LngLatBounds, Map as MapLibre, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { lang, t } from "./i18n";
import { directionsUrl, display, el, intervalText, status, statusText } from "./render";
import type { LatLng, Result } from "./state";

// The bundle can't find MapLibre's worker next to itself, so point it at the emitted copy.
setWorkerUrl(workerUrl);

const ATHENS: [number, number] = [23.7275, 37.9838];
const COLORS = { open: "#15803d", closing: "#d97706", later: "#2563eb" } as const;
const SORT = { later: 0, closing: 1, open: 2 } as const; // open pharmacies drawn on top

const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const PALETTE = dark
  ? { background: "#1b2321", water: "#16302f", minor: "#34413d", major: "#4a5954", text: "#b8c5c0", halo: "#1b2321" }
  : { background: "#f7f7f4", water: "#dce9ee", minor: "#e1e3de", major: "#c9cdc6", text: "#5b625e", halo: "#ffffff" };

const ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"];
const MAJOR = ["motorway", "trunk", "primary", "secondary"];

type Fit = "results" | "athens" | false;

/** Street names in Greek, or OpenMapTiles' Latin transliteration in the English UI. */
function streetName(): unknown {
  return lang() === "en" ? ["coalesce", ["get", "name:latin"], ["get", "name"]] : ["get", "name"];
}

/** A deliberately minimal style: background, water, streets and street names. Nothing else. */
function minimalStyle() {
  return {
    version: 8 as const,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "vector" as const,
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": PALETTE.background } },
      { id: "water", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": PALETTE.water } },
      {
        id: "streets",
        type: "line",
        source: "osm",
        "source-layer": "transportation",
        filter: [
          "any",
          ["in", ["get", "class"], ["literal", ROAD_CLASSES]],
          ["==", ["get", "subclass"], "pedestrian"],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["in", ["get", "class"], ["literal", MAJOR]], PALETTE.major, PALETTE.minor],
          "line-width": [
            "interpolate", ["exponential", 1.6], ["zoom"],
            10, ["case", ["in", ["get", "class"], ["literal", MAJOR]], 1.5, 0.3],
            16, ["case", ["in", ["get", "class"], ["literal", MAJOR]], 14, 7],
            19, ["case", ["in", ["get", "class"], ["literal", MAJOR]], 40, 24],
          ],
        },
      },
      {
        id: "street-names",
        type: "symbol",
        source: "osm",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "symbol-placement": "line",
          "text-field": streetName(),
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 13],
        },
        paint: { "text-color": PALETTE.text, "text-halo-color": PALETTE.halo, "text-halo-width": 1.5 },
      },
    ],
  };
}

export class PharmacyMap {
  private map: MapLibre;
  private ready = false;
  private pending: (() => void) | null = null;
  private pendingFit: Fit = false;
  private results = new Map<string, Result>();
  private now = Date.now();
  private lang = lang();
  private popup = new Popup({ maxWidth: "280px", offset: 12 });

  constructor(container: HTMLElement) {
    this.map = new MapLibre({
      container,
      style: minimalStyle() as never, // the style-spec types aren't exported by maplibre-gl
      center: ATHENS,
      zoom: 12,
      maxZoom: 19,
    });
    this.map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    this.map.on("load", () => {
      this.map.addSource("pharmacies", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      this.map.addSource("you", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      this.map.addLayer({
        id: "pharmacies",
        type: "circle",
        source: "pharmacies",
        layout: { "circle-sort-key": ["get", "sort"] },
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 15, 9],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      this.map.addLayer({
        id: "you",
        type: "circle",
        source: "you",
        paint: { "circle-color": "#7c3aed", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
      });
      this.map.on("click", "pharmacies", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) this.openPopup(id);
      });
      this.map.on("mouseenter", "pharmacies", () => (this.map.getCanvas().style.cursor = "pointer"));
      this.map.on("mouseleave", "pharmacies", () => (this.map.getCanvas().style.cursor = ""));
      this.ready = true;
      this.pending?.();
      this.pending = null;
    });
  }

  update(results: Result[], now: number, near: LatLng | null, fit: Fit): void {
    if (!this.ready) {
      // Only the latest data matters, but don't lose a fit requested by an earlier call.
      this.pendingFit = fit || this.pendingFit;
      this.pending = () => this.update(results, now, near, this.pendingFit);
      return;
    }
    this.now = now;
    this.results = new Map(results.map((r) => [r.pharmacy.id, r]));
    this.popup.remove();

    if (this.lang !== lang()) {
      this.lang = lang();
      this.map.setLayoutProperty("street-names", "text-field", streetName() as never);
    }

    const features = results
      .filter((r) => r.pharmacy.lat !== null && r.pharmacy.lng !== null)
      .map((r) => {
        const s = status(r, now);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [r.pharmacy.lng!, r.pharmacy.lat!] },
          properties: { id: r.pharmacy.id, color: COLORS[s], sort: SORT[s] },
        };
      });
    (this.map.getSource("pharmacies") as GeoJSONSource).setData({ type: "FeatureCollection", features });
    (this.map.getSource("you") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: near ? [{ type: "Feature", geometry: { type: "Point", coordinates: [near.lng, near.lat] }, properties: {} }] : [],
    });

    if (fit === "athens") {
      this.map.jumpTo({ center: ATHENS, zoom: 12 });
    } else if (fit === "results") {
      const bounds = new LngLatBounds();
      features.forEach((f) => bounds.extend(f.geometry.coordinates as [number, number]));
      if (near) bounds.extend([near.lng, near.lat]);
      if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
    }
  }

  focus(id: string): void {
    const p = this.results.get(id)?.pharmacy;
    if (!p || p.lat === null || p.lng === null) return;
    this.map.jumpTo({ center: [p.lng, p.lat], zoom: Math.max(this.map.getZoom(), 15) });
    this.openPopup(id);
  }

  /** MapLibre must re-measure after its container changes from hidden to visible. */
  resize(): void {
    this.map.resize();
  }

  private openPopup(id: string): void {
    const result = this.results.get(id);
    const p = result?.pharmacy;
    if (!result || !p || p.lat === null || p.lng === null) return;
    this.popup.setLngLat([p.lng, p.lat]).setDOMContent(popupContent(result, this.now)).addTo(this.map);
  }
}

function popupContent(result: Result, now: number): HTMLElement {
  const p = result.pharmacy;
  return el(
    "div",
    { className: "popup" },
    el("strong", {}, display(p.name)),
    el("div", {}, `${display(p.address)}, ${display(p.area)}`),
    el("div", { className: `status status-${status(result, now)}` }, statusText(result, now)),
    el("div", { className: "muted" }, result.matched.map(intervalText).join(" · ")),
    el(
      "div",
      { className: "popup-actions" },
      el("a", { href: `tel:${p.phone}` }, `☎ ${p.phone}`),
      el("a", { href: directionsUrl(p), target: "_blank", rel: "noopener" }, t("directions")),
    ),
  );
}
