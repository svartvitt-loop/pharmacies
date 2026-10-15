# Operations

## Hosting and repository

- **Site:** https://svartvitt-loop.github.io/pharmacies/ (GitHub Pages, source "GitHub Actions").
- **Repo:** `github.com/svartvitt-loop/pharmacies`, **public**. It was created private as
  `pharmarcies` (typo); it was made public because Pages on a private repo needs a paid plan, and renamed
  to `pharmacies`. The old `…/pharmarcies/` site URL now returns 404 (Pages URLs don't redirect).
- The Vite build uses a relative base (`base: "./"`), so it works under `/pharmacies/` or any sub-path.

### Access from the development machine

- The repo belongs to a different GitHub account from the developer's default SSH identity (`ppath`),
  which cannot see it. Git uses a **deploy key** with write access, `~/.ssh/pharmacies`, set **per repo**:
  `git config core.sshCommand "ssh -i ~/.ssh/pharmacies -o IdentitiesOnly=yes"`.
- The deploy key covers git push/pull only. Repo settings (Pages, renames, visibility, manual workflow
  runs) are done in the browser. `gh` is not installed. Workflow runs can be checked through the public
  API: `https://api.github.com/repos/svartvitt-loop/pharmacies/actions/runs`.
- To start a deploy without the browser, push a commit (a doc-only commit won't do — see below).
- Commits are authored as **Svartvitt Loop** (repo-local git identity).

## CI/CD: `.github/workflows/deploy.yml`

One workflow, two jobs: **build** (test, scrape or restore, build, upload) → **deploy** (`deploy-pages`).

| Trigger | Scrapes? |
|---|---|
| `schedule` — `17 */3 * * *` (every 3 h, UTC) | yes |
| `workflow_dispatch` (manual "Run workflow") | yes |
| `push` to `main` | no — restores the latest cached `duties.json`; scrapes only if no cache exists |
| `push` touching only `**.md`, `.gitignore`, `LICENSE*`, `.claude/**`, `.vscode/**` | workflow doesn't run |

- **Data cache:** each scrape saves `duties.json` with key `duties-<DAYS>d-<run_id>`; pushes restore the
  newest key with prefix `duties-<DAYS>d-`. Cache keys can't be overwritten, hence one per run.
  `DAYS` (currently 55) is part of the key, so changing it forces a fresh scrape on the next push.
  GitHub evicts caches unused for 7 days; the next push then simply scrapes.
- **Failure behaviour:** the scraper exits non-zero if it can't fetch *today*; the job fails and the
  previously deployed site stays up. Individual future dates that fail are skipped with a log line.
- Scraper unit tests run before every build.
- `concurrency: pages` without cancelling: overlapping runs queue instead of racing.
- GitHub pauses scheduled workflows after **60 days without repository activity**; re-enable in the
  Actions tab if the data stops updating.

## Local development

```bash
cd scraper
uv run pytest -q
uv run python -m fsa_scraper --days 55 --out ../web/public/data/duties.json   # ~1 min, 57 requests

cd ../web
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit + vite build → web/dist
npx vite preview   # serve web/dist (http://localhost:4173)
```

`web/public/data/` is git-ignored; run the scraper once before `npm run dev`. Location ("Near me")
only works over HTTPS or on `localhost`.

## How changes were verified

- **Scraper:** pytest covers every observed hours format, unknown text, the DST night, and card parsing
  against a fictional HTML fixture shaped like the real response.
- **Frontend:** `npm run build` type-checks. Behaviour was checked in **headless Chrome via Playwright**
  (`playwright-core` pointed at the system Chrome with `--use-angle=swiftshader
  --enable-unsafe-swiftshader` so WebGL works without a GPU). Scripts loaded URLs with given filters,
  clicked controls (zoom, On map, Show all, filter chips, language), read `#result-count`/card counts,
  captured console errors and took screenshots. Plain `chrome --headless --screenshot` is not enough
  for the map: it captures before vector tiles load and shows an empty map.
- **Deploys:** checked through the Actions API (job and step conclusions) and by fetching the live
  `data/duties.json`.

## Conventions

- **Conventional Commits** (`CLAUDE.md`): `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`; scopes `scraper`, `web`, `map`, `ci`.
- One commit per feature or change.
- History was rewritten twice early on: commit messages were converted to Conventional Commits
  (force-pushed with `--force-with-lease`), and later all authors were rewritten to Svartvitt Loop.
  File contents were unchanged both times.
