import type { Interval, Pharmacy } from "./data";
import { onDuty, status, type Result } from "./filter";
import type { I18n } from "./i18n";
import { athensDate, formatClock, formatDay } from "./time";

export function statusText(result: Result, now: number, { t, locale }: I18n): string {
  if (!onDuty(result)) return t("closed");
  if (result.current) {
    const label = status(result, now) === "closing" ? t("closingSoon") : t("openNow");
    return `${label} · ${t("until")} ${formatClock(result.current.end, locale)}`;
  }
  const next = result.matched.find((i) => i.start > now);
  if (!next) return t("closed");
  const day = athensDate(next.start) === athensDate(now) ? "" : `${formatDay(next.start, locale)} `;
  return `${t("opens")} ${day}${formatClock(next.start, locale)}`;
}

export function intervalText(interval: Interval, locale: string): string {
  const sameDay = athensDate(interval.start) === athensDate(interval.end - 1);
  const end = formatClock(interval.end, locale);
  return `${formatDay(interval.start, locale)} ${formatClock(interval.start, locale)}–${sameDay ? end : `${end} (+1)`}`;
}

/** Duty hours in the window, or for a closed pharmacy its next duty. */
export function hoursText(result: Result, { t, locale }: I18n): string[] {
  if (onDuty(result)) return result.matched.map((i) => intervalText(i, locale));
  return result.next ? [`${t("nextDuty")}: ${intervalText(result.next, locale)}`] : [];
}

export function distanceText(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Where directions open: the phone's own maps app on iOS and Android, Google Maps on the web elsewhere. */
export type MapsPlatform = "ios" | "android" | "web";

export function mapsPlatform(userAgent: string, maxTouchPoints: number): MapsPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios"; // iPadOS asks for desktop sites
  if (/Android/.test(userAgent)) return "android";
  return "web";
}

/**
 * On phones the maps app opens with the pharmacy as a labelled pin, its own Directions a tap away
 * (geo: has no portable way to ask for a route). On the web, Google Maps directions to it.
 */
export function directionsUrl(p: Pharmacy, platform: MapsPlatform): string {
  const coords = p.lat !== null ? `${p.lat},${p.lng}` : null;
  const place = `${p.address}, ${p.area}`;
  const label = encodeURIComponent(p.name.replace(/[()]/g, ""));
  switch (platform) {
    case "ios": // maps.apple.com links open Apple Maps; q labels the pin at ll
      return coords ? `https://maps.apple.com/?ll=${coords}&q=${label}` : `https://maps.apple.com/?q=${encodeURIComponent(place)}`;
    case "android": // geo: opens the default maps app
      return coords ? `geo:${coords}?q=${coords}(${label})` : `geo:0,0?q=${encodeURIComponent(place)}`;
    case "web":
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords ?? place)}`;
  }
}

export function moreInfoUrl(p: Pharmacy): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`φαρμακείο ${p.name} ${p.address} ${p.area}`)}`;
}
