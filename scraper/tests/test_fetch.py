import http.client
from datetime import date

import pytest

from fsa_scraper import fetch


class Response:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self) -> bytes:
        return "<div>ΦΑΡΜΑΚΕΙΟ</div>".encode()


@pytest.fixture
def urlopen(monkeypatch):
    """Replaces urllib's urlopen with one that raises the queued errors first, then answers."""
    calls = []
    errors: list[Exception] = []

    def fake(request, timeout):
        calls.append(request)
        if errors:
            raise errors.pop(0)
        return Response()

    monkeypatch.setattr(fetch.urllib.request, "urlopen", fake)
    monkeypatch.setattr(fetch.time, "sleep", lambda seconds: None)
    return calls, errors


def test_posts_the_date(urlopen):
    calls, _ = urlopen
    assert fetch.fetch_day(date(2026, 10, 16)) == "<div>ΦΑΡΜΑΚΕΙΟ</div>"
    [request] = calls
    assert request.full_url == fetch.ENDPOINT
    assert request.data == b"Date=2026-10-16&IsOpen=false"


def test_retries_network_errors_and_responses_cut_short(urlopen):
    calls, errors = urlopen
    errors += [TimeoutError("timed out"), http.client.IncompleteRead(b"<div")]
    assert fetch.fetch_day(date(2026, 10, 16)) == "<div>ΦΑΡΜΑΚΕΙΟ</div>"
    assert len(calls) == 3


def test_gives_up_after_the_last_retry(urlopen):
    calls, errors = urlopen
    errors += [ConnectionResetError()] * 3
    with pytest.raises(ConnectionResetError):
        fetch.fetch_day(date(2026, 10, 16))
    assert len(calls) == 3
