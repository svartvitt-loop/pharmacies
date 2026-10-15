# Project rules

- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:
  `<type>(<optional scope>): <description>`, e.g. `feat(map): show only streets and street names`.
  Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
  Scopes used in this repo: `scraper`, `web`, `map`, `ci`.
- Run nothing from the project's toolchains on the host: no `npm`, `npx`, `node`, `uv`, `python`,
  `pytest`, `playwright`, `tsc`, `vite` or `oxlint`. Use `./dev <task>` (`./dev help` lists them), or
  `docker compose run --rm --no-deps <web|data|test> …` for anything else. A hook enforces this.
