import type { Interval, Pharmacy } from "./data";
import { transliterate } from "./greek";
import { lang, locale, t } from "./i18n";
import type { Result } from "./state";
import { HOUR, athensDate, formatClock, formatDay } from "./time";

export type Status = "open" | "closing" | "later";

export function status(result: Result, now: number): Status {
  if (!result.current) return "later";
  return result.current.end - now <= HOUR ? "closing" : "open";
}

/** Pharmacy text as stored (Greek capitals) or transliterated for the English UI. */
export function display(text: string): string {
  return lang() === "en" ? transliterate(text) : text;
}

export function statusText(result: Result, now: number): string {
  const loc = locale();
  if (result.current) {
    const label = status(result, now) === "closing" ? t("closingSoon") : t("openNow");
    return `${label} · ${t("until")} ${formatClock(result.current.end, loc)}`;
  }
  const next = result.matched.find((i) => i.start > now);
  if (!next) return t("closed");
  const day = athensDate(next.start) === athensDate(now) ? "" : `${formatDay(next.start, loc)} `;
  return `${t("opens")} ${day}${formatClock(next.start, loc)}`;
}

export function intervalText(interval: Interval): string {
  const loc = locale();
  const sameDay = athensDate(interval.start) === athensDate(interval.end - 1);
  const end = formatClock(interval.end, loc);
  return `${formatDay(interval.start, loc)} ${formatClock(interval.start, loc)}–${sameDay ? end : `${end} (+1)`}`;
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

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
