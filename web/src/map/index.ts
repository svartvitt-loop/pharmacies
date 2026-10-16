import { LngLatBounds, Map as MapLibre, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { onDuty, status, type Result } from "../filter";
import { circlePolygon, type Bounds, type LatLng, type Line } from "../geo";
import type { Lang } from "../i18n";
import { MARKER_COLORS, MARKER_ORDER, crossImage } from "./markers";
import { minimalStyle, streetName } from "./style";

// The bundle can't find MapLibre's worker next to itself, so point it at the emitted copy.
setWorkerUrl(workerUrl);

const ATHENS: [number, number] = [23.7275, 37.9838];
const SETTLE_MS = 400; // quiet time after the last map movement before the list follows the map
const MAX_FLIGHT_MS = 2500; // cap for animated camera moves (On map, Show all, place filters)
const PLACE_COLOR = "#7c3aed"; // the origin dot and the radius around it
// PLACE_COLOR at 50 % over white, opaque: a street is drawn as several OSM ways, and translucent
// strokes would show darker spots where their ends overlap.
const STREET_COLOR = "#be9df6";

/** What the place filter draws: the origin dot (the user or the address), its radius, a chosen street. */
export interface PlaceMarks {
  origin: LatLng | null;
  radiusKm: number; // drawn around the origin
  street: Line[] | null;
}

/** A camera move: to a box or to central Athens; flying or jumping. */
export interface Camera {
  fit: Bounds | "athens";
  animate: boolean;
}

export class PharmacyMap {
  private map: MapLibre;
  private ready = false;
  private pending: (() => void) | null = null;
  private pendingCamera: Camera | null = null;
  private results = new Map<string, Result>();
  private lang: Lang = "el"; // the style starts with Greek street names
  private popup = new Popup({ maxWidth: "280px", offset: 12 });
  private origin: LatLng | null = null;
  private popupId: string | null = null;
  private settle: ReturnType<typeof setTimeout> | undefined;

  /**
   * onMove receives the visible area whenever the map stops moving or is resized.
   * Popups show popupContent; onPopup reports which pharmacy it should describe (null when closed)
   * and must fill popupContent before returning.
   */
  constructor(
    container: HTMLElement,
    private popupContent: HTMLElement,
    onMove: (bounds: Bounds) => void,
    private onPopup: (id: string | null) => void,
  ) {
    this.map = new MapLibre({
      container,
      style: minimalStyle() as never, // the style-spec types aren't exported by maplibre-gl
      center: ATHENS,
      zoom: 12,
      maxZoom: 19,
    });
    this.map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    this.popup.on("close", () => {
      this.popupId = null;
      this.onPopup(null);
    });
    const reportBounds = () => {
      const b = this.map.getBounds();
      onMove({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    // Report only once the map has settled. A scroll-wheel zoom, pinch or pan with inertia fires
    // several moveend events mid-gesture; waiting for a quiet moment keeps the list from jumping.
    const reportWhenSettled = () => {
      clearTimeout(this.settle);
      this.settle = setTimeout(() => {
        if (!this.map.isMoving()) reportBounds();
      }, SETTLE_MS);
    };
    this.map.on("movestart", () => clearTimeout(this.settle));
    this.map.on("moveend", reportWhenSettled);
    this.map.on("resize", reportWhenSettled);
    this.map.on("load", () => {
      this.map.addSource("pharmacies", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      this.map.addSource("you", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      this.map.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      this.map.addSource("street", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      for (const [s, color] of Object.entries(MARKER_COLORS)) {
        this.map.addImage(`cross-${s}`, crossImage(color), { pixelRatio: 2 });
      }
      // The chosen street, a little wider than the street itself; under the names, so they stay legible.
      this.map.addLayer(
        {
          id: "street",
          type: "line",
          source: "street",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": STREET_COLOR,
            "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 2, 16, 12, 19, 36],
          },
        },
        "street-names",
      );
      this.map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": PLACE_COLOR, "fill-opacity": 0.08 } });
      this.map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": PLACE_COLOR, "line-width": 1.5, "line-opacity": 0.6 },
      });
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
        // Closed pharmacies stay in the background.
        paint: { "icon-opacity": ["match", ["get", "icon"], "cross-closed", 0.45, 1] },
      });
      this.map.addLayer({
        id: "you",
        type: "circle",
        source: "you",
        paint: { "circle-color": PLACE_COLOR, "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
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

  /** Show the results and the place filter's marks; camera, if given, moves the map afterwards. */
  update(results: Result[], now: number, marks: PlaceMarks, lang: Lang, camera: Camera | null): void {
    if (!this.ready) {
      // Only the latest data matters, but don't lose a camera move requested by an earlier call.
      this.pendingCamera = camera ?? this.pendingCamera;
      this.pending = () => this.update(results, now, marks, lang, this.pendingCamera);
      return;
    }
    const { origin, radiusKm, street } = marks;
    this.pendingCamera = null;
    this.origin = origin;
    this.results = new Map(results.map((r) => [r.pharmacy.id, r]));
    // Keep an open popup while its pharmacy is still listed; its content follows the results.
    if (this.popupId && !this.results.has(this.popupId)) this.popup.remove();

    if (this.lang !== lang) {
      this.lang = lang;
      this.map.setLayoutProperty("street-names", "text-field", streetName(lang) as never);
    }

    const features = results
      .filter((r) => r.pharmacy.lat !== null && r.pharmacy.lng !== null)
      .map((r) => {
        const s = status(r, now);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [r.pharmacy.lng!, r.pharmacy.lat!] },
          properties: { id: r.pharmacy.id, icon: `cross-${s}`, sort: MARKER_ORDER[s] },
        };
      });
    (this.map.getSource("pharmacies") as GeoJSONSource).setData({ type: "FeatureCollection", features });
    (this.map.getSource("you") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: origin ? [{ type: "Feature", geometry: { type: "Point", coordinates: [origin.lng, origin.lat] }, properties: {} }] : [],
    });
    (this.map.getSource("radius") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        origin
          ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [circlePolygon(origin, radiusKm)] }, properties: {} }]
          : [],
    });
    (this.map.getSource("street") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: street ? [{ type: "Feature", geometry: { type: "MultiLineString", coordinates: street }, properties: {} }] : [],
    });

    if (camera?.fit === "athens") {
      this.map.jumpTo({ center: ATHENS, zoom: 12 });
    } else if (camera) {
      const { west, south, east, north } = camera.fit;
      this.fitBox(new LngLatBounds([west, south], [east, north]), camera.animate);
    }
  }

  /** Zoom so that every pharmacy on duty (or else every result) and the origin are visible. */
  /** animate: fly there (user actions like "Show all"); otherwise jump (first load). */
  fitResults(animate = false): void {
    const all = [...this.results.values()];
    const open = all.filter(onDuty);
    const bounds = new LngLatBounds();
    for (const { pharmacy: p } of open.length ? open : all) {
      if (p.lat !== null && p.lng !== null) bounds.extend([p.lng, p.lat]);
    }
    if (this.origin) bounds.extend([this.origin.lng, this.origin.lat]);
    if (bounds.isEmpty()) return;
    this.fitBox(bounds, animate);
  }

  private fitBox(bounds: LngLatBounds, animate: boolean): void {
    this.map.fitBounds(bounds, { padding: 40, maxZoom: 15, ...(animate ? { maxDuration: MAX_FLIGHT_MS } : { duration: 0 }) });
  }

  focus(id: string): void {
    // Before the style has loaded the map doesn't know the results yet (see update).
    if (!this.ready) {
      this.map.once("load", () => this.focus(id));
      return;
    }
    const p = this.results.get(id)?.pharmacy;
    if (!p || p.lat === null || p.lng === null) return;
    // Fly instead of jumping so the user can follow where the map goes; open the popup on arrival
    // (or wherever the flight ends if the user interrupts it).
    this.popup.remove();
    this.map.once("moveend", () => this.openPopup(id));
    this.map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(this.map.getZoom(), 15), maxDuration: MAX_FLIGHT_MS });
  }

  /** MapLibre must re-measure after its container changes from hidden to visible. */
  resize(): void {
    this.map.resize();
  }

  destroy(): void {
    clearTimeout(this.settle);
    this.map.remove();
  }

  private openPopup(id: string): void {
    const p = this.results.get(id)?.pharmacy;
    if (!p || p.lat === null || p.lng === null) return;
    this.popup.remove();
    // Fill the content before the popup measures itself (addTo picks the side that fits).
    this.popupId = id;
    this.onPopup(id);
    this.popup.setLngLat([p.lng, p.lat]).setDOMContent(this.popupContent).addTo(this.map);
  }
}
