import { describe, expect, it } from "vitest";
import { parseDataset, type RawDataset } from "./data";
import { searchKey } from "./greek";

const at = Date.parse;
const p = (id: string, area: string) => ({ id, name: id, address: "", area, phone: "", lat: 37.98, lng: 23.73 });

const raw: RawDataset = {
  generatedAt: "2026-10-16T09:00:00+03:00",
  source: "https://fsa-efimeries.gr/",
  dates: ["2026-10-16", "2026-10-17"],
  pharmacies: [p("pagkrati", "ΠΑΓΚΡΑΤΙ"), p("athina", "ΑΘΗΝΑ"), p("idle", "ΖΩΓΡΑΦΟΥ")],
  duties: [
    {
      p: "athina",
      date: "2026-10-17",
      hours: "8 ΠΡΩΙ - 9 ΒΡΑΔΥ",
      intervals: [["2026-10-17T08:00:00+03:00", "2026-10-17T21:00:00+03:00"]],
    },
    {
      p: "athina",
      date: "2026-10-16",
      hours: "8 ΠΡΩΙ - 2 ΜΕΣΗΜΕΡΙ & 5 ΑΠΟΓΕΥΜΑ - 9 ΒΡΑΔΥ",
      intervals: [
        ["2026-10-16T17:00:00+03:00", "2026-10-16T21:00:00+03:00"],
        ["2026-10-16T08:00:00+03:00", "2026-10-16T14:00:00+03:00"],
      ],
    },
    { p: "pagkrati", date: "2026-10-16", hours: "9 ΒΡΑΔΥ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ", intervals: [["2026-10-16T21:00:00+03:00", "2026-10-17T08:00:00+03:00"]] },
    { p: "idle", date: "2026-10-16", hours: "ΚΛΕΙΣΤΟ", intervals: [] }, // unparseable hours
    { p: "unknown", date: "2026-10-16", hours: "8 ΠΡΩΙ - 9 ΒΡΑΔΥ", intervals: [["2026-10-16T08:00:00+03:00", "2026-10-16T21:00:00+03:00"]] },
  ],
};

describe("parseDataset", () => {
  const dataset = parseDataset(raw);

  it("keeps only pharmacies with a duty interval, ignoring duties of unknown pharmacies", () => {
    expect(dataset.pharmacies.map((ph) => ph.id)).toEqual(["pagkrati", "athina"]);
  });

  it("collects each pharmacy's intervals from all its duties, in time order, as epoch ms", () => {
    const athina = dataset.pharmacies.find((ph) => ph.id === "athina")!;
    expect(athina.intervals).toEqual([
      { start: at("2026-10-16T08:00:00+03:00"), end: at("2026-10-16T14:00:00+03:00") },
      { start: at("2026-10-16T17:00:00+03:00"), end: at("2026-10-16T21:00:00+03:00") },
      { start: at("2026-10-17T08:00:00+03:00"), end: at("2026-10-17T21:00:00+03:00") },
    ]);
  });

  it("lists the areas of those pharmacies alphabetically, with search keys", () => {
    expect(dataset.areas).toEqual([
      { name: "ΑΘΗΝΑ", key: searchKey("ΑΘΗΝΑ") },
      { name: "ΠΑΓΚΡΑΤΙ", key: searchKey("ΠΑΓΚΡΑΤΙ") },
    ]);
  });

  it("passes the dates through and parses the generation time", () => {
    expect(dataset.dates).toEqual(raw.dates);
    expect(dataset.generatedAt).toBe(at("2026-10-16T09:00:00+03:00"));
  });
});
