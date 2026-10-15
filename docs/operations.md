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
| `push` touching only `**.md`, `.gitignore`, `LICENSE*`, `.claude/**`, `.vscode/**`, the Docker files (`compose.yaml`, `docker/**`, `.dockerignore`, `.env.example`) | workflow doesn't run |

- **Data cache:** each scrape saves `duties.json` with key `duties-<DAYS>d-<run_id>`; pushes restore the
  newest key with prefix `duties-<DAYS>d-`. Cache keys can't be overwritten, hence one per run.
  `DAYS` (currently 55) is part of the key, so changing it forces a fresh scrape on the next push.
  GitHub evicts caches unused for 7 days; the next push then simply scrapes.
- **Failure behaviour:** the scraper exits non-zero if it can't fetch *today* (it stops right away),
  or if the result looks broken (no readable hours today, or most hours unreadable); the job fails
  and the previously deployed site stays up. Individual future dates that fail are skipped with a
  log line. The output file is written atomically.
- Scraper unit tests run before every build.
- `concurrency: pages` without cancelling: overlapping runs queue instead of racing.
- GitHub pauses scheduled workflows after **60 days without repository activity**; re-enable in the
  Actions tab if the data stops updating.

## Local development

### Docker (recommended)

`compose.yaml` runs everything in containers; only Docker is needed on the host.

| Service | What it does | URL |
|---|---|---|
| `data` | One-shot: puts `web/public/data/duties.json` in place, then exits | — |
| `web` | Vite dev server with hot reload; source bind-mounted | http://localhost:5173 |
| `preview` (profile `preview`) | Production build in nginx under `/pharmacies/`, like GitHub Pages | http://localhost:8080/pharmacies/ |
| `caddy` (profile `lan`) | HTTPS for phones on the LAN, in front of `web` and `preview` | https://&lt;LAN_IP&gt;:8443/ |
| `e2e` (profile `tools`) | Playwright smoke tests in Google Chrome, against their own dev server | — |

```bash
cp .env.example .env                         # once; set HOST_UID/HOST_GID if not 1000, LAN_IP for phones
docker compose up                            # data + dev server
docker compose up --build preview            # + production build (rebuild after code changes)
docker compose --profile preview --profile lan up --build   # everything, incl. HTTPS for phones
./dev check                                  # lint, type-check, unit, scraper and Playwright tests
./dev help                                   # all tasks: up, lint, typecheck, build, test, e2e, npm …, sh …
docker compose down                          # stop (keep volumes: the caddy CA lives in one)
```

**Data** (`docker/data.py`, chosen with `DATA_SOURCE`):

- `download` (default): copies the live site's `data/duties.json`, unless the local file is less than
  an hour old (`DATA_MAX_AGE_HOURS`). No requests to fsa-efimeries.gr. If the download fails, an
  existing file is kept.
- `scrape`: runs the real scraper (~1 min). `DATA_SOURCE=scrape docker compose up`, or just the data
  step: `docker compose run --rm -e DATA_SOURCE=scrape data`. `DAYS` sets the range (default 55).
- `keep`: uses the local file as it is (e.g. one you scraped or edited by hand).

**Details:**

- Containers run as `HOST_UID:HOST_GID` (default 1000), so `duties.json` is owned by you.
- **`./dev`** wraps `docker compose run --rm --no-deps …`, so dev tasks never need Node or Python on
  the host: `npm`/`npx` run in `web`, `uv`/`python`/`pytest` in `data`, the Playwright tests in
  `e2e`. Claude Code is held to this in this repo: `.claude/settings.json` denies host toolchain
  commands, and a `PreToolUse` hook (`.claude/hooks/require-docker.sh`) also catches them inside
  compound commands. The hook reads every `|` as a pipe, so it can block e.g. `perl -pe 's|a|npm|'`.
