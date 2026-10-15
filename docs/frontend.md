# Frontend behaviour

React 19 with the React Compiler (no hand-written memoization), built with Vite. `web/index.html`
only holds the page head and a `#root` element. `App.tsx` owns a single `State` object; the
results, counts and list are derived from it on each render, and URL sync is an effect. The
MapLibre map stays an imperative class (`map/index.ts`), wrapped by `components/MapView.tsx`; its popups
are rendered by React into the popup element through a portal. The language is passed down through
a context (`useI18n()`), never read from a module-level global, so memoized components re-render
when it changes. `./dev lint` runs oxlint, including its React Compiler and Hooks rules.
The logic that decides what is shown is kept free of browser APIs (`filter.ts`, `time.ts`,
`greek.ts`, `format.ts`, `parseDataset()` in `data.ts`) and unit-tested with Vitest next to its
source (`*.test.ts`, `./dev test`). `./dev e2e` runs the Playwright smoke tests in `e2e/` in Google Chrome in the `e2e` container; they serve a
small fixed dataset (`e2e/fixtures/duties.json`) and freeze the clock, so they don't depend on
the scraped data.

## Layout

- **Wide screens (≥ 1024 px):** filters on top, the list on the left and the map on the right,
  side by side. The list scrolls on its own; the map is sticky.
- **Narrow screens:** filters on top, then **List / Map tabs**. Only one view is visible at a time.
- Header with Greek/English toggle; footer with the source credit, last update time, a
  "duties can change, call first" disclaimer, and the coverage limits (no regular hours, no Piraeus).
- Light and dark page themes follow the system setting; the map itself is always light (see
  [map.md](map.md)).

## Filters

All filters combine (AND). Changing a filter updates the list and the map markers immediately; it does
**not** move the map (see "List and map together" below).

### When — time windows

| Option | Window (Athens time) |
|---|---|
| Now (default) | the current instant |
| Next 3 hours | now → now + 3 h |
| Tonight | max(now, 21:00) → 08:00 tomorrow; between midnight and 08:00 it is "the rest of this night" |
| Today | now → midnight |
| Tomorrow | tomorrow 00:00 → 24:00 |
| Pick date/time | a date plus from/to clock times; if *to ≤ from* the window runs past midnight (22:00–02:00) |

- A pharmacy matches if **any of its duty intervals overlaps the window**. For "Now" the instant must
  fall inside an interval. So a pharmacy that is on duty for only part of a custom range still appears,
  and each card lists its actual hours. Pharmacies covering the whole range are not marked separately.
- The custom date picker is limited to today … last published date. If the window goes past the
  published schedule, the empty-state message says so ("not published yet") rather than "no results".
- All times are computed in **Europe/Athens** (`time.ts`) whatever the visitor's own time zone.

### Areas

- A search box over the ~160+ FSA area names (e.g. ΚΥΨΕΛΗ, ΠΑΓΚΡΑΤΙ, ΚΕΝΤΡΟ ΑΘΗΝΑΣ); selected areas
  become removable chips. Several areas can be selected.
- Matching ignores accents and case and accepts **Latin letters**: `kyps` finds ΚΥΨΕΛΗ (each area has
  a search key of its folded Greek plus its transliteration).
- With an empty query the suggestions show the areas with the most pharmacies in the current window,
  each with its count. Enter picks the first suggestion, Backspace in the empty box removes the last chip.

### Near me and radius

- "Near me" asks for the browser location (needs HTTPS — works on the live site, not on plain-HTTP
  previews). Results are then sorted by distance and show it on each card; a radius selector appears
  (any / 1 / 2 / 5 / 10 km, defaulting to 2 km).
- The location is **never written to the URL**. It does not move the map (a filter like any other).

### Show closed

- "Also show closed" (URL `closed=1`) adds pharmacies that are in the data but **not on duty in the
  window**, under their own heading after the on-duty ones, with their **next duty** shown. On the map
  they are grey, semi-transparent crosses.
- It can only show pharmacies that appear somewhere in the fetched schedule (see
  [data-source.md](data-source.md#coverage)).

## Results: ordering and status

Order: on-duty pharmacies first, then closed ones (if shown). Within each group: by distance when
"Near me" is on; otherwise currently-open first, then by the earliest relevant start, then by area.

Statuses (cards, map markers and popups use the same rule, `status()` in `filter.ts`):

| Status | When | Colour |
|---|---|---|
| Open now · until HH:MM | an interval contains the current time | green |
| Closing soon · until HH:MM | open, but ends within an hour | amber |
| Opens [day] HH:MM | on duty in the window but later than now | blue |
| Not on duty (next duty …) | shown only with "show closed" | grey |

Statuses are relative to the real current time even when the window is in the future. A one-minute
timer and returning to the tab refresh them.

Each card: area, name, address, status, the matching duty hours (`Fri 16/10 17:00–08:00 (+1)`), and
actions: **Call** (`tel:`), **Directions** (Google Maps directions to the coordinates), **On map**,
**More info** (a Google search for the pharmacy; the original "products" idea was left out because
no source has that data).

## List and map together

- On wide screens the **list follows the visible map area**: after any pan or zoom only pharmacies
  inside the map's bounds are listed. The count then reads "12 of 71 pharmacies in the map area"
  (plus "· N not on duty" when closed ones are shown) with a **Show all** button that zooms the map
  out to fit every on-duty result. On narrow screens the list always shows everything, since list and
  map are never visible together.
- **The map keeps its position when filters change.** It is only moved
  - on first load: Athens centre at zoom 12, or fitted to the results if the URL already has an area
    or location filter;
  - by **Show all**;
  - by a card's **On map** (zooms to ≥ 15 and opens the popup; on phones it switches to the Map tab).
- An open popup stays open across refreshes as long as its pharmacy is still in the results.

## Languages

- Greek and English UI strings live in `i18n.ts`; the toggle is remembered in the URL and
  `localStorage`, and the default follows the browser language.
- The FSA data is Greek capitals. In English, names, addresses and areas are **transliterated** with an
  ELOT 743-style scheme (`greek.ts`: ΟΥ→ou, ΑΥ/ΕΥ→av/af/ev/ef, word-initial ΜΠ→b, ΝΤ→d, ΓΚ→g, ΓΓ→ng),
  with the original Greek address shown underneath. This matches the transliteration on Athens street
  signs, which helps visitors.
- In Greek the data is shown as-is (all caps is normal in Greek listings; accents can't be restored).
- Map street names switch too: Greek `name`, or OpenMapTiles' `name:latin` in English (some streets have
  no Latin name and stay Greek).

## URL state

Shareable: `?lang=en&view=map&when=custom&date=2026-10-18&from=22:00&to=02:00&areas=ΚΥΨΕΛΗ,ΠΑΓΚΡΑΤΙ&radius=2&closed=1`.
Defaults are omitted. The URL is updated with `history.replaceState` (no history entries per click).
Not stored: the location, and the map position.
