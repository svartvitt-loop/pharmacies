"""Parse the HTML fragment returned by fsa-efimeries.gr/Home/FilteredHomeResults."""

from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup


@dataclass
class DutyCard:
    duty_id: str
    name: str
    address: str
    area: str
    phone: str
    hours: str
    lat: float | None
    lng: float | None


def _text(el) -> str:
    return " ".join(el.get_text(" ").split()) if el else ""


def _coords(card) -> tuple[float | None, float | None]:
    link = card.select_one('a[href*="maps"]')
    if not link:
        return None, None
    query = parse_qs(urlparse(link["href"]).query).get("query", [""])[0]
    try:
        lat, lng = (float(x) for x in query.split(","))
    except ValueError:
        return None, None
    return lat, lng


def parse_cards(html: str) -> list[DutyCard]:
    soup = BeautifulSoup(html, "html.parser")
    cards = []
    for card in soup.select("div.card[id]"):
        spans = card.select(".card-text > span")
        lat, lng = _coords(card)
        cards.append(
            DutyCard(
                duty_id=card["id"],
                name=_text(spans[0]) if spans else "",
                address=_text(card.select_one(".card-title h6")),
                area=_text(card.select_one(".card-subtitle")),
                phone=_text(card.select_one(".card-text h6")),
                hours=_text(spans[1]) if len(spans) > 1 else "",
                lat=lat,
                lng=lng,
            )
        )
    return cards
