"""Fetch duty schedules for yesterday..today+N days and write a single JSON file.

Usage: uv run python -m fsa_scraper --days 55 --out ../web/public/data/duties.json
"""

import argparse
import hashlib
import json
import logging
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

from .hours import ATHENS, HoursParseError, parse_intervals
from .parse import parse_cards

SOURCE = "https://fsa-efimeries.gr/"
ENDPOINT = SOURCE + "Home/FilteredHomeResults"
USER_AGENT = "AthensDutyPharmacies/0.1 (static site; polite scheduled fetch)"

log = logging.getLogger("fsa_scraper")


def fetch_day(day: date, retries: int = 3) -> str:
    body = urllib.parse.urlencode({"Date": day.isoformat(), "IsOpen": "false"}).encode()
    request = urllib.request.Request(ENDPOINT, data=body, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8")
        except OSError as exc:
            if attempt == retries:
                raise
            log.warning("fetch %s failed (%s), retrying", day, exc)
            time.sleep(5 * attempt)
    raise AssertionError("unreachable")


def pharmacy_id(name: str, address: str) -> str:
    return hashlib.sha1(f"{name}|{address}".encode()).hexdigest()[:10]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=55, help="days ahead of today to fetch (FSA publishes ~8 weeks)")
    parser.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    today = datetime.now(ATHENS).date()
    days = [today + timedelta(days=i) for i in range(-1, args.days + 1)]

    pharmacies: dict[str, dict] = {}
    duties: list[dict] = []
    fetched_dates: list[str] = []

    for i, day in enumerate(days):
        if i:
            time.sleep(args.delay)
        try:
            cards = parse_cards(fetch_day(day))
        except OSError as exc:
            log.error("giving up on %s: %s", day, exc)
            continue
        if not cards:
            log.warning("no duties listed for %s", day)
            continue
        fetched_dates.append(day.isoformat())
        for card in cards:
            pid = pharmacy_id(card.name, card.address)
            pharmacies.setdefault(pid, {
                "id": pid,
                "name": card.name,
                "address": card.address,
                "area": card.area,
                "phone": card.phone,
                "lat": card.lat,
                "lng": card.lng,
            })
            try:
                intervals = [[s.isoformat(), e.isoformat()] for s, e in parse_intervals(card.hours, day)]
            except HoursParseError as exc:
                log.warning("%s (%s): %s", card.name, day, exc)
                intervals = []
            duties.append({"p": pid, "date": day.isoformat(), "hours": card.hours, "intervals": intervals})
        log.info("%s: %d duties", day, len(cards))

    if today.isoformat() not in fetched_dates:
        log.error("could not fetch today's duties; not writing output")
        return 1

    out = {
        "generatedAt": datetime.now(ATHENS).isoformat(timespec="seconds"),
        "source": SOURCE,
        "dates": fetched_dates,
        "pharmacies": sorted(pharmacies.values(), key=lambda p: (p["area"], p["name"])),
        "duties": duties,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log.info("wrote %d pharmacies, %d duties to %s", len(pharmacies), len(duties), args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
