import { describe, expect, it } from "vitest";
import { connectedStreet, parsePhoton, streetName } from "./geocode";

const feature = (properties: Record<string, string | number>, coordinates: [number, number] = [23.7423, 37.9779]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties,
});

describe("parsePhoton", () => {
  it("labels a house by street, number and district, with [lng, lat] turned into lat/lng", () => {
    const [address] = parsePhoton({ features: [feature({ street: "Σκουφά", housenumber: "10", district: "Κολωνάκι", city: "Αθήνα" })] });
    expect(address).toEqual({ label: "Σκουφά 10, Κολωνάκι", lat: 37.9779, lng: 23.7423 });
  });

  it("labels a named place with its street, and a street by its name and city", () => {
    const addresses = parsePhoton({
      features: [
        feature({ name: "Μέγαρο Μουσικής", street: "Βασιλίσσης Σοφίας", city: "Αθήνα" }),
        feature({ name: "Σκουφά", city: "Αθήνα" }),
      ],
    });
    expect(addresses.map((a) => a.label)).toEqual(["Μέγαρο Μουσικής, Βασιλίσσης Σοφίας, Αθήνα", "Σκουφά, Αθήνα"]);
  });

  it("drops repeated labels, repeated parts and features without a point or a name", () => {
    const addresses = parsePhoton({
      features: [
        feature({ name: "Σκουφά", street: "Σκουφά", city: "Αθήνα" }),
        feature({ name: "Σκουφά", city: "Αθήνα" }, [23.743, 37.978]),
        { properties: { name: "Χωρίς σημείο" } },
        feature({}),
      ],
    });
    expect(addresses.map((a) => a.label)).toEqual(["Σκουφά, Αθήνα"]);
  });

  it("copes with an empty response", () => {
    expect(parsePhoton({})).toEqual([]);
  });
});

describe("parsePhoton: whole streets", () => {
  it("keeps the OSM way of a street result, so the street can be drawn", () => {
    const [street] = parsePhoton({
      features: [feature({ name: "Σκουφά", district: "Κολωνάκι", type: "street", osm_type: "W", osm_id: 1053955141 })],
    });
    expect(street).toEqual({ label: "Σκουφά, Κολωνάκι", lat: 37.9779, lng: 23.7423, way: 1053955141 });
  });

  it("leaves it out for a house, or a street that isn't a way", () => {
    const addresses = parsePhoton({
      features: [
        feature({ street: "Σκουφά", housenumber: "10", type: "house", osm_type: "N", osm_id: 1 }),
        feature({ name: "Πλατεία Κολωνακίου", type: "street", osm_type: "R", osm_id: 2 }),
      ],
    });
    expect(addresses.map((a) => a.way)).toEqual([undefined, undefined]);
  });
});

describe("connectedStreet", () => {
  // Nominatim's answer for "Σκουφά" around Kolonaki (end points only): five ways of the street in
  // Kolonaki, chained end to end, and a namesake in Dafni.
  const way = (id: number, line: [number, number][], extra: object = {}) => ({
    osm_type: "way",
    osm_id: id,
    category: "highway",
    geojson: { type: "LineString", coordinates: line },
    ...extra,
  });
  const places = [
    way(299657353, [[23.7388529, 37.9794358], [23.7406388, 37.9771942]]),
    way(762793106, [[23.7369667, 37.9817174], [23.7380486, 37.9804255]]),
    way(571469976, [[23.7363098, 37.9825444], [23.7369667, 37.9817174]]),
    way(31623891, [[23.7304084, 37.9512858], [23.729462, 37.9517326]]), // Dafni
    way(1053955141, [[23.7384449, 37.9799425], [23.7388529, 37.9794358]]),
    way(1053955140, [[23.7380486, 37.9804255], [23.7384449, 37.9799425]]),
  ];
  const skoufa = { label: "Σκουφά, Κολωνάκι", lat: 37.9797, lng: 23.7386 };

  it("follows the street from the chosen way through shared points, leaving namesakes out", () => {
    const lines = connectedStreet(places, { ...skoufa, way: 1053955141 });
    expect(lines).toHaveLength(5);
    expect(lines[0]).toEqual(places[4].geojson.coordinates);
    expect(lines.flat()).not.toContainEqual([23.7304084, 37.9512858]);
  });

  it("starts from the way nearest the address when the chosen way isn't among them", () => {
    expect(connectedStreet(places, { ...skoufa, way: 1 })).toHaveLength(5);
    const dafni = { label: "Σκουφά, Δάφνη", lat: 37.9515, lng: 23.73 };
    expect(connectedStreet(places, dafni)).toEqual([places[3].geojson.coordinates]);
  });

  it("ignores places that aren't street lines", () => {
    const others = [
      way(1, [[23.7, 37.9], [23.71, 37.91]], { category: "railway" }),
      way(2, [[23.7, 37.9], [23.71, 37.91]], { osm_type: "relation" }),
      { osm_type: "way", osm_id: 3, category: "highway", geojson: { type: "Polygon", coordinates: [] } },
    ];
    expect(connectedStreet(others, skoufa)).toEqual([]);
    expect(connectedStreet([], skoufa)).toEqual([]);
  });
});

describe("streetName", () => {
  it("is the first part of the label", () => {
    expect(streetName({ label: "Σκουφά, Κολωνάκι", lat: 0, lng: 0 })).toBe("Σκουφά");
  });
});
