import type { Address } from "./filter";
import { padBounds, type Bounds } from "./geo";
import type { Lang } from "./i18n";

// Photon (komoot): an OpenStreetMap geocoder made for search-as-you-type, free and without a key.
// What the user types is sent to it (docs/decisions.md D36).
const PHOTON = "https://photon.komoot.io/api/";
const ATHENS = { lat: 37.9838, lng: 23.7275 }; // results nearer the centre rank higher
const MARGIN_KM = 5; // around the pharmacies, so addresses at the edge of Attica are found

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Partial<Record<"name" | "street" | "housenumber" | "district" | "locality" | "city", string>>;
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
    addresses.push({ label, lat, lng });
  }
  return addresses;
}
