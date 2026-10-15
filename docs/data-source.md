# Data source

## The FSA duty site

The Pharmaceutical Association of Attica (Φαρμακευτικός Σύλλογος Αττικής, ΦΣΑ) publishes the official
duty schedule at **https://fsa-efimeries.gr/** (built by ITeQ; ASP.NET Core with htmx and Leaflet).
There is **no documented API and no reuse licence**; the scraper uses the same request the site's own
page makes.

### Endpoint

```
POST https://fsa-efimeries.gr/Home/FilteredHomeResults
Content-Type: application/x-www-form-urlencoded

Date=2026-10-16&IsOpen=false
```

- `Date` — the duty date. The site's date picker offers today through ~8 weeks ahead (on 2026-10-15
  it went to 2026-12-08; a scrape a few hours later got data through 2026-12-09). **Yesterday is still
  served**, which matters for overnight shifts that started yesterday.
- `IsOpen=false` returns every duty of that date; `true` would filter to "open right now".
- The response is an HTML fragment: a `<script>` that adds Leaflet markers, and one Bootstrap card per
  duty. No session, cookie or token is needed. An honest User-Agent
  (`AthensDutyPharmacies/0.1 (static site; polite scheduled fetch)`) is accepted, also from GitHub's
  runners.

### Card structure (what `parse.py` reads)

```html
<div id="292025" class="card w-100">                     ← duty id (not a pharmacy id)
  <div class="card-title"><h6>ΛΟΥΚΗ ΑΚΡΙΤΑ 1</h6></div>    ← address
  <div class="card-subtitle text-secondary">ΑΓ.ΔΗΜΗΤΡΙΟΣ</div>   ← area
  <div class="card-text">
    <span>ΤΖΕΝΕΤΟΓΛΟΥ ΓΕΩΡΓΙΟΣ</span>                    ← pharmacist / company name
    <span>8 ΠΡΩΙ - 11 ΒΡΑΔΥ</span>                       ← duty hours (free text)
    <h6>2109750360</h6>                                  ← phone
  </div>
  <a href="tel:…">  <a href="https://www.google.gr/maps/search/?api=1&query=37.94%2C23.73">  ← coordinates
</div>
```

All pharmacies seen so far have coordinates and a phone number, so no geocoding is needed.

## Duty hours

The hours are free text in Greek capitals. Observed formats (5 sampled dates, ~380 duties):

| Text | Meaning |
|---|---|
| `8 ΠΡΩΙ - 11 ΒΡΑΔΥ` | 08:00–23:00 (most common) |
| `8 ΠΡΩΙ - 2 ΜΕΣΗΜΕΡΙ & 5 ΑΠΟΓΕΥΜΑ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ` | 08:00–14:00 and 17:00–08:00 next day |
| `8 ΠΡΩΙ - 9 ΒΡΑΔΥ` | 08:00–21:00 |
| `8 ΠΡΩΙ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ ΗΜΕΡΑΣ` | 24-hour duty |
| `9 ΒΡΑΔΥ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ` | night duty |
| `8 ΠΡΩΙ - 10 ΒΡΑΔΥ` | 08:00–22:00 |
| `8 ΠΡΩΙ - 3:00 ΜΕΣΗΜΕΡΙ` | 08:00–15:00 (minutes can appear) |

`hours.py` handles them generically rather than as a fixed list:

- Segments are split on `&`; each is `H[:MM] PERIOD - H[:MM] PERIOD [ΕΠΟΜΕΝΗΣ [ΗΜΕΡΑΣ]]`.
- Accents are stripped first (ΠΡΩΙ/ΠΡΩΪ/πρωί all match).
- Periods: `ΠΡΩΙ` morning (12 → 0); `ΜΕΣΗΜΕΡΙ` noon/early afternoon (11–12 stay, 1–5 → +12);
  `ΑΠΟΓΕΥΜΑ` afternoon (+12); `ΒΡΑΔΥ` evening (+12, and `12 ΒΡΑΔΥ` = midnight); `ΜΕΣΑΝΥΧΤΑ` = 24:00.
- `ΕΠΟΜΕΝΗΣ`, or an end that is not after the start, means the shift ends the next day.
- Wall-clock times are built first and the `Europe/Athens` zone attached afterwards, so a night duty
  across the DST change is right (2026-10-24 21:00+03:00 → 2026-10-25 08:00+02:00; there is a test).
- Unparseable text logs a warning and stores the duty with empty intervals instead of failing the run.
  So far every duty has parsed.

## Coverage

| Fetch range | Dates | Pharmacies | Duties | Areas |
|---|---|---|---|---|
| yesterday + 14 days (first version) | 16 | 1,068 | 1,225 | 162 |
| yesterday + 55 days (current) | 57 | **2,524** | 4,333 | — |

About 76 pharmacies are on duty per day. Within 57 days, 1,523 pharmacies appear once, 670 twice and
the rest 3–8 times, so the rotation for most pharmacies is several weeks long. That is why the 14-day
version showed fewer than half of the pharmacies, and why even 55 days may still miss a few.

### What is not covered

- **Pharmacies that are not on duty in the fetched range** are unknown to the site.
- **Regular opening hours.** A pharmacy open on its normal weekday schedule but not on duty is not
  shown as open. The source only has duties.
- **Piraeus.** The Piraeus municipalities (Πειραιάς, Νίκαια, Κερατσίνι, Κορυδαλλός, Σαλαμίνα…) belong to
  the separate Pharmaceutical Association of Piraeus and are absent from the data. (`Ν.ΠΕΡΑΜΟΣ` in the
  data is Nea Peramos in West Attica, not Perama.)

## Load on the source

One request per date with a 1-second delay and up to 3 retries: 57 requests (~1 minute) per scheduled
run, every 3 hours. Pushes that change only code reuse the cached file and make no requests
(see [operations.md](operations.md)). The site footer credits the association and tells users to call
before going, since duties can change at short notice.

## Alternatives that were evaluated

| Option | Result |
|---|---|
| Official open data (data.gov.gr) | No dataset of pharmacies found. EOPYY only publishes notices about its own few state pharmacies. |
| FSA main site (fsa.gr) | No public member list or pharmacy search. |
| **OpenStreetMap** (one Overpass query, `area["ISO3166-2"="GR-I"]`, `amenity=pharmacy`) | **2,356** pharmacies in the Attica region in a single call, but: name 47%, street 56%, phone 11%, **opening hours 8%**. Only **55%** of the official duty pharmacies have an OSM pharmacy within 75 m (52% within 50 m, 68% within 150 m). |
| Directory sites (vrisko.gr, xo.gr) | Per-area pages; would need many requests and may conflict with their terms. Not used. |
| Google Places | Needs a paid API key and paginates; not a single call. Not used. |
| Other scrapers | A University of Piraeus thesis (2025) scraped the same FSA site with headless Chromium for an Android app — confirms the approach; no reusable data. |

Conclusion so far: the FSA schedule is the only authoritative source; OSM could be an extra,
clearly-marked "unverified" layer for regular hours and uncovered areas. This is tracked in
[../TODO.md](../TODO.md).
