# Architecture

## Overview

There is no backend and no database. A scheduled job scrapes the official duty schedule into one JSON
file, the static site is built around it, and the browser does all filtering.

```
GitHub Actions (cron every 3h, on push, on demand)
  │
  ├─ tests: ruff + pytest (scraper); oxlint, tsc, Vitest, Playwright (web) — a failure stops here
  │
  ├─ scraper/ (Python) ── POST fsa-efimeries.gr/Home/FilteredHomeResults × 57 dates
  │     parse HTML cards → normalise hours into Athens-time intervals → check
  │     → web/public/data/duties.json   (cached between runs, see operations.md)
  │
  ├─ web/ (Vite + TypeScript) ── npm run build → web/dist (page, JS, CSS, data, MapLibre worker)
  │
  └─ actions/deploy-pages → https://svartvitt-loop.github.io/pharmacies/

Browser
  loads data/duties.json once → filters by time window, area, distance → list + map
  map tiles and fonts: tiles.openfreemap.org (vector)
```

Why this shape: the data changes a few times a day at most and is small (~170 KB gzipped), so a static
file regenerated on a schedule is the simplest thing that works, costs nothing to host, and keeps the
load on the source site to a handful of requests per run. See [decisions.md](decisions.md).

## Repository layout

```
.github/workflows/deploy.yml   test → scrape → build → deploy (the only workflow)
.github/dependabot.yml         monthly dependency-update pull requests
scraper/
  fsa_scraper/__main__.py      CLI: fetch yesterday..today+N days, check, write duties.json atomically
  fsa_scraper/fetch.py         the POST per date, with retries
  fsa_scraper/parse.py         HTML fragment → DutyCard objects
  fsa_scraper/hours.py         "8 ΠΡΩΙ - 11 ΒΡΑΔΥ" → (start, end) intervals in Europe/Athens
  fsa_scraper/dataset.py       cards per date → the duties.json structure; checks before publishing
  tests/                       pytest: hours formats, DST, card parsing (fictional fixture), dataset
                               assembly and checks, retries, the CLI's stop/skip rules
web/
  index.html                   page head and the #root element
  src/main.tsx, App.tsx        React entry; App owns the state and wires filters ↔ list ↔ map
  src/hooks.ts                 data loading, one-minute clock, media query
  src/components/              header, filters, area picker, view bar, list, cards, map, popup, footer
  src/state.ts                 UI state (filters, language, view) and its URL/localStorage sync
  src/filter.ts                time windows, filtering, sorting, statuses (pure, no DOM)
  src/data.ts                  loads duties.json into Pharmacy objects with epoch-ms intervals
  src/time.ts                  Athens time-zone helpers (independent of the visitor's zone)
  src/geo.ts                   distances, map-area bounds
  src/format.ts                status and hours texts, distances, links
  src/map/index.ts             MapLibre map (imperative class): markers, popups, camera
  src/map/style.ts             the custom street-map style (palette, road classes and widths)
  src/map/markers.ts           cross marker images and colours per status
  src/i18n.ts, greek.ts        Greek/English strings; accent folding; transliteration
  src/style.css                layout (side-by-side ≥1024px, tabs below), light/dark tokens
  src/*.test.ts                unit tests (Vitest) of the pure modules
  e2e/                         Playwright smoke tests against a fixed dataset (fixtures/duties.json)
  public/data/                 generated duties.json (git-ignored)
compose.yaml, docker/          local dev environment (data, dev server, e2e tests, preview, HTTPS for phones)
dev                            runs every dev task in a container (`./dev help`)
docs/                          this documentation
CLAUDE.md                      commit conventions; TODO.md open work
```

## The data file: `web/public/data/duties.json`

One file, written by the scraper, read once by the browser.

```jsonc
{
  "generatedAt": "2026-10-15T18:04:54+03:00",   // Athens time
  "source": "https://fsa-efimeries.gr/",
  "dates": ["2026-10-14", …, "2026-12-09"],      // dates that returned at least one duty
  "pharmacies": [
    { "id": "80bbca14df", "name": "…", "address": "…", "area": "ΚΥΨΕΛΗ",
      "phone": "2100000000", "lat": 37.99, "lng": 23.74 }
  ],
  "duties": [
    { "p": "80bbca14df", "date": "2026-10-14",
      "hours": "8 ΠΡΩΙ - 2 ΜΕΣΗΜΕΡΙ & 5 ΑΠΟΓΕΥΜΑ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ",      // original text
      "intervals": [["2026-10-14T08:00:00+03:00", "2026-10-14T14:00:00+03:00"],
                    ["2026-10-14T17:00:00+03:00", "2026-10-15T08:00:00+03:00"]] }
  ]
}
```

- `id` is `sha1(name|address)[:10]`; the FSA card id is a *duty* id, not a pharmacy id, so it can't be
  used to recognise the same pharmacy on different dates.
- Intervals are ISO strings with the Athens UTC offset, so the browser compares plain epoch times and
  daylight-saving changes are already resolved by the scraper.
- Size with 57 dates: ~2,500 pharmacies, ~4,300 duties, 1.3 MB raw, ~170 KB gzipped.

## Runtime flow in the browser

1. `readState()` restores filters from the URL (language also from `localStorage`/browser language).
2. `loadDataset()` fetches the JSON and builds `Pharmacy` objects with sorted `{start, end}` intervals.
3. `filterPharmacies()` computes the time window, keeps pharmacies whose intervals overlap it (or all,
   with "show closed"), applies area and radius filters, and sorts.
4. The list renders the results (on wide screens only those inside the visible map area); the map
   updates its GeoJSON source without moving the camera.
5. A one-minute timer and tab re-focus re-run the filtering so "open now" statuses stay correct.

Details of each step are in [frontend.md](frontend.md) and [map.md](map.md).
