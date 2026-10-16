import { describe, expect, it } from "vitest";
import type { Pharmacy } from "./data";
import { circleBounds } from "./geo";
import { filterPharmacies, onDuty, origin, placeFrame, placeKey, status, timeWindow, windowCovered, type Filter } from "./filter";

const at = Date.parse;
const NOON = at("2026-10-16T12:00:00+03:00"); // Friday 16 October, Athens

const filter = (change: Partial<Filter> = {}): Filter => ({
  when: "now",
  date: "2026-10-16",
  from: "20:00",
  to: "23:00",
  place: null,
  areas: [],
  address: null,
  near: null,
  radiusKm: 0,
  showClosed: false,
  ...change,
});

const HERE = { lat: 37.98, lng: 23.73 };
const ADDRESS = { label: "Σκουφά 10, Κολωνάκι", lat: 37.9779, lng: 23.7423 };

function pharmacy(id: string, intervals: [string, string][], extra: Partial<Pharmacy> = {}): Pharmacy {
  return {
    id,
    name: id,
    address: "",
    area: "ΑΘΗΝΑ",
    phone: "",
    lat: 37.98,
    lng: 23.73,
    intervals: intervals.map(([start, end]) => ({ start: at(start), end: at(end) })),
    ...extra,
  };
}

const ids = (pharmacies: Pharmacy[], f: Filter, now = NOON) => filterPharmacies(pharmacies, f, now).map((r) => r.pharmacy.id);

describe("timeWindow", () => {
  it("now and the next 3 hours start at the current time", () => {
    expect(timeWindow(filter({ when: "now" }), NOON)).toEqual([NOON, NOON]);
    expect(timeWindow(filter({ when: "next3h" }), NOON)).toEqual([NOON, at("2026-10-16T15:00:00+03:00")]);
  });

  it("today runs to midnight, tomorrow is the whole next day", () => {
    expect(timeWindow(filter({ when: "today" }), NOON)).toEqual([NOON, at("2026-10-17T00:00:00+03:00")]);
    expect(timeWindow(filter({ when: "tomorrow" }), NOON)).toEqual([
      at("2026-10-17T00:00:00+03:00"),
      at("2026-10-18T00:00:00+03:00"),
    ]);
  });

  it("tonight is 21:00 to 08:00, from now on once it has started", () => {
    expect(timeWindow(filter({ when: "tonight" }), NOON)).toEqual([
      at("2026-10-16T21:00:00+03:00"),
      at("2026-10-17T08:00:00+03:00"),
    ]);
    const late = at("2026-10-16T22:30:00+03:00");
    expect(timeWindow(filter({ when: "tonight" }), late)).toEqual([late, at("2026-10-17T08:00:00+03:00")]);
  });

  it("tonight after midnight is the rest of this night", () => {
    const small = at("2026-10-17T02:00:00+03:00");
    expect(timeWindow(filter({ when: "tonight" }), small)).toEqual([small, at("2026-10-17T08:00:00+03:00")]);
  });

  it("a custom range ending before it starts runs past midnight, also across the DST change", () => {
    const custom = { when: "custom", date: "2026-10-18", from: "22:00", to: "02:00" } as const;
    expect(timeWindow(filter(custom), NOON)).toEqual([at("2026-10-18T22:00:00+03:00"), at("2026-10-19T02:00:00+03:00")]);
    const dst = { when: "custom", date: "2026-10-24", from: "22:00", to: "06:00" } as const;
    expect(timeWindow(filter(dst), NOON)).toEqual([at("2026-10-24T22:00:00+03:00"), at("2026-10-25T06:00:00+02:00")]);
  });
});

