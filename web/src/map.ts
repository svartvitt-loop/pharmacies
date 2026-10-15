import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { t } from "./i18n";
import { directionsUrl, display, el, intervalText, status, statusText } from "./render";
import type { LatLng, Result } from "./state";

const ATHENS: L.LatLngTuple = [37.9838, 23.7275];
const COLORS = { open: "#15803d", closing: "#d97706", later: "#2563eb" } as const;

export class PharmacyMap {
  private map: L.Map;
  private markers = L.layerGroup();
  private byId = new Map<string, L.CircleMarker>();
  private you: L.CircleMarker | null = null;

  constructor(container: HTMLElement) {
    this.map = L.map(container, { zoomControl: true }).setView(ATHENS, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
    this.markers.addTo(this.map);
  }

  /** fit: "results" zooms to the markers, "athens" re-centres on the city (unfiltered view), false keeps the view. */
  update(results: Result[], now: number, near: LatLng | null, fit: "results" | "athens" | false): void {
    this.markers.clearLayers();
    this.byId.clear();
    // Draw "opens later" first so open pharmacies end up on top.
    const ordered = [...results].sort((a, b) => Number(!!a.current) - Number(!!b.current));
    for (const result of ordered) {
      const p = result.pharmacy;
      if (p.lat === null || p.lng === null) continue;
      const color = COLORS[status(result, now)];
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      }).bindPopup(() => popup(result, now), { maxWidth: 280 });
      marker.bindTooltip(display(p.name), { direction: "top", offset: [0, -8] });
      this.markers.addLayer(marker);
      this.byId.set(p.id, marker);
    }

    this.you?.remove();
    this.you = near
      ? L.circleMarker([near.lat, near.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#7c3aed", fillOpacity: 1 })
          .bindTooltip(t("you"))
          .addTo(this.map)
      : null;

    if (fit === "athens") {
      this.map.setView(ATHENS, 12);
    } else if (fit === "results") {
      const points = [...this.byId.values()].map((m) => m.getLatLng());
      if (near) points.push(L.latLng(near.lat, near.lng));
      if (points.length) this.map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
    }
  }

  focus(id: string): void {
    const marker = this.byId.get(id);
    if (!marker) return;
    this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 15));
    marker.openPopup();
  }

  /** Leaflet must re-measure after its container changes from hidden to visible. */
  resize(): void {
    this.map.invalidateSize();
  }
}

function popup(result: Result, now: number): HTMLElement {
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
