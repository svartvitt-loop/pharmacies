# Problems and known issues

## Solved during development

| Problem | Cause | Fix |
|---|---|---|
| Duty hours are free Greek text | No structured hours in the source | Generic parser for `H[:MM] PERIOD - H[:MM] PERIOD [ΕΠΟΜΕΝΗΣ]` segments joined by `&`; accent folding; tests for every format seen and for the DST night |
| "Now" wrong between midnight and 08:00 | Night duties belong to *yesterday's* list | Fetch yesterday too (the site still serves it) |
| Custom date/time inputs and the radius selector visible when they shouldn't be | `display: flex` in CSS overrides the `hidden` attribute | Global `[hidden] { display: none !important }` |
| Map opened zoomed out over half of Attica | Fitting to all results includes far-away pharmacies (Megara, Oropos…) | Default view: Athens centre, zoom 12; fit to results only when an area or location filter is set |
| CARTO map tiles showed "API KEY REQUIRED" | CARTO now needs a key; the tiles still return **HTTP 200** with a watermark | Caught only by looking at a screenshot; switched to OpenFreeMap |
| Map blank after bundling MapLibre 6 | The library looks for its worker next to its own module, which bundling moves | `setWorkerUrl()` with the worker imported via Vite's `?url` |
| Map blank in headless screenshots | Screenshot taken before tiles loaded; WebGL without a GPU | Playwright with SwiftShader and explicit waits (see operations.md) |
| A requested map fit could be lost | Updates queued before the map's `load` overwrote each other, including the fit | Remember the pending fit separately |
| Map popup closed every minute | Each refresh removed the popup | Keep it (with fresh content) while its pharmacy is still in the results |
| Site 404 on the phone | Repo was named `pharmarcies`; the phone used the normal spelling | Renamed the repo to `pharmacies` |
| "Site not found" after the rename | Actions-based Pages needs a new deployment after a rename | Pushed a commit to redeploy |
| Pages deploy failed | Pages wasn't enabled; on a private repo it needs a paid plan | Repo made public; Pages source set to GitHub Actions |
| Push rejected / "Repository not found" | Default SSH key is another GitHub account; deploy key file name was different from what was first assumed (`pharmarcies` vs `pharmacies`) | Repo-local `core.sshCommand` with the deploy key |
| Rewritten commit messages couldn't be pushed normally | History rewrite changes commit ids | Backup branch, then `--force-with-lease` after the user's go-ahead |
| Users couldn't find their local pharmacy | 14 days of schedule covered only 1,068 pharmacies | Fetch 55 days (2,524) — see the open issue below |
| Push builds would have kept the old 14-day data | Push builds restore the cached file | Day count added to the cache key |
| Another session edited the same files while a change was being committed | Shared working tree | Staged only the relevant hunk (`git apply --cached`) so the other work stayed uncommitted |
| Overpass (OSM) research query failed | `502 Bad Gateway` from overpass-api.de, a mirror returned HTML | Retried; the main endpoint answered on the second try |
| Map tiles didn't render in the Docker preview ("Worker failed to load") | nginx has no MIME type for `.mjs` and served MapLibre's worker as `application/octet-stream`; Pages sends `text/javascript` | `types { text/javascript mjs; }` in `docker/nginx.conf` |
| Area search box narrower and the "Radius" text touching its select after the React port | The port dropped the `#area-search` and `#radius-label` ids that `style.css` still targeted | Classes `.area-search` and `.radius-label` |
| Blank page in browsers without WebGL 2 | MapLibre 6 throws in its constructor; with no error boundary React unmounted the whole app, list included | Error boundary around `MapView` showing a notice in the map pane; e2e test with WebGL 2 switched off |

## Known issues and limitations (open)

- **Not all pharmacies are listed.** Only those with a duty in the fetched 57 days; regular opening
  hours are unknown; Piraeus is not covered. Tracked in [../TODO.md](../TODO.md); options in
  [data-source.md](data-source.md#alternatives-that-were-evaluated).
- **Depends on the FSA HTML.** If the site changes its markup or blocks the scraper, scheduled runs fail
  and the site keeps serving the last data, which then slowly goes stale. Only the footer's "Updated"
  time shows this; there is no staleness warning yet.
- **No reuse licence** for the FSA data. The scraper is deliberately light (one request per second,
  every 3 hours) and credits the source; contacting the association was suggested but hasn't happened.
- **Partial coverage isn't highlighted** for custom time ranges: a pharmacy closing at 23:00 appears for
  22:00–02:00 (its hours are on the card).
- **"Near me" doesn't move the map** (by design, D17). On wide screens the list follows the map, so
  nearby pharmacies outside the current view are hidden until you pan or press Show all.
- **Phones:** the filter panel is tall and the map is taller than the space below it, so after zooming
  some markers can sit below the fold until you scroll. A collapsible filter panel was suggested.
- **English street names** fall back to Greek where OpenMapTiles has no `name:latin`.
- **Bundle size:** MapLibre makes the main JS ~290 KB gzipped (Vite chunk-size warning). Could be
  split so the list renders before the map library loads.
- **Scheduled runs pause** after 60 days without repository activity (GitHub rule).
- **The old URL** `https://svartvitt-loop.github.io/pharmarcies/` is dead (Pages doesn't redirect).
