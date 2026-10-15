import { describe, expect, it } from "vitest";
import { addDays, athensDate, athensTime, formatClock, parseClock } from "./time";

const at = Date.parse;

describe("athensTime", () => {
  it("uses the Athens offset of the date: +03:00 in summer, +02:00 in winter", () => {
    expect(athensTime("2026-07-01", 8 * 60)).toBe(at("2026-07-01T08:00:00+03:00"));
    expect(athensTime("2026-12-01", 8 * 60)).toBe(at("2026-12-01T08:00:00+02:00"));
  });

  it("defaults to midnight", () => {
    expect(athensTime("2026-10-16")).toBe(at("2026-10-16T00:00:00+03:00"));
  });

  it("runs past 24 h into the next day, across the end of summer time", () => {
    // Greece leaves summer time at 04:00 on 2026-10-25.
    expect(athensTime("2026-10-24", 21 * 60)).toBe(at("2026-10-24T21:00:00+03:00"));
    expect(athensTime("2026-10-24", 32 * 60)).toBe(at("2026-10-25T08:00:00+02:00"));
  });
});

describe("athensDate", () => {
  it("is the Athens calendar day, not the UTC one", () => {
    expect(athensDate(at("2026-10-16T20:59:00Z"))).toBe("2026-10-16");
    expect(athensDate(at("2026-10-16T22:30:00Z"))).toBe("2026-10-17"); // 01:30 in Athens
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("parseClock", () => {
  it("turns HH:MM into minutes after midnight", () => {
    expect(parseClock("00:00")).toBe(0);
    expect(parseClock("22:15")).toBe(22 * 60 + 15);
    expect(parseClock("8")).toBe(8 * 60);
  });
});

describe("formatClock", () => {
  it("shows Athens time on a 24-hour clock", () => {
    expect(formatClock(at("2026-10-16T05:00:00Z"), "en-GB")).toBe("08:00");
    expect(formatClock(at("2026-10-16T21:00:00Z"), "en-GB")).toBe("00:00");
  });
});
