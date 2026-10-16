import { createContext, use } from "react";
import { transliterate } from "./greek";

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
    where: "Πού",
    everywhere: "Παντού",
    nearMe: "📍 Κοντά μου",
    address: "Διεύθυνση",
    areas: "Περιοχές",
    areaPlaceholder: "Αναζήτηση περιοχής…",
    addressPlaceholder: "Οδός και αριθμός…",
    addressError: "Η αναζήτηση διεύθυνσης δεν είναι διαθέσιμη αυτή τη στιγμή.",
    remove: "Αφαίρεση",
    radius: "Ακτίνα",
    anyDistance: "Οποιαδήποτε απόσταση",
    findMe: "📍 Εντοπισμός θέσης",
    locating: "Εντοπισμός…",
    locationError: "Δεν ήταν δυνατός ο εντοπισμός τοποθεσίας.",
    list: "Λίστα",
    map: "Χάρτης",
    results: (n: number) => (n === 1 ? "1 φαρμακείο" : `${n} φαρμακεία`),
    inMapArea: (shown: number, total: number) => `${shown} από ${total} φαρμακεία στην περιοχή του χάρτη`,
    showAll: "Εμφάνιση όλων",
    noneInMapArea: "Κανένα φαρμακείο σε αυτή την περιοχή του χάρτη — απομακρύνετε τον χάρτη ή πατήστε «Εμφάνιση όλων».",
    noResults: "Δεν βρέθηκαν εφημερεύοντα φαρμακεία με αυτά τα φίλτρα.",
    outOfRange: "Δεν υπάρχει ακόμη πρόγραμμα εφημεριών για αυτό το διάστημα.",
    openNow: "Ανοιχτό τώρα",
    closingSoon: "Κλείνει σύντομα",
    until: "έως",
    opens: "Ανοίγει",
    closed: "Εκτός εφημερίας",
    nextDuty: "Επόμενη εφημερία",
    showClosed: "Εμφάνιση και κλειστών",
    closedCount: (n: number) => `${n} εκτός εφημερίας`,
    call: "Κλήση",
    directions: "Οδηγίες",
    moreInfo: "Περισσότερα",
    showOnMap: "Στον χάρτη",
    you: "Η θέση σας",
    updated: "Ενημέρωση",
    source: "Πηγή: Φαρμακευτικός Σύλλογος Αττικής",
    geocoder: "Αναζήτηση διεύθυνσης: Photon (komoot) και Nominatim, © συντελεστές OpenStreetMap",
    disclaimer: "Οι εφημερίες μπορεί να αλλάξουν απρόβλεπτα — καλέστε πριν μεταβείτε.",
    scope:
      "Εμφανίζονται μόνο τα εφημερεύοντα φαρμακεία, όχι όσα λειτουργούν με κανονικό ωράριο. Ο Πειραιάς (Φαρμακευτικός Σύλλογος Πειραιά) δεν περιλαμβάνεται.",
    loading: "Φόρτωση…",
    loadError: "Αποτυχία φόρτωσης δεδομένων. Δοκιμάστε ξανά αργότερα.",
    mapUnavailable: "Ο χάρτης δεν μπορεί να εμφανιστεί σε αυτή τη συσκευή (χρειάζεται WebGL 2). Η λίστα λειτουργεί κανονικά.",
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
    where: "Where",
    everywhere: "Everywhere",
    nearMe: "📍 Near me",
    address: "Address",
    areas: "Areas",
    areaPlaceholder: "Search areas…",
    addressPlaceholder: "Street and number…",
    addressError: "Address search is not available right now.",
    remove: "Remove",
    radius: "Radius",
    anyDistance: "Any distance",
    findMe: "📍 Find my location",
    locating: "Locating…",
    locationError: "Could not get your location.",
    list: "List",
    map: "Map",
    results: (n: number) => (n === 1 ? "1 pharmacy" : `${n} pharmacies`),
    inMapArea: (shown: number, total: number) => `${shown} of ${total} pharmacies in the map area`,
    showAll: "Show all",
    noneInMapArea: "No pharmacies in this part of the map — zoom out or press “Show all”.",
    noResults: "No on-duty pharmacies match these filters.",
    outOfRange: "The duty schedule for this period is not published yet.",
    openNow: "Open now",
    closingSoon: "Closing soon",
    until: "until",
    opens: "Opens",
    closed: "Not on duty",
    nextDuty: "Next duty",
    showClosed: "Also show closed",
    closedCount: (n: number) => `${n} not on duty`,
    call: "Call",
    directions: "Directions",
    moreInfo: "More info",
    showOnMap: "On map",
    you: "You are here",
    updated: "Updated",
    source: "Source: Pharmaceutical Association of Attica",
    geocoder: "Address search: Photon by komoot and Nominatim, © OpenStreetMap contributors",
    disclaimer: "Duty schedules can change unexpectedly — call before you go.",
    scope:
      "Only on-duty pharmacies are shown, not those open during regular hours. Piraeus (covered by a separate association) is not included.",
    loading: "Loading…",
    loadError: "Could not load data. Please try again later.",
    mapUnavailable: "The map can't be shown on this device (it needs WebGL 2). The list works as usual.",
  },
} as const;

type Strings = (typeof strings)["el"];
export type StringKey = { [K in keyof Strings]: Strings[K] extends string ? K : never }[keyof Strings];

export interface I18n {
  lang: Lang;
  locale: string;
  t(key: StringKey): string;
  /** Pharmacy text as stored (Greek capitals) or transliterated for the English UI. */
  display(text: string): string;
  results(n: number): string;
  inMapArea(shown: number, total: number): string;
  closedCount(n: number): string;
}

function makeI18n(lang: Lang): I18n {
  const s = strings[lang];
  return {
    lang,
    locale: lang === "el" ? "el-GR" : "en-GB",
    t: (key) => s[key],
    display: (text) => (lang === "en" ? transliterate(text) : text),
    results: s.results,
    inMapArea: s.inMapArea,
    closedCount: s.closedCount,
  };
}

const I18N = { el: makeI18n("el"), en: makeI18n("en") };

export const I18nContext = createContext<I18n>(I18N.el);

export function i18nFor(lang: Lang): I18n {
  return I18N[lang];
}

export function useI18n(): I18n {
  return use(I18nContext);
}

/** The page language and title, which live outside the React tree. */
export function applyToDocument(i18n: I18n): void {
  document.documentElement.lang = i18n.lang;
  document.title = i18n.t("title");
}
