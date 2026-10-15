import type { Pharmacy } from "../data";
import { directionsUrl, mapsPlatform } from "../format";
import { useI18n } from "../i18n";

const platform = mapsPlatform(navigator.userAgent, navigator.maxTouchPoints);

/** Opens the pharmacy in the phone's maps app, or Google Maps directions in a new tab on the web. */
export function DirectionsLink({ pharmacy, className }: { pharmacy: Pharmacy; className?: string }) {
  const { t } = useI18n();
  // A new tab only on the web: an app link would leave an empty tab behind.
  const newTab = platform === "web" ? { target: "_blank", rel: "noopener" } : {};
  return (
    <a className={className} href={directionsUrl(pharmacy, platform)} {...newTab}>
      <DirectionsIcon />
      {t("directions")}
    </a>
  );
}

/** Material Symbols "directions" (Apache License 2.0). */
function DirectionsIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.71 11.29l-9-9a1 1 0 0 0-1.41 0l-9 9a1 1 0 0 0 0 1.41l9 9a1 1 0 0 0 1.41 0l9-9a1 1 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
    </svg>
  );
}
