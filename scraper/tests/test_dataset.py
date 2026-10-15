from datetime import date, datetime

from fsa_scraper.dataset import build_dataset, pharmacy_id, problems
from fsa_scraper.hours import ATHENS
from fsa_scraper.parse import DutyCard

TODAY = date(2026, 10, 16)
TOMORROW = date(2026, 10, 17)


def card(name: str, area: str = "ΚΥΨΕΛΗ", hours: str = "8 ΠΡΩΙ - 11 ΒΡΑΔΥ") -> DutyCard:
    return DutyCard(
        duty_id="1",
        name=name,
        address=f"ΟΔΟΣ {name} 1",
        area=area,
        phone="2100000000",
        hours=hours,
        lat=37.99,
        lng=23.74,
    )


def build(cards_by_day: dict[date, list[DutyCard]]) -> dict:
    return build_dataset(cards_by_day, datetime(2026, 10, 16, 9, tzinfo=ATHENS), "https://fsa-efimeries.gr/")


def test_a_pharmacy_on_several_dates_is_listed_once():
    dataset = build({date(2026, 10, 30): [card("Α")], TODAY: [card("Α")]})
    [pharmacy] = dataset["pharmacies"]
    assert pharmacy["id"] == pharmacy_id("Α", "ΟΔΟΣ Α 1")
    assert [(d["p"], d["date"]) for d in dataset["duties"]] == [
        (pharmacy["id"], "2026-10-16"),
        (pharmacy["id"], "2026-10-30"),
    ]
    assert dataset["dates"] == ["2026-10-16", "2026-10-30"]


def test_the_file_format():
    dataset = build({TODAY: [card("Β", area="ΠΑΓΚΡΑΤΙ"), card("Γ", area="ΑΘΗΝΑ"), card("Α", area="ΑΘΗΝΑ")]})
    assert dataset["generatedAt"] == "2026-10-16T09:00:00+03:00"
    assert dataset["source"] == "https://fsa-efimeries.gr/"
    assert [p["name"] for p in dataset["pharmacies"]] == ["Α", "Γ", "Β"]  # by area, then name
    assert dataset["pharmacies"][0] == {
        "id": pharmacy_id("Α", "ΟΔΟΣ Α 1"),
        "name": "Α",
        "address": "ΟΔΟΣ Α 1",
        "area": "ΑΘΗΝΑ",
        "phone": "2100000000",
        "lat": 37.99,
        "lng": 23.74,
    }
    assert dataset["duties"][0] == {
        "p": pharmacy_id("Β", "ΟΔΟΣ Β 1"),
        "date": "2026-10-16",
        "hours": "8 ΠΡΩΙ - 11 ΒΡΑΔΥ",
        "intervals": [["2026-10-16T08:00:00+03:00", "2026-10-16T23:00:00+03:00"]],
    }


def test_unreadable_hours_keep_the_duty_without_intervals():
    dataset = build({TODAY: [card("Α", hours="ΚΛΕΙΣΤΟ")]})
    assert dataset["duties"][0]["intervals"] == []
    assert len(dataset["pharmacies"]) == 1


def test_a_few_unreadable_hours_are_no_problem():
    assert problems(build({TODAY: [card("Α"), card("Β", hours="?")]}), TODAY) == []


def test_problem_without_today():
    assert problems(build({TOMORROW: [card("Α")]}), TODAY) == ["no duties for today (2026-10-16)"]


def test_problem_when_none_of_todays_hours_is_readable():
    dataset = build({TODAY: [card("Α", hours="?"), card("Β", hours="?")], TOMORROW: [card("Γ")] * 3})
    assert problems(dataset, TODAY) == ["none of today's 2 duties has readable hours"]


def test_problem_when_most_hours_are_unreadable():
    dataset = build({TODAY: [card("Α"), card("Β", hours="?"), card("Γ", hours="?")]})
    assert problems(dataset, TODAY) == ["2 of 3 duties have unreadable hours"]
