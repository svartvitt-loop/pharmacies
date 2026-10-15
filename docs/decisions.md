# Decision log

Decisions in roughly the order they were made (all on 2026-10-15). Each says what was decided, why,
and what it costs. "User" means the project owner chose it; the rest were proposals the user accepted
or didn't object to.

## Data

**D1 — Use the FSA duty site as the only data source.**
The association's own site (fsa-efimeries.gr) has every on-duty pharmacy with coordinates, phone and
hours, about 8 weeks ahead. Alternatives (vrisko.gr, Google Places, OpenStreetMap) were less
authoritative, incomplete, paid, or needed many requests. *Cost:* no API or licence; depends on the
site's HTML; on-duty pharmacies only. → [data-source.md](data-source.md)

**D2 — Version 1 shows on-duty pharmacies only.** The user didn't pick a scope, so the recommendation
was used: regular-hours data (OSM) is patchy and would mislead. "Products" per pharmacy was dropped
(no source). Footer and README state the limits.

**D3 — Normalise hours at scrape time.** The scraper turns the Greek hours text into ISO intervals with
the Athens offset, so the browser only compares numbers and DST is handled once, in Python with
`zoneinfo`. The original text is kept in the JSON for reference.

**D4 — Fetch yesterday too.** Night and 24-hour duties that started yesterday are still running this
morning; without yesterday's list "Now" between 00:00 and 08:00 would be wrong.

**D5 — Identify pharmacies by `sha1(name|address)`.** The FSA card id is per duty, not per pharmacy.

**D6 — Fetch 55 days instead of 14.** With 14 days fewer than half of the pharmacies appeared
(1,068), so users couldn't find their local pharmacy even with "show closed". The whole published
schedule gives 2,524. *Cost:* 57 requests per scrape instead of 16; data file ~170 KB gzipped. The user
chose to ship it directly and check on the live site.

**D7 — Don't add OpenStreetMap (yet).** One Overpass call returns ~2,350 Attica pharmacies, but only
55% of official pharmacies match within 75 m and 8% have opening hours. Kept as a possible
"unverified" layer in TODO.md.

## Architecture and stack

**D8 — Static site + scheduled scraper; no backend, no database.** Data changes rarely and is small;
GitHub Actions scrapes and builds, GitHub Pages hosts. Free, nothing to run, low load on the source.
*Cost:* data is up to 3 hours old; no server-side features.

**D9 — Stack (user's choices):** TypeScript with Vite; Python scraper; GitHub Pages; Greek and
English UI. The frontend started as plain TypeScript with no framework and was ported to React 19
(with the React Compiler) once the hand-written DOM updates grew. The MapLibre map stays an
imperative class wrapped by one component; react-map-gl would add little over it. Linting uses oxlint
because typescript-eslint doesn't support TypeScript 7.

**D10 — One JSON file for everything.** Simpler than per-date files; the browser needs most dates for
"show closed" and next-duty anyway. Revisit if it grows much.

## Frontend behaviour

**D11 — "Matches the window" means "overlaps it".** For ranges, a pharmacy on duty for part of the
range is shown with its real hours. Simpler and more useful than requiring full coverage; the cost is
that partial coverage isn't highlighted.

**D12 — Everything in Athens time.** Windows, statuses and formatting use `Europe/Athens` regardless
of the visitor's zone (tourists, VPNs).

**D13 — Filters in the URL, location never.** Views are shareable; a position is private.

**D14 — English shows ELOT 743 transliterations** with the Greek address underneath, matching street
signs. Greek shows the data as published (capitals).

**D15 — Wide screens: list and map side by side; narrow: tabs.** The user asked for a list view and a
map view; side by side uses the space on desktops, tabs keep phones usable.

**D16 — The list follows the visible map area (wide screens only).** User request. With a
"N of M in the map area · Show all" line so hidden results are never a surprise. Not on phones, where
the map isn't visible next to the list.

**D17 — Filter changes never move the map.** User request ("don't lose the current zoom"). The camera
moves only on first load, Show all, and On map. *Consequence:* "Near me" no longer jumps to the user's
position; combined with D16, nearby pharmacies outside the current view aren't listed on desktop until
you pan or press Show all.

**D18 — "Show closed" (added in another session).** Optional, off by default, URL `closed=1`; closed
pharmacies are listed after the on-duty ones with their next duty, and drawn as faint grey crosses.
Counts and Show all refer to on-duty pharmacies.

## Map

**D19 — Leaflet + OSM raster tiles first.** Small and simple for version 1.

**D20 — Switch to MapLibre + OpenFreeMap with a hand-written style.** The user wanted "only street names
and the pharmacies". Raster tiles can't drop layers, the minimal raster option (CARTO) now needs an API
key, and OpenFreeMap is free and keyless. A vector style shows exactly the layers we choose.
*Cost:* ~290 KB gzipped JS instead of ~50 KB; needs WebGL.

**D21 — An always-light, colourful map; then softened twice.** User requests: bright colours; then
weaker orange/yellow; then "50% less strong", done by halving OKLCH chroma so roads keep their
contrast. Current values are in [map.md](map.md).

**D22 — Pharmacy crosses instead of circles**, coloured by status (user request: "green crosses").

## Operations

**D23 — Public repo** so GitHub Pages works on a free plan; **deploy key** for git access because the
repo lives on another account. Renamed from `pharmarcies` to `pharmacies`.

**D24 — Push builds reuse cached data (added in another session).** Code-only pushes don't hit the
source; the day count is part of the cache key so changing it forces a scrape.

**D25 — Documentation-only pushes don't run CI** (`paths-ignore`: Markdown, `.gitignore`, licence,
editor/Claude settings, the Docker dev environment).

