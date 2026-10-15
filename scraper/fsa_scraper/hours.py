"""Parse FSA duty-hours text (e.g. "8 ΠΡΩΙ - 2 ΜΕΣΗΜΕΡΙ & 5 ΑΠΟΓΕΥΜΑ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ")
into concrete time intervals."""

import re
import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

ATHENS = ZoneInfo("Europe/Athens")

_TIME = r"(\d{1,2})(?:[:.](\d{2}))?\s*([Α-Ω]+)"
_SEGMENT = re.compile(rf"{_TIME}\s*-\s*{_TIME}(\s+ΕΠΟΜΕΝΗΣ)?")


class HoursParseError(ValueError):
    pass


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.upper())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _to_minutes(hour: str, minute: str | None, period: str) -> int:
    h, m = int(hour), int(minute or 0)
    if period.startswith("ΠΡΩ"):  # morning
        h = h % 12
    elif period.startswith("ΜΕΣΗΜ"):  # noon / early afternoon: "12 ΜΕΣΗΜΕΡΙ", "2 ΜΕΣΗΜΕΡΙ"
        h = h if h >= 11 else h + 12
    elif period.startswith("ΑΠΟΓ"):  # afternoon
        h = h if h >= 12 else h + 12
    elif period.startswith("ΒΡΑΔ"):  # evening/night; "12 ΒΡΑΔΥ" is midnight
        h = 24 if h == 12 else (h if h > 12 else h + 12)
    elif period.startswith("ΜΕΣΑΝ"):  # midnight
        h = 24
    else:
        raise HoursParseError(f"unknown period {period!r}")
    return h * 60 + m


def parse_minutes(text: str) -> list[tuple[int, int]]:
    """Return (start, end) minute offsets from the start of the duty date.
    End may exceed 1440 when the shift runs into the next day."""
    norm = _normalize(text)
    intervals = []
    for part in norm.split("&"):
        match = _SEGMENT.search(part)
        if not match:
            raise HoursParseError(f"cannot parse {text!r}")
        sh, sm, sp, eh, em, ep, next_day = match.groups()
        start = _to_minutes(sh, sm, sp)
        end = _to_minutes(eh, em, ep)
        if next_day or end <= start:
            end += 24 * 60
        intervals.append((start, end))
    return intervals


def parse_intervals(text: str, day: date) -> list[tuple[datetime, datetime]]:
    """Return timezone-aware (start, end) datetimes in Athens time."""
    midnight = datetime(day.year, day.month, day.day)

    def at(minutes: int) -> datetime:
        # Build the wall-clock time first, then attach the zone, so DST changes are respected.
        return (midnight + timedelta(minutes=minutes)).replace(tzinfo=ATHENS)

    return [(at(s), at(e)) for s, e in parse_minutes(text)]
