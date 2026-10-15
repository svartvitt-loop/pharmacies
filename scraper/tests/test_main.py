import json
from datetime import datetime, timedelta

from fsa_scraper import __main__ as cli
from fsa_scraper.hours import ATHENS

CARD = """
<div id="1" class="card">
  <div class="card-title"><h6>ΟΔΟΣ ΔΟΚΙΜΗΣ 12</h6></div>
  <div class="card-subtitle">ΚΥΨΕΛΗ</div>
  <div class="card-text"><span>ΦΑΡΜΑΚΕΙΟ</span><span>8 ΠΡΩΙ - 11 ΒΡΑΔΥ</span><h6>2100000000</h6></div>
</div>
"""


def run(monkeypatch, tmp_path, fetch_day, days: int):
    monkeypatch.setattr(cli, "fetch_day", fetch_day)
    out = tmp_path / "duties.json"
    monkeypatch.setattr("sys.argv", ["fsa_scraper", "--days", str(days), "--delay", "0", "--out", str(out)])
    return cli.main(), out


def test_writes_yesterday_to_today_plus_days(monkeypatch, tmp_path):
    code, out = run(monkeypatch, tmp_path, lambda day: CARD, days=2)
    assert code == 0
    today = datetime.now(ATHENS).date()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["dates"] == [(today + timedelta(days=i)).isoformat() for i in range(-1, 3)]
    assert not out.with_name("duties.json.tmp").exists()


def test_stops_as_soon_as_today_fails(monkeypatch, tmp_path):
    fetched = []

    def fetch_day(day):
        fetched.append(day)
        if len(fetched) == 2:  # yesterday, then today
            raise TimeoutError("timed out")
        return CARD

    code, out = run(monkeypatch, tmp_path, fetch_day, days=55)
    assert code == 1
    assert len(fetched) == 2
    assert not out.exists()


def test_skips_other_dates_that_fail(monkeypatch, tmp_path):
    today = datetime.now(ATHENS).date()

    def fetch_day(day):
        if day == today + timedelta(days=1):
            raise ConnectionResetError()
        return CARD

    code, out = run(monkeypatch, tmp_path, fetch_day, days=2)
    assert code == 0
    assert (today + timedelta(days=1)).isoformat() not in json.loads(out.read_text(encoding="utf-8"))["dates"]


def test_does_not_overwrite_good_data_with_unreadable_hours(monkeypatch, tmp_path):
    out = tmp_path / "duties.json"
    out.write_text("previous", encoding="utf-8")
    code, _ = run(monkeypatch, tmp_path, lambda day: CARD.replace("8 ΠΡΩΙ - 11 ΒΡΑΔΥ", "ΑΓΝΩΣΤΟ"), days=2)
    assert code == 1
    assert out.read_text(encoding="utf-8") == "previous"