describe("filterPharmacies", () => {
  const DAY: [string, string] = ["2026-10-16T08:00:00+03:00", "2026-10-16T21:00:00+03:00"];
  const day = pharmacy("day", [DAY]);
  const night = pharmacy("night", [["2026-10-16T21:00:00+03:00", "2026-10-17T08:00:00+03:00"]]);
  const tomorrow = pharmacy("tomorrow", [["2026-10-17T08:00:00+03:00", "2026-10-17T21:00:00+03:00"]]);
  const all = [tomorrow, night, day];

  it("now: only pharmacies whose duty contains this instant", () => {
    expect(ids(all, filter())).toEqual(["day"]);
  });

  it("ranges match any overlap, but a duty ending as the window starts doesn't", () => {
    expect(ids(all, filter({ when: "tonight" }))).toEqual(["night"]);
    expect(ids(all, filter({ when: "today" }))).toEqual(["day", "night"]);
  });

  it("show closed adds the others after the ones on duty, soonest next duty first", () => {
    const results = filterPharmacies(all, filter({ showClosed: true }), NOON);
    expect(results.map((r) => [r.pharmacy.id, onDuty(r)])).toEqual([
      ["day", true],
      ["night", false],
      ["tomorrow", false],
    ]);
    expect(results[2].next?.start).toBe(at("2026-10-17T08:00:00+03:00"));
  });

  it("keeps only the chosen areas, while the areas filter is the one in use", () => {
    const kypseli = pharmacy("kypseli", [DAY], { area: "ΚΥΨΕΛΗ" });
    expect(ids([day, kypseli], filter({ place: "areas", areas: ["ΚΥΨΕΛΗ"] }))).toEqual(["kypseli"]);
    expect(ids([day, kypseli], filter({ place: "areas", areas: [] }))).toEqual(["day", "kypseli"]);
    // The chosen areas are kept while another place filter applies, but they don't filter.
    expect(ids([day, kypseli], filter({ place: null, areas: ["ΚΥΨΕΛΗ"] }))).toEqual(["day", "kypseli"]);
    expect(ids([day, kypseli], filter({ place: "me", areas: ["ΚΥΨΕΛΗ"] }))).toEqual(["day", "kypseli"]);
  });

  it("puts pharmacies open now first, then by start", () => {
    const later = pharmacy("later", [["2026-10-16T15:00:00+03:00", "2026-10-16T20:00:00+03:00"]]);
    const sinceTen = pharmacy("sinceTen", [["2026-10-16T10:00:00+03:00", "2026-10-16T14:00:00+03:00"]]);
    expect(ids([later, sinceTen, day], filter({ when: "today" }))).toEqual(["day", "sinceTen", "later"]);
  });

  it("near me: sorts by distance and applies the radius; 0 is any distance", () => {
    const near = pharmacy("near", [DAY], { lat: 37.99 }); // about 1.1 km north
    const far = pharmacy("far", [DAY], { lat: 38.03 }); // about 5.6 km north
    const results = filterPharmacies([far, near, day], filter({ place: "me", near: HERE }), NOON);
    expect(results.map((r) => r.pharmacy.id)).toEqual(["day", "near", "far"]);
    expect(results[1].distanceKm).toBeCloseTo(1.11, 1);
    expect(ids([far, near, day], filter({ place: "me", near: HERE, radiusKm: 2 }))).toEqual(["day", "near"]);
  });

  it("address: measures from the address instead of the user's position", () => {
    const skoufa = pharmacy("skoufa", [DAY], { lat: 37.978, lng: 23.742 });
    const results = filterPharmacies([day, skoufa], filter({ place: "address", address: ADDRESS, near: HERE, radiusKm: 1 }), NOON);
    expect(results.map((r) => r.pharmacy.id)).toEqual(["skoufa"]);
    expect(results[0].distanceKm).toBeLessThan(0.1);
  });

  it("the radius and distances apply only with near me or an address", () => {
    const far = pharmacy("far", [DAY], { lat: 38.03 });
    const results = filterPharmacies([far], filter({ place: "areas", near: HERE, address: ADDRESS, radiusKm: 1 }), NOON);
    expect(results.map((r) => [r.pharmacy.id, r.distanceKm])).toEqual([["far", null]]);
  });

  it("near me keeps pharmacies without coordinates, whatever the radius", () => {
    const unknown = pharmacy("unknown", [DAY], { lat: null, lng: null });
    const [result] = filterPharmacies([unknown], filter({ place: "me", near: HERE, radiusKm: 1 }), NOON);
    expect(result.pharmacy.id).toBe("unknown");
    expect(result.distanceKm).toBeNull();
  });
});

