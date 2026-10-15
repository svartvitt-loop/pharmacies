"""Fetch duty schedules for yesterday..today+N days and write a single JSON file.

Usage: uv run python -m fsa_scraper --days 55 --out ../web/public/data/duties.json
"""

import argparse
import json
import logging
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from .dataset import build_dataset, problems
from .fetch import FETCH_ERRORS, SOURCE, fetch_day
from .hours import ATHENS
from .parse import DutyCard, parse_cards

log = logging.getLogger("fsa_scraper")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=55, help="days ahead of today to fetch (FSA publishes ~8 weeks)")
    parser.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    today = datetime.now(ATHENS).date()
    days = [today + timedelta(days=i) for i in range(-1, args.days + 1)]

    cards_by_day: dict[date, list[DutyCard]] = {}
    for i, day in enumerate(days):
        if i:
            time.sleep(args.delay)
        try:
            cards = parse_cards(fetch_day(day))
        except FETCH_ERRORS as exc:
            log.error("giving up on %s: %s", day, exc)
            cards = []
        else:
            if not cards:
                log.warning("no duties listed for %s", day)
        if not cards and day == today:
            # The output would be useless without today; don't load the source with the other dates.
            log.error("could not fetch today's duties; stopping without writing output")
            return 1
        if cards:
            cards_by_day[day] = cards
            log.info("%s: %d duties", day, len(cards))

    dataset = build_dataset(cards_by_day, datetime.now(ATHENS), SOURCE)
    if found := problems(dataset, today):
        for problem in found:
            log.error("%s; not writing output", problem)
        return 1
    if missing := sum(1 for p in dataset["pharmacies"] if p["lat"] is None):
        log.warning("%d pharmacies have no coordinates, so they won't be on the map", missing)

    write_atomically(args.out, json.dumps(dataset, ensure_ascii=False, separators=(",", ":")))
    log.info("wrote %d pharmacies, %d duties to %s", len(dataset["pharmacies"]), len(dataset["duties"]), args.out)
    return 0


def write_atomically(path: Path, text: str) -> None:
    """Write beside the target, then rename, so a reader (the dev server) never sees half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


if __name__ == "__main__":
    sys.exit(main())
