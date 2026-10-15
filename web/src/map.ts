import { LngLatBounds, Map as MapLibre, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { lang, t } from "./i18n";
import { directionsUrl, display, el, intervalText, status, statusText } from "./render";
import type { LatLng, Result } from "./state";

// The bundle can't find MapLibre's worker next to itself, so point it at the emitted copy.
setWorkerUrl(workerUrl);

const ATHENS: [number, number] = [23.7275, 37.9838];
const COLORS = { open: "#16a34a", closing: "#f59e0b", later: "#2563eb" } as const;
const SORT = { later: 0, closing: 1, open: 2 } as const; // open pharmacies drawn on top

/** A pharmacy cross with a white outline, drawn at 2x for sharp rendering. */
function crossImage(color: string): ImageData {
  const size = 52;
  const pad = 5; // room for the outline
  const arm = 16; // arm thickness
  const a = (size - arm) / 2;
  const b = a + arm;
  const e = size - pad;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const points = [[a, pad], [b, pad], [b, a], [e, a], [e, b], [b, b], [b, e], [a, e], [a, b], [pad, b], [pad, a], [a, a]];
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

// Always a light, colourful map (also in dark mode), in the spirit of classic street maps.
const PALETTE = {
  background: "#f8f4ec",
  water: "#8ccbf2",
  casing: "#d3cab8",
  text: "#2b2b2b",
  halo: "#ffffff",
};
const ROAD_COLORS: Record<string, string> = {
  motorway: "#f08a3c",
  trunk: "#f6a64a",
  primary: "#fcc94b",
  secondary: "#fde68a",
};
const ROAD_FILL = "#ffffff"; // tertiary, minor, service, pedestrian

const ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"];
// Line widths in pixels at zoom 10 / 16 / 19.
const ROAD_WIDTHS: Record<string, [number, number, number]> = {
  motorway: [2, 14, 40],
  trunk: [1.8, 13, 38],
  primary: [1.5, 12, 36],
  secondary: [1.1, 11, 32],
  tertiary: [0.7, 9, 28],
  minor: [0.3, 7, 24],
  service: [0.1, 4, 14],
};
const PEDESTRIAN_WIDTHS: [number, number, number] = [0.3, 5, 18];
const ROAD_RANK = ["service", "minor", "tertiary", "secondary", "primary", "trunk", "motorway"];

/** A MapLibre "match" on the road class. */
function byClass<T>(values: Record<string, T>, fallback: T): unknown[] {
  return ["match", ["get", "class"], ...Object.entries(values).flat(), fallback];
}

function roadWidth(extra = 0): unknown[] {
  const stop = (i: 0 | 1 | 2) =>
    byClass(Object.fromEntries(Object.entries(ROAD_WIDTHS).map(([k, w]) => [k, w[i] + extra])), PEDESTRIAN_WIDTHS[i] + extra);
  return ["interpolate", ["exponential", 1.6], ["zoom"], 10, stop(0), 16, stop(1), 19, stop(2)];
}

type Fit = "results" | "athens" | false;

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Street names in Greek, or OpenMapTiles' Latin transliteration in the English UI. */
function streetName(): unknown {
  return lang() === "en" ? ["coalesce", ["get", "name:latin"], ["get", "name"]] : ["get", "name"];
}

function streetLayer(id: string) {
  return {
    id,
    type: "line",
    source: "osm",
    "source-layer": "transportation",
    filter: ["any", ["in", ["get", "class"], ["literal", ROAD_CLASSES]], ["==", ["get", "subclass"], "pedestrian"]],
    // Bigger roads are drawn above smaller ones.
    layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["index-of", ["get", "class"], ["literal", ROAD_RANK]] },
  };
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
      { ...streetLayer("street-casing"), paint: { "line-color": PALETTE.casing, "line-width": roadWidth(1.5) } },
      {
        ...streetLayer("streets"),
        paint: { "line-color": byClass(ROAD_COLORS, ROAD_FILL), "line-width": roadWidth() },
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
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.5, 17, 13.5],
        },
        paint: { "text-color": PALETTE.text, "text-halo-color": PALETTE.halo, "text-halo-width": 2 },
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
  private near: LatLng | null = null;

  /** onMove receives the visible area whenever the map stops moving or is resized. */
  constructor(container: HTMLElement, onMove: (bounds: Bounds) => void) {
    this.map = new MapLibre({
      container,
      style: minimalStyle() as never, // the style-spec types aren't exported by maplibre-gl
      center: ATHENS,
      zoom: 12,
      maxZoom: 19,
    });
    this.map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    const reportBounds = () => {
      const b = this.map.getBounds();
      onMove({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    this.map.on("moveend", reportBounds);
    this.map.on("resize", reportBounds);
    this.map.on("load", () => {
      this.map.addSource("pharmacies", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      this.map.addSource("you", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      for (const [s, color] of Object.entries(COLORS)) {
        this.map.addImage(`cross-${s}`, crossImage(color), { pixelRatio: 2 });
      }
      this.map.addLayer({
        id: "pharmacies",
        type: "symbol",
        source: "pharmacies",
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.65, 15, 1],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "symbol-sort-key": ["get", "sort"],
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
    this.near = near;
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
          properties: { id: r.pharmacy.id, icon: `cross-${s}`, sort: SORT[s] },
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
      this.fitResults();
    }
  }

  /** Zoom so that every current result (and the user's position) is visible. */
  fitResults(): void {
    const bounds = new LngLatBounds();
    for (const { pharmacy: p } of this.results.values()) {
      if (p.lat !== null && p.lng !== null) bounds.extend([p.lng, p.lat]);
    }
    if (this.near) bounds.extend([this.near.lng, this.near.lat]);
    if (!bounds.isEmpty()) this.map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
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
