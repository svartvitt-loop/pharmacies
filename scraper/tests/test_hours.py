from datetime import date

import pytest

from fsa_scraper.hours import HoursParseError, parse_intervals, parse_minutes

H = 60


@pytest.mark.parametrize(
    "text, expected",
    [
        ("8 ΠΡΩΙ - 11 ΒΡΑΔΥ", [(8 * H, 23 * H)]),
        ("8 ΠΡΩΙ - 9 ΒΡΑΔΥ", [(8 * H, 21 * H)]),
        ("8 ΠΡΩΙ - 10 ΒΡΑΔΥ", [(8 * H, 22 * H)]),
        ("8 ΠΡΩΙ - 3:00 ΜΕΣΗΜΕΡΙ", [(8 * H, 15 * H)]),
        ("8 ΠΡΩΙ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ ΗΜΕΡΑΣ", [(8 * H, 32 * H)]),
        ("9 ΒΡΑΔΥ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ", [(21 * H, 32 * H)]),
        (
            "8 ΠΡΩΙ - 2 ΜΕΣΗΜΕΡΙ & 5 ΑΠΟΓΕΥΜΑ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ",
            [(8 * H, 14 * H), (17 * H, 32 * H)],
        ),
        ("8:30 πρωί - 12 μεσημέρι", [(8 * H + 30, 12 * H)]),
        ("7 ΑΠΟΓΕΥΜΑ - 12 ΒΡΑΔΥ", [(19 * H, 24 * H)]),
    ],
)
def test_parse_minutes(text, expected):
    assert parse_minutes(text) == expected


def test_unparseable_raises():
    with pytest.raises(HoursParseError):
        parse_minutes("ΚΛΕΙΣΤΟ")


def test_overnight_across_dst_end():
    # Greece leaves summer time at 04:00 on 2026-10-25 (+03:00 -> +02:00).
    [(start, end)] = parse_intervals("9 ΒΡΑΔΥ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ", date(2026, 10, 24))
    assert start.isoformat() == "2026-10-24T21:00:00+03:00"
    assert end.isoformat() == "2026-10-25T08:00:00+02:00"
