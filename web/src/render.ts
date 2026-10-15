import type { Interval, Pharmacy } from "./data";
import type { I18n } from "./i18n";
import { onDuty, type Result } from "./state";
import { HOUR, athensDate, formatClock, formatDay } from "./time";

export type Status = "open" | "closing" | "later" | "closed";

export function status(result: Result, now: number): Status {
  if (!onDuty(result)) return "closed";
  if (!result.current) return "later";
  return result.current.end - now <= HOUR ? "closing" : "open";
}

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

export function directionsUrl(p: Pharmacy): string {
  const target = p.lat !== null ? `${p.lat},${p.lng}` : `${p.address}, ${p.area}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}

export function moreInfoUrl(p: Pharmacy): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`φαρμακείο ${p.name} ${p.address} ${p.area}`)}`;
}
