# The "Where" filter

Source of truth for the place filter: what it must do and how it does it now. Update it with every
change; the reasons behind choices are in [decisions.md](decisions.md) (D35–D38).

## Requirements

- One group, **Where**, with mutually exclusive children: **at most one place filter applies** at a time.
- Children: **Everywhere** (no place filter), **Near me**, **Address**, **Areas**.
- **Near me** and **Address**: a radius slider of **1 · 2 · 5 · 10 km**. No unlimited step: that is
  Everywhere.
- **Address**: a text field with **autocomplete**; **one address** at a time.
- **Areas**: a search field ("Search areas…") whose suggestions are the areas with **pharmacies on
  duty in the selected time window**; several areas can be chosen.
- Choosing or changing a place filter **moves the map** to the **smallest view enclosing it**: the
  radius circle around the location, or the chosen areas.
- The radius is **drawn** on the map. A **street chosen without a house number** is drawn too, whole,
  in the circle's colour at 50 %.

## Behaviour

| Child | Input | Filters | Sorts by distance | Map moves to | URL |
|---|---|---|---|---|---|
| Everywhere | — | nothing | no | stays | — |
| Near me | browser location + radius | within radius of the user | yes | box around the circle | `place=me&radius=5` |
| Address | chosen address + radius | within radius of the address | yes | box around the circle | `place=address&addr=…&at=lat,lng[&way=id]&radius=5` |
| Areas | chosen areas | in any chosen area | no | box around all pharmacies of those areas | `place=areas&areas=Α,Β` |

- All children keep their input while another is chosen (switching back restores it); only the
  chosen one filters, sorts and is written to the URL.
- Combines (AND) with **When** and **Show closed**.
- Pharmacies without coordinates are never hidden by a radius.
- Distances show on the cards whenever an origin (user or address) applies.
- `radius` is omitted at the default **2 km**; other values than 1/2/5/10 read as 2.
- Old links with only `areas=` open as Areas.

## Appearance

- Label **Where / Πού**; a row of chips, the chosen one filled: **Everywhere / Παντού**,
  **📍 Near me / 📍 Κοντά μου**, **Address / Διεύθυνση**, **Areas / Περιοχές**.
- Below the chips, only the chosen child's panel.
- **Radius slider**: "Radius / Ακτίνα", 200 px wide, the step labels (1 km … 10 km) under it, the
  current one bold; screen readers hear "5 km".
- **Search fields**: suggestions drop down under the field (at least 280 px, at most 440 px wide);
  the first one is highlighted and taken by Enter; Escape closes them.
- **Map marks**, all purple `#7c3aed`:
  - origin (user or address): a 7 px dot with a 3 px white outline;
  - radius: a circle, fill at 8 % opacity, 1.5 px outline at 60 %;
  - chosen street: `#be9df6` (the purple at 50 % over white, opaque so the joins between its OSM ways
    don't show darker), 2/12/36 px wide at zoom 10/16/19, under the street names.

## Near me

- Choosing it asks the browser for the location ("Locating… / Εντοπισμός…"; high accuracy, 15 s
  timeout, positions up to 1 min old accepted). Needs HTTPS.
- The location is **never in the URL**. A `place=me` link locates on load only if access is already
  granted (Permissions API), so no prompt appears unasked; otherwise, and after an error ("Could not
  get your location."), the panel shows **📍 Find my location / 📍 Εντοπισμός θέσης**.
- Until the location is known nothing is filtered and the map doesn't move.

## Address

- **One field, one address**: after a pick the field shows the address. Focusing selects its text, so
  typing searches for a replacement; leaving without picking restores it; emptying the field removes it
  (no filter until another is picked). Placeholder "Street and number… / Οδός και αριθμός…", 300 px.
- **Autocomplete: Photon** (photon.komoot.io, OpenStreetMap data, no key): from 3 characters, 300 ms
  after the last keystroke, stale requests cancelled, up to 6 suggestions. Limited to the box around all
  pharmacies plus 5 km, biased towards central Athens; English names in the English UI where OSM has
  them. Label: name, street + number, then district, locality or city ("Σκουφά 10, Κολωνάκι");
  duplicates dropped. If Photon fails: "Address search is not available right now."
- **Whole street**: a Photon result of type `street` that is an OSM way (no house number) keeps that
  way's id. The street's shape comes from **Nominatim** (nominatim.openstreetmap.org): one search by the
  street name within 5 km of the point, every way separately (up to 40). The ways connected to the picked
  one through shared points are drawn; namesakes elsewhere are not. Fetched again from `way=` on
  load. If it fails nothing is drawn; filtering and the map frame don't depend on it.
- Not used: Nominatim for autocomplete (its policy forbids it); Overpass for street shapes (public
  servers too unreliable); the map's vector tiles (minor street names only from zoom 13–14, namesakes
  can't be told apart).

## Areas

- Chosen areas are removable chips before the field ("Search areas… / Αναζήτηση περιοχής…", 220 px).
- Suggestions: areas with at least one pharmacy on duty in the current time window (counted ignoring
  the place filter and Show closed), with that count, up to 10; by count when the field is empty.
  Already chosen areas aren't suggested, but stay as chips even if the window leaves them empty.
- Matching ignores accents and case and accepts Latin letters (`kyps` → ΚΥΨΕΛΗ). In English, area
  names are shown transliterated (ELOT 743).
- Enter takes the first suggestion; Backspace in the empty field removes the last chip.

## Map camera

- Moves only when the place filter **changes** (child, radius, location, address, areas), not with
  When, Show closed or the language.
- Fits the box with 40 px padding, at most zoom 15; **flies** (at most 2.5 s). On first load it
  **jumps**: to the place filter's box from the URL, or Athens centre at zoom 12.
- Choosing Everywhere, removing the address, or an origin not yet known: the map stays.
- A map hidden behind the List tab (phones) moves when it is shown.
- Independently of this filter, **Show all** and **On map** also move the map, and on wide screens the
  list follows the visible map area ([frontend.md](frontend.md#list-and-map-together)).

## External services

| Service | When | Receives |
|---|---|---|
| Photon | while typing in Address | the typed text |
| Nominatim | once per chosen street without a number | the street name and the point |

Never sent anywhere: the user's location. Both are credited in the footer ("Address search: Photon by
komoot and Nominatim, © OpenStreetMap contributors").

## Code

| File | Role |
|---|---|
| `web/src/filter.ts` | `Place`, `RADII_KM`, `origin()`, `filterPharmacies()`, `placeFrame()`, `placeKey()` |
| `web/src/state.ts` | URL read/write of the place filter |
| `web/src/geocode.ts` | Photon search and parsing; Nominatim street fetch, `connectedStreet()` |
| `web/src/geo.ts` | `circleBounds()`, `circlePolygon()`, `boundsOf()`, `padBounds()` |
| `web/src/hooks.ts` | `useLocate()`, `locationAllowed()`, `useStreet()` |
| `web/src/components/Filters.tsx` | the Where chips and panels |
| `web/src/components/RadiusSlider.tsx`, `AddressSearch.tsx`, `AreaPicker.tsx`, `Suggestions.tsx` | the inputs |
| `web/src/components/MapView.tsx`, `web/src/map/index.ts` | camera moves; `you`, `radius-*`, `street` layers |

Tests: `filter.test.ts`, `geo.test.ts`, `geocode.test.ts` (unit); `e2e/smoke.spec.ts` (areas,
near me, address, street, map moving), with Photon and Nominatim mocked.
