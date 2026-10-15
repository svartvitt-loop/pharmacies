import { describe, expect, it } from "vitest";
import type { Pharmacy } from "./data";
import { filterPharmacies, type When } from "./filter";
import { directionsUrl, distanceText, hoursText, intervalText, statusText } from "./format";
import { i18nFor } from "./i18n";

const at = Date.parse;
const NOON = at("2026-10-16T12:00:00+03:00"); // Friday 16 October, Athens
const en = i18nFor("en");

const pharmacy = (intervals: [string, string][], extra: Partial<Pharmacy> = {}): Pharmacy => ({
  id: "p",
  name: "ΦΑΡΜΑΚΕΙΟ",
  address: "ΑΘΗΝΑΣ 50",
  area: "ΑΘΗΝΑ",
  phone: "",
  lat: 37.98,
  lng: 23.73,
  intervals: intervals.map(([start, end]) => ({ start: at(start), end: at(end) })),
  ...extra,
});

/** The result for one pharmacy, as the list shows it (with "show closed" on). */
function result(intervals: [string, string][], when: When = "now") {
  const filter = { when, date: "2026-10-16", from: "20:00", to: "23:00", areas: [], radiusKm: 0, showClosed: true, near: null };
  return filterPharmacies([pharmacy(intervals)], filter, NOON)[0];
}

describe("statusText", () => {
  it("open now, or closing soon within the hour", () => {
    expect(statusText(result([["2026-10-16T08:00:00+03:00", "2026-10-16T21:00:00+03:00"]]), NOON, en)).toBe(
      "Open now · until 21:00",
    );
    expect(statusText(result([["2026-10-16T08:00:00+03:00", "2026-10-16T12:45:00+03:00"]]), NOON, en)).toBe(
      "Closing soon · until 12:45",
    );
  });

  it("opens later: the day only when it isn't today", () => {
    expect(statusText(result([["2026-10-16T17:00:00+03:00", "2026-10-16T21:00:00+03:00"]], "today"), NOON, en)).toBe(
      "Opens 17:00",
    );
    expect(statusText(result([["2026-10-17T08:00:00+03:00", "2026-10-17T21:00:00+03:00"]], "tomorrow"), NOON, en)).toBe(
      "Opens Sat 17/10 08:00",
    );
  });

  it("not on duty in the window", () => {
    expect(statusText(result([["2026-10-17T08:00:00+03:00", "2026-10-17T21:00:00+03:00"]]), NOON, en)).toBe("Not on duty");
  });
});

describe("intervalText", () => {
  const interval = (start: string, end: string) => intervalText({ start: at(start), end: at(end) }, "en-GB");

  it("marks duties that end the next day with (+1), but not those ending at midnight", () => {
    expect(interval("2026-10-16T08:00:00+03:00", "2026-10-16T21:00:00+03:00")).toBe("Fri 16/10 08:00–21:00");
    expect(interval("2026-10-16T21:00:00+03:00", "2026-10-17T08:00:00+03:00")).toBe("Fri 16/10 21:00–08:00 (+1)");
    expect(interval("2026-10-16T19:00:00+03:00", "2026-10-17T00:00:00+03:00")).toBe("Fri 16/10 19:00–00:00");
  });
});

describe("hoursText", () => {
  it("lists the duties in the window, or the next duty of a closed pharmacy", () => {
    const twoShifts = result(
      [
        ["2026-10-16T08:00:00+03:00", "2026-10-16T14:00:00+03:00"],
        ["2026-10-16T17:00:00+03:00", "2026-10-17T08:00:00+03:00"],
      ],
      "today",
    );
    expect(hoursText(twoShifts, en)).toEqual(["Fri 16/10 08:00–14:00", "Fri 16/10 17:00–08:00 (+1)"]);
    const closed = result([["2026-10-17T08:00:00+03:00", "2026-10-17T21:00:00+03:00"]]);
    expect(hoursText(closed, en)).toEqual(["Next duty: Sat 17/10 08:00–21:00"]);
  });
});

describe("distanceText", () => {
  it("metres below 1 km, else km with one decimal", () => {
    expect(distanceText(0.35)).toBe("350 m");
    expect(distanceText(1.234)).toBe("1.2 km");
  });
});

describe("directionsUrl", () => {
  it("goes to the coordinates, or else to the address", () => {
    expect(directionsUrl(pharmacy([]))).toBe("https://www.google.com/maps/dir/?api=1&destination=37.98%2C23.73");
    expect(directionsUrl(pharmacy([], { lat: null, lng: null }))).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("ΑΘΗΝΑΣ 50, ΑΘΗΝΑ")}`,
    );
  });
});
