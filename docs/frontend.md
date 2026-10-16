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

When, Where and Show closed combine (AND). Changing a filter updates the list and the map markers
immediately. Only the Where (place) filter also moves the map (see "List and map together" below).

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

### Where — place filters

A row of chips: **Everywhere** (default) · **📍 Near me** · **Address** · **Areas**. **At most one place
filter applies at a time**; below the chips only the chosen one's inputs are shown. Each keeps its
input while another is chosen (switching from Address to Near me and back restores the address), but
only the chosen one filters, sorts and goes into the URL (`filter.ts`: `origin()`, `filterPharmacies()`).

Choosing or changing a place filter **moves the map** to it (`placeFrame()`):

| Place filter | Map shows |
|---|---|
| Near me / Address, radius 1–10 km | the smallest box around the radius circle |
| Near me / Address, radius ∞ | the location plus every on-duty result (like **Show all**) |
| Areas | the box around every pharmacy of the chosen areas (on duty or not, so it doesn't change with the time window) |
| Everywhere | stays where it is |

The radius is drawn on the map as a light purple circle around the location dot.

#### Near me

- Asks for the browser location (needs HTTPS — works on the live site, not on plain-HTTP previews).
  Results are then sorted by distance and show it on each card.
- **Radius slider** with the steps 1 · 2 · 5 · 10 km · ∞ (default 2 km), shared with Address.
- The location is **never written to the URL**, only `place=me`. Opening such a link locates the user
  automatically only if location access is already allowed (Permissions API), so a shared link never
  shows a permission prompt unasked; otherwise a **Find my location** button is shown. It also serves
  as the retry after an error.

#### Address

- A search box with **autocomplete** from [Photon](https://photon.komoot.io/) (komoot's OpenStreetMap
  geocoder; `geocode.ts`): from 3 characters, 300 ms after the last keystroke, stale requests cancelled,
  up to 6 suggestions such as "Σκουφά 10, Κολωνάκι". Results are limited to the box around all
  pharmacies plus 5 km and biased towards central Athens; English UI asks for English names where
  OSM has them. If Photon fails, the box says address search is unavailable.
- The chosen address becomes a removable chip; results are sorted by distance from it and the radius
  slider applies as for Near me. The address (label and coordinates) **is** in the URL, so the link can
  be shared. What the user types is sent to Photon ([decisions.md](decisions.md) D36); the footer
  credits it.

#### Areas

- A search box over the ~160+ FSA area names (e.g. ΚΥΨΕΛΗ, ΠΑΓΚΡΑΤΙ, ΚΕΝΤΡΟ ΑΘΗΝΑΣ); selected areas
  become removable chips. Several areas can be selected.
- **Only areas with a pharmacy on duty in the selected time window are suggested**, each with that count
  (the count ignores the place filter and "show closed"). Areas already chosen stay as chips even if the
  window changes and they have nobody on duty.
- Matching ignores accents and case and accepts **Latin letters**: `kyps` finds ΚΥΨΕΛΗ (each area has
  a search key of its folded Greek plus its transliteration).
- With an empty query the suggestions are ordered by count. Enter picks the first suggestion,
  Backspace in the empty box removes the last chip.

### Show closed

- "Also show closed" (URL `closed=1`) adds pharmacies that are in the data but **not on duty in the
  window**, under their own heading after the on-duty ones, with their **next duty** shown. On the map
  they are grey, semi-transparent crosses.
- It can only show pharmacies that appear somewhere in the fetched schedule (see
  [data-source.md](data-source.md#coverage)).

## Results: ordering and status

Order: on-duty pharmacies first, then closed ones (if shown). Within each group: by distance with
Near me or Address; otherwise currently-open first, then by the earliest relevant start, then by area.

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
actions: **Call** (`tel:`), **Directions** (with a directions icon; see below), **On map**,
**More info** (a Google search for the pharmacy; the original "products" idea was left out because
no source has that data).

**Directions** (on the cards and in map popups, `components/DirectionsLink.tsx`) opens the device's
maps app on phones and a website elsewhere, chosen from the user agent (`mapsPlatform()`):

| Device | Opens | Shows |
|---|---|---|
| iPhone / iPad | `https://maps.apple.com/?ll=…&q=<name>` → Apple Maps | the pharmacy as a labelled pin |
| Android | `geo:<lat>,<lng>?q=<lat>,<lng>(<name>)` → the default maps app | the pharmacy as a labelled pin |
| Desktop | Google Maps in a new tab | directions to the pharmacy |

On phones the app's own Directions button is then one tap away: `geo:` has no portable way to ask for
a route, and showing the place lets the user pick the travel mode. Pharmacies without coordinates are
looked up by address. iOS always opens Apple Maps, even if another navigation app was made the default
(EU, iOS 18.4+). App links don't open a new tab, which would be left empty.

## List and map together

- On wide screens the **list follows the visible map area**: after any pan or zoom only pharmacies
  inside the map's bounds are listed. The count then reads "12 of 71 pharmacies in the map area"
  (plus "· N not on duty" when closed ones are shown) with a **Show all** button that zooms the map
  out to fit every on-duty result. On narrow screens the list always shows everything, since list and
  map are never visible together.
- **The map keeps its position when the time window, language or "show closed" change.** It is only
  moved
  - on first load (a jump): Athens centre at zoom 12, or the place filter's frame if the URL has one;
  - when the **place filter changes** (a flight; see "Where" above). `placeKey()` in `filter.ts`
    changes exactly then. A map hidden behind the List tab on a phone moves once it is shown.
    Choosing Everywhere leaves the map where it is;
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

Shareable: `?lang=en&view=map&when=custom&date=2026-10-18&from=22:00&to=02:00&place=areas&areas=ΚΥΨΕΛΗ,ΠΑΓΚΡΑΤΙ&closed=1`.
Defaults are omitted. The URL is updated with `history.replaceState` (no history entries per click).

Place filters in the URL (only the one in use):

| Filter | Parameters |
|---|---|
| Near me | `place=me&radius=5` |
| Address | `place=address&addr=Σκουφά 10, Κολωνάκι&at=37.97790,23.74230&radius=1` |
| Areas | `place=areas&areas=ΚΥΨΕΛΗ,ΠΑΓΚΡΑΤΙ` |

`radius` is `1`, `5`, `10` or `any`, and is left out at the default 2 km. Links from before the place
filters (`areas=` without `place`) still open as Areas. Not stored: the user's location, and the map
position.
