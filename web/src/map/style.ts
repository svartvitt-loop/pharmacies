import type { Lang } from "../i18n";

// Always a light, colourful map (also in dark mode), in the spirit of classic street maps.
const PALETTE = {
  background: "#f8f4ec",
  water: "#8ccbf2",
  casing: "#d3cab8",
  text: "#2b2b2b",
  halo: "#ffffff",
};
const ROAD_COLORS: Record<string, string> = {
  motorway: "#e0c5af",
  trunk: "#e6d1bb",
  primary: "#ede1c5",
  secondary: "#f4edd8",
};
const ROAD_FILL = "#ffffff"; // tertiary, minor, service, pedestrian

const ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"];
// Line widths in pixels at zoom 10 / 16 / 19.
const ROAD_WIDTHS: Record<string, [number, number, number]> = {
  motorway: [2, 14, 40],
  trunk: [1.8, 13, 38],
  primary: [1.5, 12, 36],
  secondary: [1.1, 11, 32],
  tertiary: [0.7, 9, 28],
  minor: [0.3, 7, 24],
  service: [0.1, 4, 14],
};
const PEDESTRIAN_WIDTHS: [number, number, number] = [0.3, 5, 18];
const ROAD_RANK = ["service", "minor", "tertiary", "secondary", "primary", "trunk", "motorway"];

/** A MapLibre "match" on the road class. */
function byClass<T>(values: Record<string, T>, fallback: T): unknown[] {
  return ["match", ["get", "class"], ...Object.entries(values).flat(), fallback];
}

function roadWidth(extra = 0): unknown[] {
  const stop = (i: 0 | 1 | 2) =>
    byClass(Object.fromEntries(Object.entries(ROAD_WIDTHS).map(([k, w]) => [k, w[i] + extra])), PEDESTRIAN_WIDTHS[i] + extra);
  return ["interpolate", ["exponential", 1.6], ["zoom"], 10, stop(0), 16, stop(1), 19, stop(2)];
}

/** Street names in Greek, or OpenMapTiles' Latin transliteration in the English UI. */
export function streetName(lang: Lang): unknown {
  return lang === "en" ? ["coalesce", ["get", "name:latin"], ["get", "name"]] : ["get", "name"];
}

function streetLayer(id: string) {
  return {
    id,
    type: "line",
    source: "osm",
    "source-layer": "transportation",
    filter: ["any", ["in", ["get", "class"], ["literal", ROAD_CLASSES]], ["==", ["get", "subclass"], "pedestrian"]],
    // Bigger roads are drawn above smaller ones.
    layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["index-of", ["get", "class"], ["literal", ROAD_RANK]] },
  };
}

/** A deliberately minimal style: background, water, streets and street names. Nothing else. */
export function minimalStyle() {
  return {
    version: 8 as const,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "vector" as const,
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": PALETTE.background } },
      { id: "water", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": PALETTE.water } },
      { ...streetLayer("street-casing"), paint: { "line-color": PALETTE.casing, "line-width": roadWidth(1.5) } },
      {
        ...streetLayer("streets"),
        paint: { "line-color": byClass(ROAD_COLORS, ROAD_FILL), "line-width": roadWidth() },
      },
      {
        id: "street-names",
        type: "symbol",
        source: "osm",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "symbol-placement": "line",
          "text-field": streetName("el"),
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.5, 17, 13.5],
        },
        paint: { "text-color": PALETTE.text, "text-halo-color": PALETTE.halo, "text-halo-width": 2 },
      },
    ],
  };
}
