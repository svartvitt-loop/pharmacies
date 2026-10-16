import type { Address } from "./filter";
import { circleBounds, distanceKm, padBounds, type Bounds, type Line } from "./geo";
import type { Lang } from "./i18n";

// Photon (komoot): an OpenStreetMap geocoder made for search-as-you-type, free and without a key.
// What the user types is sent to it (docs/decisions.md D36).
const PHOTON = "https://photon.komoot.io/api/";
const ATHENS = { lat: 37.9838, lng: 23.7275 }; // results nearer the centre rank higher
const MARGIN_KM = 5; // around the pharmacies, so addresses at the edge of Attica are found

// Nominatim (OpenStreetMap's geocoder) gives the shape of a chosen street: one request when a street
// is picked, within its usage policy (D37). It returns each OSM way of the street separately.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const STREET_BOX_KM = 5; // look for the street's ways this far around the chosen point
const STREET_MAX_WAYS = 40; // Nominatim's maximum

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Partial<
    Record<"name" | "street" | "housenumber" | "district" | "locality" | "city" | "type" | "osm_type", string> & {
      osm_id: number;
    }
  >;
}

/** Addresses matching a query, within `bounds` (the pharmacies' box) when known. */
export async function searchAddress(query: string, lang: Lang, bounds: Bounds | null, signal: AbortSignal): Promise<Address[]> {
  const q = new URLSearchParams({
    q: query,
    limit: "6",
    lang: lang === "en" ? "en" : "default", // "default": the local (Greek) names
    lat: String(ATHENS.lat),
    lon: String(ATHENS.lng),
  });
  if (bounds) {
    const b = padBounds(bounds, MARGIN_KM);
    q.set("bbox", [b.west, b.south, b.east, b.north].map((n) => n.toFixed(4)).join(","));
  }
  const response = await fetch(`${PHOTON}?${q}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parsePhoton(await response.json());
}

/** Photon's GeoJSON as labelled points, e.g. "Σκουφά 10, Κολωνάκι"; repeated labels are dropped. */
export function parsePhoton(json: { features?: PhotonFeature[] }): Address[] {
  const seen = new Set<string>();
  const addresses: Address[] = [];
  for (const { geometry, properties: p = {} } of json.features ?? []) {
    const [lng, lat] = geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : undefined;
    const parts = [p.name, street, p.district ?? p.locality ?? p.city].filter((part, i, all): part is string => !!part && all.indexOf(part) === i);
    const label = parts.join(", ");
    if (!label || seen.has(label)) continue;
    seen.add(label);
    // A street as a whole (not a house on it) is an OSM way; remember it to draw the street.
    const way = p.type === "street" && p.osm_type === "W" && !p.housenumber ? p.osm_id : undefined;
    addresses.push(way ? { label, lat, lng, way } : { label, lat, lng });
  }
  return addresses;
}

/** The name of a street address: the first part of its label, as parsePhoton builds it. */
export function streetName(address: Address): string {
  return address.label.split(",")[0].trim();
}

/** The whole street a street address is on, as lines (see connectedStreet). */
export async function fetchStreet(address: Address, signal: AbortSignal): Promise<Line[]> {
  const box = circleBounds(address, STREET_BOX_KM);
  const q = new URLSearchParams({
    q: streetName(address),
    format: "jsonv2",
    layer: "address",
    polygon_geojson: "1",
    dedupe: "0", // every way of the street, not one per street
    limit: String(STREET_MAX_WAYS),
    viewbox: [box.west, box.north, box.east, box.south].map((n) => n.toFixed(4)).join(","),
    bounded: "1",
  });
  const response = await fetch(`${NOMINATIM}?${q}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return connectedStreet(await response.json(), address);
}

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  category?: string;
  geojson?: { type?: string; coordinates?: unknown };
}

/**
 * Of the ways Nominatim found by the street's name, the chosen one (address.way, or else the one
 * nearest the address) and every way connected to it through shared points, directly or through
 * others. That leaves out namesakes elsewhere in the search box.
 */
export function connectedStreet(places: NominatimPlace[], address: Address): Line[] {
  const ways = places
    .filter((p) => p.category === "highway" && p.osm_type === "way" && p.geojson?.type === "LineString")
    .map((p) => ({ id: p.osm_id, line: p.geojson!.coordinates as Line }));
  if (!ways.length) return [];
  const gap = (line: Line) => Math.min(...line.map(([lng, lat]) => distanceKm(address, { lat, lng })));
  const seed = ways.find((w) => w.id === address.way) ?? ways.reduce((a, b) => (gap(b.line) < gap(a.line) ? b : a));

  const key = ([lng, lat]: [number, number]) => `${lng},${lat}`;
  const points = new Set(seed.line.map(key));
  const street = [seed.line];
  let rest = ways.filter((w) => w !== seed);
  for (let grew = true; grew; ) {
    const joining = rest.filter((w) => w.line.some((p) => points.has(key(p))));
    for (const w of joining) {
      street.push(w.line);
      w.line.forEach((p) => points.add(key(p)));
    }
    rest = rest.filter((w) => !joining.includes(w));
    grew = joining.length > 0;
  }
  return street;
}
