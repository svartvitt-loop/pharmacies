# Documentation

A static website that shows the **on-duty pharmacies (εφημερεύοντα φαρμακεία) of Athens/Attica** on a
list and a map, filterable by time, area and distance, in Greek and English.

- Live site: https://svartvitt-loop.github.io/pharmacies/
- Repository: https://github.com/svartvitt-loop/pharmacies

## What the project set out to do

The original brief: a simple website showing the pharmacies that are open in Athens, with

- a **list view** and a **map view**,
- **filters** in both: areas of interest, and dates/time ranges the pharmacy should be open,
- **links** to each pharmacy (phone, maybe products) — explicitly lower priority,
- above all: pharmacies **open now, or in the next hours or days**, as far as that is known.

## Where to read what

| File | Contents |
|---|---|
| [architecture.md](architecture.md) | Components, data flow, repository layout, the data file format |
| [data-source.md](data-source.md) | The FSA duty-schedule endpoint, how it is parsed, coverage numbers, alternatives that were evaluated |
| [frontend.md](frontend.md) | UI behaviour: time windows, filters, list/map interaction, statuses, languages, URL state |
| [filter-where.md](filter-where.md) | The Where (place) filter: requirements, features and appearance (no implementation); the source of truth |
| [map.md](map.md) | Map stack (MapLibre + OpenFreeMap), the custom style, colour history, markers |
| [operations.md](operations.md) | Hosting, GitHub repo and access, the CI workflow, local development, how changes are tested |
| [decisions.md](decisions.md) | Decision log: what was decided, why, and the trade-offs |
| [problems.md](problems.md) | Problems hit during development and how they were solved; known issues and limitations |

The open work items live in [../TODO.md](../TODO.md); commit conventions in [../CLAUDE.md](../CLAUDE.md).

## Key facts at a glance

| | |
|---|---|
| Data source | [fsa-efimeries.gr](https://fsa-efimeries.gr/) — official duty schedule of the Pharmaceutical Association of Attica (ΦΣΑ) |
| Coverage | Yesterday + 55 days ahead; ~2,500 pharmacies, ~76 on duty per day; **Piraeus not included** |
| Scraper | Python 3.12 (`.python-version`), BeautifulSoup, stdlib `urllib`; pytest, ruff |
| Frontend | Vite 8 + TypeScript 7 + React 19 (React Compiler), oxlint; MapLibre GL 6 with OpenFreeMap vector tiles; Vitest unit tests, Playwright smoke tests |
| Hosting | GitHub Pages, built and deployed by GitHub Actions every 3 hours |
| Languages | Greek and English (English shows ELOT 743 transliterations of names/addresses) |
