import { describe, expect, it } from "vitest";
import { boundsOf, circleBounds, circlePolygon, distanceKm, padBounds } from "./geo";

const ATHENS = { lat: 37.98, lng: 23.73 };

describe("circleBounds", () => {
  it("reaches the radius on each side, east and west further in degrees away from the equator", () => {
    const b = circleBounds(ATHENS, 2);
    expect(distanceKm(ATHENS, { lat: b.north, lng: ATHENS.lng })).toBeCloseTo(2, 1);
    expect(distanceKm(ATHENS, { lat: ATHENS.lat, lng: b.east })).toBeCloseTo(2, 1);
    expect(ATHENS.lat - b.south).toBeCloseTo(b.north - ATHENS.lat, 10);
    expect(b.east - ATHENS.lng).toBeGreaterThan(b.north - ATHENS.lat);
  });
});

describe("circlePolygon", () => {
  it("is a closed ring of points on the circle", () => {
    const ring = circlePolygon(ATHENS, 5, 32);
    expect(ring).toHaveLength(33);
    expect(ring[32]).toEqual(ring[0]);
    for (const [lng, lat] of ring) expect(distanceKm(ATHENS, { lat, lng })).toBeCloseTo(5, 1);
  });
});

describe("boundsOf", () => {
  it("is the box around the points with coordinates", () => {
    const points = [
      { lat: 38, lng: 23.7 },
      { lat: null, lng: null },
      { lat: 37.9, lng: 23.8 },
    ];
    expect(boundsOf(points)).toEqual({ west: 23.7, south: 37.9, east: 23.8, north: 38 });
  });

  it("is null without any coordinates", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lat: null, lng: null }])).toBeNull();
  });
});

describe("padBounds", () => {
  it("grows the box on every side", () => {
    const b = padBounds({ west: 23.7, south: 37.9, east: 23.8, north: 38 }, 5);
    expect(distanceKm({ lat: 38, lng: 23.8 }, { lat: b.north, lng: 23.8 })).toBeCloseTo(5, 1);
    expect(distanceKm({ lat: 37.9, lng: 23.7 }, { lat: 37.9, lng: b.west })).toBeCloseTo(5, 1);
  });
});
