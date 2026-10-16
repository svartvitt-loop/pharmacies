import { describe, expect, it } from "vitest";
import { parsePhoton } from "./geocode";

const feature = (properties: Record<string, string>, coordinates: [number, number] = [23.7423, 37.9779]) => ({
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
