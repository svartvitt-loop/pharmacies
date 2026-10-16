# The "Where" filter

What the place filter does and how it looks, as it is now. Update it with every change. How it is
built is in [frontend.md](frontend.md) and [map.md](map.md); why, in [decisions.md](decisions.md).

## Requirements

- One group, **Where**, whose options exclude each other: **at most one place filter applies** at a time.
- Options: **Everywhere** (no place filter), **Near me**, **Address**, **Areas**.
- **Near me** and **Address** have a radius of **1, 2, 5 or 10 km**. There is no unlimited radius: that
  is Everywhere.
- **Address** is a text field with **autocomplete**, for **one address** at a time.
- **Areas** is a search field ("Search areas…") that suggests the areas with **pharmacies on duty in
  the selected time window**; several areas can be chosen.
- Choosing or changing a place filter **moves the map** to the **smallest view that encloses it**: the
  radius around the location, or the chosen areas.
- The radius is **drawn** on the map. A **street chosen without a house number** is drawn too, along
  its whole length, in the radius colour at half strength.

## Behaviour

| Option | The user gives | Shows | Order | Map goes to |
|---|---|---|---|---|
| Everywhere | — | all of Attica | soonest first | stays where it is |
| Near me | their location, a radius | pharmacies within the radius of the user | nearest first | the radius circle |
| Address | an address, a radius | pharmacies within the radius of the address | nearest first | the radius circle |
| Areas | one or more areas | pharmacies in any chosen area | soonest first | all pharmacies of those areas |

- Each option keeps what was entered while another is chosen; switching back restores it. Only the
  chosen one applies.
- Works together with **When** and **Show closed**.
- With Near me or Address, each card shows the distance. Pharmacies whose location is unknown are
  never hidden by the radius.
- The radius starts at **2 km**.
- The chosen option and its input are part of the page link, so it can be shared, except the user's own
  location, which is never put in the link. Older links that only name areas open as Areas.

## Appearance

- The label **Where / Πού**, then a row of buttons, the chosen one filled: **Everywhere / Παντού**,
  **📍 Near me / 📍 Κοντά μου**, **Address / Διεύθυνση**, **Areas / Περιοχές**.
- Under the buttons, only the chosen option's controls.
- **Radius**: a slider labelled "Radius / Ακτίνα" with the steps 1 km · 2 km · 5 km · 10 km written
  underneath; the current step is bold. Screen readers announce the value ("5 km").
- **Search fields**: suggestions drop down under the field; the first one is highlighted, Enter takes
  it, Escape closes the list.
- **On the map**, all in the same purple:
  - the location (the user or the address): a dot with a white outline;
  - the radius: a faintly filled circle with a thin outline;
  - a chosen street: a pale purple band along the street, under the street names so they stay readable.

## Near me

- Choosing it asks the browser for the user's location and shows "Locating… / Εντοπισμός…". It needs
  a secure (HTTPS) page.
- Opening a link with Near me finds the user straight away only if they have already allowed location
  access, so a shared link never triggers a permission prompt. Otherwise, and after a failure ("Could
  not get your location."), a **📍 Find my location / 📍 Εντοπισμός θέσης** button is shown.
- Until the location is known, nothing is filtered and the map doesn't move.

## Address

- **One field, one address.** After a pick, the field shows the address. Clicking in it selects the
  text, so typing searches for a replacement; leaving the field without picking keeps the address;
  emptying the field removes it. Placeholder: "Street and number… / Οδός και αριθμός…".
- **Autocomplete** starts after 3 characters and a short pause in typing, with up to 6 suggestions
  such as "Σκουφά 10, Κολωνάκι". Only places in and around Attica are suggested, those near central
  Athens first; in English, names are in English where known. If the search service is down, the field
  says "Address search is not available right now."
- **A street without a house number** is drawn along its whole length near the chosen point (up to
  about 5 km away); streets of the same name elsewhere are not. If the street can't be loaded, it is
  simply not drawn; the radius and results are unaffected.

## Areas

- Chosen areas appear as removable chips before the field ("Search areas… / Αναζήτηση περιοχής…").
- Suggestions are the areas with at least one pharmacy on duty in the selected time window, each with
  that number, up to 10; with an empty field, the busiest first. Areas already chosen aren't suggested,
  but stay chosen even if a new time window leaves them without pharmacies.
- Matching ignores accents and capitals and accepts Latin letters (`kyps` finds ΚΥΨΕΛΗ). In English,
  area names are shown in Latin letters.
- Enter takes the first suggestion; Backspace in the empty field removes the last chosen area.

## Map

- The map moves only when the place filter **changes**: another option, radius, location, address or
  set of areas. Changing the time window, Show closed or the language never moves it.
- It **flies** there, so the user can follow. When the page opens it **jumps** straight to the place
  filter from the link, or to central Athens.
- Choosing Everywhere, or removing the address, leaves the map where it is.
- On phones, if the list is showing, the map moves when the user switches to it.
- Separately from this filter, **Show all** and **On map** also move the map, and on wide screens the
  list shows only what the map shows ([frontend.md](frontend.md#list-and-map-together)).

## Privacy

- What is typed in the Address field is sent to an address search service (Photon, by komoot).
- The name and location of a chosen street are sent once to OpenStreetMap's Nominatim, to draw it.
- The user's location is never sent anywhere and never put in the link.
- Both services are credited in the page footer.
