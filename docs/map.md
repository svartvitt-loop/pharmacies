# Map

## Stack

- **MapLibre GL JS 6** (`maplibre-gl`), WebGL vector rendering.
- **OpenFreeMap** vector tiles (`https://tiles.openfreemap.org/planet`, OpenMapTiles schema) and its
  glyph server for fonts (`Noto Sans Regular`, including Greek). Free, **no API key**, no account.
- A **custom style written in code** (`minimalStyle()` in `web/src/map/style.ts`) instead of a hosted
  style. The marker images are in `map/markers.ts`, the map class in `map/index.ts`.

History: the first version used Leaflet with standard OpenStreetMap raster tiles. When the user asked
for a simpler map ("only street names and the pharmacies") raster tiles could not do that, and the
obvious minimal raster option (CARTO Positron) turned out to require an API key. See
[decisions.md](decisions.md) D19–D20 and [problems.md](problems.md).

## The style: only what's needed

Layers, bottom to top:

| Layer | Source layer | Notes |
|---|---|---|
| `background` | — | warm off-white `#f8f4ec` |
| `water` | `water` | blue `#8ccbf2`; kept so the coast and sea read correctly |
| `street-casing` | `transportation` | thin outline `#d3cab8`, 1.5 px wider than the street |
| `streets` | `transportation` | colour and width by road class; bigger roads drawn on top (`line-sort-key`) |
| `street-names` | `transportation_name` | from zoom 13; dark `#2b2b2b` text with a white halo |
| `radius-fill`, `radius-line` | GeoJSON (added at runtime) | the place filter's radius: purple `#7c3aed` at 8 % fill, 1.5 px outline |
| `pharmacies` | GeoJSON (added at runtime) | cross icons, see below |
| `you` | GeoJSON (added at runtime) | purple dot: the user's position (Near me) or the chosen address |

Deliberately **left out**: buildings, land use, parks, POIs/shops, place and neighbourhood labels,
house numbers, railways, boundaries. Included road classes: motorway, trunk, primary, secondary,
tertiary, minor, service, plus pedestrian streets (important in central Athens).

Road widths (px at zoom 10 / 16 / 19), exponential interpolation:
motorway 2/14/40, trunk 1.8/13/38, primary 1.5/12/36, secondary 1.1/11/32, tertiary 0.7/9/28,
minor 0.3/7/24, service 0.1/4/14, pedestrian 0.3/5/18.

The map is **always light**, also in dark mode, because the user asked for a bright map.

## Road colour history

The user tuned the main-road colours in steps; tertiary and smaller streets are white throughout.

| Step | Motorway | Trunk | Primary | Secondary | Why |
|---|---|---|---|---|---|
| 1. Minimal grey (dark-mode variant existed) | `#c9cdc6` (all major) | | | | "streets only" first version |
| 2. Bright | `#f08a3c` | `#f6a64a` | `#fcc94b` | `#fde68a` | "make the map bright in colour" |
| 3. Softer | `#f4bf91` | `#f7cc9f` | `#f9dfa6` | `#fcecc2` | "reduce the strength of the orange/yellow" |
| 4. **Current** | `#e0c5af` | `#e6d1bb` | `#ede1c5` | `#f4edd8` | "50% less strong" |

Step 4 halved each colour's **chroma in OKLCH** while keeping lightness and hue, so the roads lose
colour but not contrast. Mixing with white would have made them fade into the background.

For exploring other looks, [Maputnik](https://maplibre.org/maputnik/) edits MapLibre styles visually
against the same OpenFreeMap data. OpenFreeMap's own `liberty`, `bright` and `positron` styles
(`https://tiles.openfreemap.org/styles/<name>`) are useful references.

## Markers

- Pharmacies are a GeoJSON source rendered as a **symbol layer of pharmacy crosses** (they started as
  circles; the user asked for "green crosses"). The cross images are drawn on a canvas at runtime
  (52 px at pixel ratio 2, white 6 px outline) and registered with `map.addImage`, one per status:

  | Status | Colour |
  |---|---|
  | open | `#16a34a` green |
  | closing within an hour | `#f59e0b` amber |
  | opens later in the window | `#2563eb` blue |
  | not on duty ("show closed") | `#9ca3af` grey at 45 % opacity |

- `symbol-sort-key` keeps open pharmacies on top; `icon-allow-overlap` keeps every cross visible.
  Size scales from 0.65 at zoom 9 to 1 at zoom 15.
- Click opens a popup (name, address, status, hours, phone, directions). The cursor turns into a pointer
  over crosses.

## Camera rules

The camera only moves on first load, when the **place filter** (Near me, Address, Areas) changes,
on **Show all**, and on **On map**; the other filters never move it. A place filter is shown by fitting
a box (`fitBounds`, padding 40 px, at most zoom 15): around its radius circle, around the chosen areas'
pharmacies, or, with an unlimited radius, around the location and every on-duty result. The `radius`
ring is computed in `geo.ts` (`circlePolygon()`, 64 points). The map reports its bounds on every `moveend`/`resize`, which drives the "list follows map" behaviour
(details in [frontend.md](frontend.md#list-and-map-together)).

## Implementation notes

- **Worker file:** MapLibre 6 loads its web worker from a file next to its own module. Once Vite bundles
  the library, that file isn't next to the bundle, so the code imports
  `maplibre-gl/dist/maplibre-gl-worker.mjs?url` and calls `setWorkerUrl()`.
- MapLibre 6 doesn't export the style-spec TypeScript types, so the style object and expressions are
  passed with `as never` casts.
- **WebGL 2 is required:** MapLibre 6 throws in its constructor without it (old devices, blocklisted
  GPUs, hardware acceleration turned off). `MapView` sits in an error boundary
  (`components/ErrorBoundary.tsx`), so the map pane then shows a notice and the list keeps working.
- Bundle cost: about 290 KB gzipped JavaScript (Leaflet was about 50 KB); Vite warns about chunk size.
- Attribution required and shown: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors.