**D26 — Conventional Commits, one commit per change** (user rule, in `CLAUDE.md`). Earlier messages
were rewritten to match.

**D27 — Local dev environment in Docker Compose.** Changes used to be tested on the live site.
Compose runs a dev server, a production-like preview (nginx under `/pharmacies/`) and, for phones,
Caddy with a local CA (geolocation needs HTTPS). Dev data is **copied from the live site** by default,
so local work doesn't load fsa-efimeries.gr; a real scrape is opt-in (`DATA_SOURCE=scrape`). The native
`uv`/`npm` workflow still works. Browser tests in a container (Playwright) were deferred at first; they
came with `./dev`, which now runs every dev task in a container.

**D28 — `node_modules` in the checkout, installed by the containers.** It started in a named volume so
it couldn't mix with a host install. Once host toolchains were dropped (`./dev`), the volume only
cost: the host's editor had no packages, and Docker left an empty root-owned `web/node_modules`
behind. The containers run as the host user, so they now install into `web/node_modules` directly;
a `flock` keeps concurrent installs apart. *Cost:* the packages are Linux builds, so on a macOS or
Windows host the tools in that folder wouldn't run natively (the editor's TypeScript still works).

**D29 — The scraper's environment in a volume, synced by `uv run --locked`.** It was baked into the
image and owned by root, so `./dev uv …` failed (no writable uv cache for the host user) and a
changed `uv.lock` silently needed `docker compose build data`. Now, like `node_modules`, the
container installs on demand as the host user. It stays out of the checkout, unlike `node_modules`:
a venv created in the container points at the container's Python, which the host doesn't have.

**D30 — Unit tests for the pure logic (Vitest); `npm test` means unit tests.** The Playwright smoke
tests only touch a few paths, while the code most likely to break quietly (Athens time and DST, time
windows, matching and ordering, transliteration) is pure. That logic moved out of browser-bound
modules (`filter.ts`, `geo.ts`, `format.ts`, `parseDataset()`) and got unit tests next to its source.
Vitest reuses the Vite config. The Playwright tests became `test:e2e` / `./dev e2e`.

**D31 — The scraper refuses to publish implausible data and stops early.** Exiting non-zero keeps the
last good site up, so it is the safe reaction to anything that looks like a changed source: no
readable hours today, or most hours unreadable (cards found but fields moved). A few unreadable
hours still only log a warning. When today can't be fetched, the run stops at the second request
instead of loading the source with 55 more that it would discard.

**D32 — ruff for the scraper; Python pinned to 3.12.** The web side had oxlint and tsc, the scraper no
linter at all. ruff (lint with import order, pyupgrade and bugbear rules, plus its formatter) is one
fast tool in the dev dependency group, run by `./dev lint` and CI. `scraper/.python-version` makes CI
use the same Python as the container instead of whatever the runner has.