describe("place filters", () => {
  it("origin is the user's position for near me, the address for an address, otherwise none", () => {
    const both = { near: HERE, address: ADDRESS };
    expect(origin(filter({ place: "me", ...both }))).toBe(HERE);
    expect(origin(filter({ place: "address", ...both }))).toBe(ADDRESS);
    expect(origin(filter({ place: "areas", ...both }))).toBeNull();
    expect(origin(filter({ place: null, ...both }))).toBeNull();
    expect(origin(filter({ place: "me" }))).toBeNull(); // not located yet
  });

  it("frames the radius, or every result with any distance", () => {
    expect(placeFrame(filter({ place: "me", near: HERE, radiusKm: 2 }), [])).toEqual(circleBounds(HERE, 2));
    expect(placeFrame(filter({ place: "address", address: ADDRESS, radiusKm: 0 }), [])).toBe("results");
    expect(placeFrame(filter({ place: "me", radiusKm: 2 }), [])).toBeNull();
    expect(placeFrame(filter(), [])).toBeNull();
  });

  it("frames all the chosen areas' pharmacies, whether on duty or not", () => {
    const a = pharmacy("a", [], { area: "Α", lat: 38.0, lng: 23.7 });
    const b = pharmacy("b", [], { area: "Β", lat: 37.9, lng: 23.8 });
    const c = pharmacy("c", [], { area: "Γ", lat: 37.5, lng: 23.0 });
    expect(placeFrame(filter({ place: "areas", areas: ["Α", "Β"] }), [a, b, c])).toEqual({
      west: 23.7,
      south: 37.9,
      east: 23.8,
      north: 38.0,
    });
    expect(placeFrame(filter({ place: "areas", areas: [] }), [a, b, c])).toBeNull();
  });

  it("the key changes with the place filter in use, and only with it", () => {
    const base = filter({ place: "me", near: HERE, radiusKm: 2, areas: ["Α"] });
    expect(placeKey({ ...base, when: "tomorrow", showClosed: true, areas: ["Β"] })).toBe(placeKey(base));
    expect(placeKey({ ...base, radiusKm: 5 })).not.toBe(placeKey(base));
    expect(placeKey({ ...base, near: { lat: 38, lng: 23.7 } })).not.toBe(placeKey(base));
    expect(placeKey({ ...base, place: "address", address: ADDRESS })).not.toBe(placeKey(base));
    expect(placeKey({ ...base, place: "areas" })).not.toBe(placeKey({ ...base, place: "areas", areas: ["Α", "Β"] }));
  });
});

describe("status", () => {
  const statusAt = (end: string, when: Filter["when"] = "now") =>
    status(filterPharmacies([pharmacy("p", [["2026-10-16T08:00:00+03:00", end]])], filter({ when, showClosed: true }), NOON)[0], NOON);

  it("open, or closing within the hour", () => {
    expect(statusAt("2026-10-16T13:01:00+03:00")).toBe("open");
    expect(statusAt("2026-10-16T13:00:00+03:00")).toBe("closing");
  });

  it("later when on duty in the window but not now, closed when not in the window", () => {
    const later = pharmacy("later", [["2026-10-16T21:00:00+03:00", "2026-10-17T08:00:00+03:00"]]);
    const [result] = filterPharmacies([later], filter({ when: "tonight", showClosed: true }), NOON);
    expect(status(result, NOON)).toBe("later");
    expect(statusAt("2026-10-16T11:00:00+03:00")).toBe("closed");
  });
});

describe("windowCovered", () => {
  const dates = ["2026-10-15", "2026-10-16", "2026-10-17"];

  it("is true while the window ends within the last published date", () => {
    expect(windowCovered(dates, filter({ when: "tomorrow" }), NOON)).toBe(true);
    expect(windowCovered(dates, filter({ when: "custom", date: "2026-10-18" }), NOON)).toBe(false);
  });

  it("is true when there are no dates to judge by", () => {
    expect(windowCovered([], filter({ when: "tomorrow" }), NOON)).toBe(true);
  });
});