- **Overhead of `./dev`:** each task starts and removes a container, about 0.5 s (0.9 s the first
  time); the tools themselves run at the same speed. Measured:

  | Command | Total | Tool's own time | Container overhead |
  |---|---|---|---|
  | `./dev lint` | 0.8 s | 0.06 s (oxlint) | ~0.7 s |
  | `./dev scraper-test` | 1.7 s | 0.2 s (pytest) | ~1.5 s, partly Python startup that the host has too |
  | `./dev e2e` | 11 s | 9.7 s (Playwright) | ~1.3 s |
  | hook, per Bash command | ~0 s | | |

  So quick tasks take 1–2 s instead of being instant, and slow ones barely change (about 10%).
  `npm ci` only runs when `package-lock.json` changed. If the overhead ever matters, `./dev` could
  `docker compose exec` into a running container instead (about 0.1–0.2 s).
- `node_modules` is the ordinary `web/node_modules` in the bind-mounted checkout, installed by the
  containers as your user, so the editor on the host sees the same packages (types, oxlint). The
  entrypoint of `web` and `e2e`, `docker/npm-deps.sh`, runs `npm ci` when `package-lock.json`
  changed since the last install, then runs the command; a `flock` on `web/` keeps two containers
  starting at once from installing over each other. (Until 2026-10-16 it was a named volume, which
  left an empty root-owned `web/node_modules` on the host; if an old checkout still has one,
  `docker volume rm pharmacies_web_node_modules` and `rmdir web/node_modules`.)
- The scraper's Python environment lives in the `scraper_venv` volume. `uv run --locked` (the `data`
  service, `./dev python|pytest|scraper-test`) syncs it from `uv.lock` first, so dependency changes
  need no image rebuild and `./dev uv add|lock|…` work as usual. `--locked` stops with an error when
  `pyproject.toml` and `uv.lock` disagree; `./dev uv lock` fixes that.
- Ports 5173 and 8080 listen on `127.0.0.1` only; the `lan` profile's 8443/8081 listen on all
  interfaces (Docker bypasses ufw).
- The preview mounts `web/public/data/` instead of baking it in, so new data needs no rebuild.
  nginx mimics Pages: `/pharmacies` → `/pharmacies/`, `Cache-Control: max-age=600`, `.mjs` as
  `text/javascript`.
- Image versions follow CI: Node 24, Python 3.12, uv. The `e2e` image is built for
  `PLAYWRIGHT_VERSION` in `docker/e2e.Dockerfile`, which must equal the exactly pinned
  `@playwright/test` in `web/package.json`; bump both together.

**Testing on a phone (`lan` profile).** Location ("Near me") needs a secure context, which a phone
only gets over HTTPS. Caddy issues certificates from its own local CA:

1. Set `LAN_IP` in `.env` (`ip route get 1.1.1.1 | grep -oP 'src \K\S+'`) and start with
   `--profile lan`.
2. On the phone (same Wi-Fi), open `http://<LAN_IP>:8081/ca.crt` and install the certificate:
   - Android: Settings → Security → Encryption & credentials → Install a certificate → CA certificate.
   - iOS: install the downloaded profile, then enable it under Settings → General → About →
     Certificate Trust Settings.
3. Open `https://<LAN_IP>:8443/` (dev server, hot reload works) or `…:8443/pharmacies/` (preview).

The CA is stored in the `caddy_data` volume; `docker compose down -v` deletes it and phones then need
the new one. If the machine's IP changes, update `LAN_IP` and restart caddy.

### Without Docker

Not recommended; prefer `./dev`.

```bash
cd scraper
uv run pytest -q
uv run python -m fsa_scraper --days 55 --out ../web/public/data/duties.json   # ~1 min, 57 requests

cd ../web
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (src/*.test.ts, Vitest)
npm run test:e2e   # Playwright smoke tests (e2e/) in Google Chrome, against a fixed dataset
npm run build      # tsc -b (app + config/e2e) + vite build → web/dist
npx vite preview   # serve web/dist (http://localhost:4173)
```

`web/public/data/` is git-ignored; run the scraper once before `npm run dev`. Location ("Near me")
only works over HTTPS or on `localhost`.

## How changes were verified

- **Scraper:** pytest covers every observed hours format, unknown text, the DST night, and card parsing
  against a fictional HTML fixture shaped like the real response.
- **Frontend unit tests** (`./dev test`, Vitest, `web/src/*.test.ts`) cover the pure logic: Athens
  time across the DST change, every time window, matching and ordering, statuses and their texts,
  transliteration, dataset parsing. They pass in any time zone (checked with `TZ=Pacific/Auckland`
  and `America/Los_Angeles`).
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
