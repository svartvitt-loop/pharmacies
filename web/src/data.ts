import { searchKey } from "./greek";

/** duties.json as the scraper writes it (docs/architecture.md). */
export interface RawDataset {
  generatedAt: string;
  source: string;
  dates: string[];
  pharmacies: { id: string; name: string; address: string; area: string; phone: string; lat: number | null; lng: number | null }[];
  duties: { p: string; date: string; hours: string; intervals: [string, string][] }[];
}

export interface Interval {
  start: number;
  end: number;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  area: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  intervals: Interval[];
}

export interface Area {
  name: string;
  key: string;
}

export interface Dataset {
  generatedAt: number;
  dates: string[];
  pharmacies: Pharmacy[];
  areas: Area[];
}

export async function loadDataset(): Promise<Dataset> {
  const response = await fetch("data/duties.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseDataset(await response.json());
}

/** Pharmacies with their duty intervals as sorted epoch-ms ranges; those without any duty are left out. */
export function parseDataset(raw: RawDataset): Dataset {
  const byId = new Map<string, Pharmacy>();
  for (const p of raw.pharmacies) byId.set(p.id, { ...p, intervals: [] });
  for (const duty of raw.duties) {
    const pharmacy = byId.get(duty.p);
    if (!pharmacy) continue;
    for (const [start, end] of duty.intervals) {
      pharmacy.intervals.push({ start: Date.parse(start), end: Date.parse(end) });
    }
  }
  const pharmacies = [...byId.values()].filter((p) => p.intervals.length);
  pharmacies.forEach((p) => p.intervals.sort((a, b) => a.start - b.start));

  const areas = [...new Set(pharmacies.map((p) => p.area))]
    .sort((a, b) => a.localeCompare(b, "el"))
    .map((name) => ({ name, key: searchKey(name) }));

  return { generatedAt: Date.parse(raw.generatedAt), dates: raw.dates, pharmacies, areas };
}
