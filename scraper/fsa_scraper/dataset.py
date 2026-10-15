"""Assemble the duty cards of each date into the duties.json the website reads (format:
docs/architecture.md), and check the result before it is published."""

import hashlib
import logging
from datetime import date, datetime

from .hours import HoursParseError, parse_intervals
from .parse import DutyCard

log = logging.getLogger(__name__)


def pharmacy_id(name: str, address: str) -> str:
    # The FSA card id belongs to a duty, so a pharmacy is recognised across dates by name and address.
    return hashlib.sha1(f"{name}|{address}".encode()).hexdigest()[:10]


def build_dataset(cards_by_day: dict[date, list[DutyCard]], generated_at: datetime, source: str) -> dict:
    pharmacies: dict[str, dict] = {}
    duties: list[dict] = []
    for day, cards in sorted(cards_by_day.items()):
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
    return {
        "generatedAt": generated_at.isoformat(timespec="seconds"),
        "source": source,
        "dates": [day.isoformat() for day, cards in sorted(cards_by_day.items()) if cards],
        "pharmacies": sorted(pharmacies.values(), key=lambda p: (p["area"], p["name"])),
        "duties": duties,
    }


def problems(dataset: dict, today: date) -> list[str]:
    """Reasons not to publish: the site would be wrong, most likely because the source's markup changed.
    A few unreadable hours are normal enough; those duties are kept without intervals."""
    found = []
    duties = dataset["duties"]
    todays = [d for d in duties if d["date"] == today.isoformat()]
    if not todays:
        found.append(f"no duties for today ({today})")
    elif not any(d["intervals"] for d in todays):
        found.append(f"none of today's {len(todays)} duties has readable hours")
    unreadable = sum(1 for d in duties if not d["intervals"])
    if unreadable * 2 > len(duties):
        found.append(f"{unreadable} of {len(duties)} duties have unreadable hours")
    return found
