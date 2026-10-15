"""HTTP access to fsa-efimeries.gr: the same request per date that the site's own page makes."""

import http.client
import logging
import time
import urllib.parse
import urllib.request
from datetime import date

SOURCE = "https://fsa-efimeries.gr/"
ENDPOINT = SOURCE + "Home/FilteredHomeResults"
USER_AGENT = "AthensDutyPharmacies/0.1 (static site; polite scheduled fetch)"

# Network errors, and responses cut short (http.client.IncompleteRead is not an OSError).
FETCH_ERRORS = (OSError, http.client.HTTPException)

log = logging.getLogger(__name__)


def fetch_day(day: date, retries: int = 3) -> str:
    body = urllib.parse.urlencode({"Date": day.isoformat(), "IsOpen": "false"}).encode()
    request = urllib.request.Request(ENDPOINT, data=body, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8")
        except FETCH_ERRORS as exc:
            if attempt == retries:
                raise
            log.warning("fetch %s failed (%s), retrying", day, exc)
            time.sleep(5 * attempt)
    raise AssertionError("unreachable")
