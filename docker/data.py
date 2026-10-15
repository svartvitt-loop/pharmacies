"""Put web/public/data/duties.json in place for the local dev environment.

DATA_SOURCE=download (default): copy the file the live site serves, unless the local one is less
                                than DATA_MAX_AGE_HOURS old. No requests to fsa-efimeries.gr.
DATA_SOURCE=scrape:             run the real scraper (~1 min, one request per day fetched).
DATA_SOURCE=keep:               use the local file as it is.
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

OUT = Path("/app/web/public/data/duties.json")
SOURCE = os.environ.get("DATA_SOURCE", "download")
URL = os.environ.get("DATA_URL", "https://svartvitt-loop.github.io/pharmacies/data/duties.json")
MAX_AGE = float(os.environ.get("DATA_MAX_AGE_HOURS", "1")) * 3600
DAYS = os.environ.get("DAYS", "55")


def log(message: str) -> None:
    print(f"data: {message}", flush=True)


def download() -> int:
    if OUT.exists() and (age := time.time() - OUT.stat().st_mtime) < MAX_AGE:
        log(f"{OUT.name} is {age / 60:.0f} min old, keeping it")
        return 0
    try:
        with urllib.request.urlopen(URL, timeout=30) as response:
            body = response.read()
        json.loads(body)
    except (OSError, ValueError) as error:
        if OUT.exists():
            log(f"download failed ({error}); keeping the existing file")
            return 0
        log(f"download failed ({error}) and there is no local file")
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_bytes(body)
    tmp.replace(OUT)
    log(f"downloaded {len(body) // 1024} KiB from {URL}")
    return 0


def scrape() -> int:
    log(f"scraping {DAYS} days from fsa-efimeries.gr")
    command = [sys.executable, "-m", "fsa_scraper", "--days", DAYS, "--out", str(OUT)]
    return subprocess.run(command, cwd="/app/scraper").returncode


def keep() -> int:
    if OUT.exists():
        log(f"keeping {OUT.name}")
        return 0
    log(f"no {OUT.name}; use DATA_SOURCE=download or scrape")
    return 1


if __name__ == "__main__":
    actions = {"download": download, "scrape": scrape, "keep": keep}
    if SOURCE not in actions:
        sys.exit(f"data: unknown DATA_SOURCE={SOURCE!r}; use one of {', '.join(actions)}")
    sys.exit(actions[SOURCE]())
