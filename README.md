# Εφημερεύοντα φαρμακεία · On-duty pharmacies (Athens)

A static website that lists the on-duty pharmacies of Athens/Attica on a list and a map,
filterable by time (now, next hours, tonight, tomorrow, any date/time range), area and distance.
Greek and English UI.

**Live:** https://svartvitt-loop.github.io/pharmacies/

Design, decisions and known issues are documented in [docs/](docs/README.md).

## How it works

```
GitHub Actions (every 3h) ──► scraper/ (Python) ──► web/public/data/duties.json ──► web/ (Vite + TS) ──► GitHub Pages
```

- **Data source:** [fsa-efimeries.gr](https://fsa-efimeries.gr/), the official duty schedule of the
  Pharmaceutical Association of Attica. For each date the scraper POSTs to `/Home/FilteredHomeResults`
  and parses the returned cards (name, address, area, phone, coordinates, hours). It fetches yesterday
  (for overnight shifts still running) through 55 days ahead (the whole published schedule), one
  request per second.
- **Hours** such as `8 ΠΡΩΙ - 2 ΜΕΣΗΜΕΡΙ & 5 ΑΠΟΓΕΥΜΑ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ` are converted to concrete
  Athens-time intervals (`scraper/fsa_scraper/hours.py`), including overnight shifts and DST changes.
- **Frontend** loads the single JSON file and filters in the browser. Filters live in the URL, so any
  view can be shared. Map: MapLibre GL with a custom streets-only style on OpenFreeMap vector tiles.

### Limitations

- Only **on-duty** pharmacies (εφημερεύοντα); pharmacies open during their regular hours are not listed.
- **Piraeus** has its own association and is not covered by the source.
- There is no official API or reuse license; the scraper is deliberately low-volume.

## Development

With Docker (details in [docs/operations.md](docs/operations.md#local-development)):

```bash
docker compose up                    # dev server with hot reload: http://localhost:5173
docker compose up --build preview    # production build like GitHub Pages: http://localhost:8080/pharmacies/
DATA_SOURCE=scrape docker compose up # real scrape instead of copying the live site's data
./dev check                          # lint, type-check, Playwright and scraper tests, in containers
./dev help                           # all tasks (build, test, npm …, sh …)
```

Without Docker:

```bash
# 1. Fetch data
cd scraper
uv run pytest -q
uv run python -m fsa_scraper --days 55 --out ../web/public/data/duties.json

# 2. Run the site
cd ../web
npm install
npm run dev          # http://localhost:5173
npm test             # Playwright smoke tests in the installed Google Chrome
npm run build        # type-check + production build into web/dist
```

## Deployment (GitHub Pages)

1. Push to a GitHub repository.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. The `Scrape and deploy` workflow runs on every push, every 3 hours, and on demand.
   GitHub pauses scheduled workflows after 60 days without repository activity; re-enable it in the Actions tab if that happens.
