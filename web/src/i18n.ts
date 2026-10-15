export type Lang = "el" | "en";

const strings = {
  el: {
    title: "Εφημερεύοντα φαρμακεία",
    subtitle: "Αθήνα & Αττική — ανοιχτά τώρα και τις επόμενες μέρες",
    when: "Πότε",
    now: "Τώρα",
    next3h: "Επόμενες 3 ώρες",
    tonight: "Απόψε",
    today: "Σήμερα",
    tomorrow: "Αύριο",
    custom: "Άλλη ημέρα/ώρα",
    date: "Ημερομηνία",
    from: "Από",
    to: "Έως",
    areas: "Περιοχές",
    areaPlaceholder: "Αναζήτηση περιοχής…",
    removeArea: "Αφαίρεση",
    nearMe: "📍 Κοντά μου",
    nearMeOn: "📍 Κοντά μου ✓",
    radius: "Ακτίνα",
    anyDistance: "Οποιαδήποτε",
    locating: "Εντοπισμός…",
    locationError: "Δεν ήταν δυνατός ο εντοπισμός τοποθεσίας.",
    list: "Λίστα",
    map: "Χάρτης",
    results: (n: number) => (n === 1 ? "1 φαρμακείο" : `${n} φαρμακεία`),
    noResults: "Δεν βρέθηκαν εφημερεύοντα φαρμακεία με αυτά τα φίλτρα.",
    outOfRange: "Δεν υπάρχει ακόμη πρόγραμμα εφημεριών για αυτό το διάστημα.",
    openNow: "Ανοιχτό τώρα",
    closingSoon: "Κλείνει σύντομα",
    until: "έως",
    opens: "Ανοίγει",
    closed: "Εκτός εφημερίας",
    call: "Κλήση",
    directions: "Οδηγίες",
    moreInfo: "Περισσότερα",
    showOnMap: "Στον χάρτη",
    you: "Η θέση σας",
    updated: "Ενημέρωση",
    source: "Πηγή: Φαρμακευτικός Σύλλογος Αττικής",
    disclaimer: "Οι εφημερίες μπορεί να αλλάξουν απρόβλεπτα — καλέστε πριν μεταβείτε.",
    scope:
      "Εμφανίζονται μόνο τα εφημερεύοντα φαρμακεία, όχι όσα λειτουργούν με κανονικό ωράριο. Ο Πειραιάς (Φαρμακευτικός Σύλλογος Πειραιά) δεν περιλαμβάνεται.",
    loading: "Φόρτωση…",
    loadError: "Αποτυχία φόρτωσης δεδομένων. Δοκιμάστε ξανά αργότερα.",
  },
  en: {
    title: "On-duty pharmacies",
    subtitle: "Athens & Attica — open now and in the coming days",
    when: "When",
    now: "Now",
    next3h: "Next 3 hours",
    tonight: "Tonight",
    today: "Today",
    tomorrow: "Tomorrow",
    custom: "Pick date/time",
    date: "Date",
    from: "From",
    to: "To",
    areas: "Areas",
    areaPlaceholder: "Search areas…",
    removeArea: "Remove",
    nearMe: "📍 Near me",
    nearMeOn: "📍 Near me ✓",
    radius: "Radius",
    anyDistance: "Any",
    locating: "Locating…",
    locationError: "Could not get your location.",
    list: "List",
    map: "Map",
    results: (n: number) => (n === 1 ? "1 pharmacy" : `${n} pharmacies`),
    noResults: "No on-duty pharmacies match these filters.",
    outOfRange: "The duty schedule for this period is not published yet.",
    openNow: "Open now",
    closingSoon: "Closing soon",
    until: "until",
    opens: "Opens",
    closed: "Not on duty",
    call: "Call",
    directions: "Directions",
    moreInfo: "More info",
    showOnMap: "On map",
    you: "You are here",
    updated: "Updated",
    source: "Source: Pharmaceutical Association of Attica",
    disclaimer: "Duty schedules can change unexpectedly — call before you go.",
    scope:
      "Only on-duty pharmacies are shown, not those open during regular hours. Piraeus (covered by a separate association) is not included.",
    loading: "Loading…",
    loadError: "Could not load data. Please try again later.",
  },
} as const;

type Strings = (typeof strings)["el"];
export type StringKey = { [K in keyof Strings]: Strings[K] extends string ? K : never }[keyof Strings];

let current: Lang = "el";

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  document.title = strings[lang].title;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as StringKey);
  });
}

export function lang(): Lang {
  return current;
}

export function t(key: StringKey): string {
  return strings[current][key];
}

export function resultsLabel(n: number): string {
  return strings[current].results(n);
}

export function locale(): string {
  return current === "el" ? "el-GR" : "en-GB";
}
