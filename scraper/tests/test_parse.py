from fsa_scraper.parse import parse_cards

# Trimmed copy of the markup returned by /Home/FilteredHomeResults (fictional data).
FRAGMENT = """
<div id="map"></div>
<script>var pharmacyMarker = L.marker([37.9, 23.7]);</script>
<div class="row card-deck">
  <div class="card-frame col-xl-4">
    <div id="100001" class="card w-100">
      <div class="card-body ">
        <div class="card-title d-flex justify-content-between"><h6 class="">ΟΔΟΣ ΔΟΚΙΜΗΣ 12</h6></div>
        <div class="card-subtitle text-secondary">ΚΥΨΕΛΗ</div>
        <div class="d-flex justify-content-between">
          <div class="d-flex my-1 flex-column card-text text-small">
            <span>ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΙΑΝΝΗΣ</span>
            <span>8 ΠΡΩΙ - 11 ΒΡΑΔΥ</span>
            <h6 class=" text-secondary">2100000000</h6>
          </div>
        </div>
      </div>
      <div class="card-footer d-flex justify-content-around">
        <a href="tel:2100000000" class="btn btn-outline-primary">Κλήση</a>
        <a href="https://www.google.gr/maps/search/?api=1&amp;query=37.9990000%2C23.7400000" target="_blank">Πλοήγηση</a>
      </div>
    </div>
  </div>
  <div class="card-frame col-xl-4">
    <div id="100002" class="card w-100">
      <div class="card-body ">
        <div class="card-title"><h6>ΑΛΛΗ ΟΔΟΣ 3</h6></div>
        <div class="card-subtitle text-secondary">ΠΑΓΚΡΑΤΙ</div>
        <div class="card-text"><span>ΦΑΡΜΑΚΕΙΟ Ο.Ε.</span><span>9 ΒΡΑΔΥ - 8 ΠΡΩΙ ΕΠΟΜΕΝΗΣ</span><h6>2101111111</h6></div>
      </div>
      <div class="card-footer"><a href="tel:2101111111">Κλήση</a></div>
    </div>
  </div>
</div>
"""


def test_parse_cards():
    first, second = parse_cards(FRAGMENT)
    assert first.duty_id == "100001"
    assert first.name == "ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΙΑΝΝΗΣ"
    assert first.address == "ΟΔΟΣ ΔΟΚΙΜΗΣ 12"
    assert first.area == "ΚΥΨΕΛΗ"
    assert first.phone == "2100000000"
    assert first.hours == "8 ΠΡΩΙ - 11 ΒΡΑΔΥ"
    assert (first.lat, first.lng) == (37.999, 23.74)
    # Missing map link -> no coordinates, but the card is still kept.
    assert second.name == "ΦΑΡΜΑΚΕΙΟ Ο.Ε."
    assert (second.lat, second.lng) == (None, None)
