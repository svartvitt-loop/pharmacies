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
