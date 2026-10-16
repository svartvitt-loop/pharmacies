export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

/** Points without coordinates count as inside, so they are never hidden by a map area. */
export function inBounds(point: { lat: number | null; lng: number | null }, b: Bounds): boolean {
  if (point.lat === null || point.lng === null) return true;
  return point.lat >= b.south && point.lat <= b.north && point.lng >= b.west && point.lng <= b.east;
}

const KM_PER_DEGREE = 111.32; // along a meridian, and along the equator

/** The smallest box around a circle of `km` around `center`. */
export function circleBounds(center: LatLng, km: number): Bounds {
  const dLat = km / KM_PER_DEGREE;
  const dLng = km / (KM_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  return { west: center.lng - dLng, south: center.lat - dLat, east: center.lng + dLng, north: center.lat + dLat };
}

/** A circle of `km` around `center` as a closed GeoJSON ring of [lng, lat] positions. */
export function circlePolygon(center: LatLng, km: number, steps = 64): [number, number][] {
  const { east, north } = circleBounds(center, km);
  const rLng = east - center.lng;
  const rLat = north - center.lat;
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([center.lng + rLng * Math.cos(a), center.lat + rLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return ring;
}

/** The box around the points that have coordinates; null if none have. */
export function boundsOf(points: Iterable<{ lat: number | null; lng: number | null }>): Bounds | null {
  let b: Bounds | null = null;
  for (const { lat, lng } of points) {
    if (lat === null || lng === null) continue;
    b = b
      ? { west: Math.min(b.west, lng), south: Math.min(b.south, lat), east: Math.max(b.east, lng), north: Math.max(b.north, lat) }
      : { west: lng, south: lat, east: lng, north: lat };
  }
  return b;
}

/** Bounds grown by `km` on every side. */
export function padBounds(b: Bounds, km: number): Bounds {
  const sw = circleBounds({ lat: b.south, lng: b.west }, km);
  const ne = circleBounds({ lat: b.north, lng: b.east }, km);
  return { west: sw.west, south: sw.south, east: ne.east, north: ne.north };
}
