import { t } from "./i18n";
import { directionsUrl, display, distanceText, el, intervalText, moreInfoUrl, status, statusText } from "./render";
import type { Result } from "./state";

export function renderList(
  container: HTMLElement,
  results: Result[],
  now: number,
  emptyMessage: string,
  onShowOnMap: (id: string) => void,
): void {
  if (!results.length) {
    container.replaceChildren(el("p", { className: "empty" }, emptyMessage));
    return;
  }
  container.replaceChildren(...results.map((r) => card(r, now, onShowOnMap)));
}

function card(result: Result, now: number, onShowOnMap: (id: string) => void): HTMLElement {
  const p = result.pharmacy;
  const address = el("p", { className: "address" }, display(p.address));
  if (display(p.address) !== p.address) address.append(el("span", { className: "muted greek" }, p.address));

  const meta = el("div", { className: "card-meta" }, el("span", { className: "area" }, display(p.area)));
  if (result.distanceKm !== null) meta.append(el("span", { className: "distance" }, distanceText(result.distanceKm)));

  const showOnMap = el("button", { type: "button", className: "btn" }, t("showOnMap"));
  showOnMap.addEventListener("click", () => onShowOnMap(p.id));

  return el(
    "article",
    { className: `card status-${status(result, now)}`, id: `pharmacy-${p.id}` },
    meta,
    el("h2", {}, display(p.name)),
    address,
    el("p", { className: "status" }, statusText(result, now)),
    el("ul", { className: "hours" }, ...result.matched.map((i) => el("li", {}, intervalText(i)))),
    el(
      "div",
      { className: "actions" },
      el("a", { className: "btn primary", href: `tel:${p.phone}` }, `☎ ${t("call")} ${p.phone}`),
      el("a", { className: "btn", href: directionsUrl(p), target: "_blank", rel: "noopener" }, t("directions")),
      showOnMap,
      el("a", { className: "btn subtle", href: moreInfoUrl(p), target: "_blank", rel: "noopener" }, t("moreInfo")),
    ),
  );
}
