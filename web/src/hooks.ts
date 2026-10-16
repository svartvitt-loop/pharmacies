import { useEffect, useState, useSyncExternalStore } from "react";
import { loadDataset, type Dataset } from "./data";
import type { LatLng } from "./geo";

export function useDataset(): { data: Dataset | null; error: boolean } {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadDataset()
      .then(setData)
      .catch((e: unknown) => {
        console.error(e);
        setError(true);
      });
  }, []);
  return { data, error };
}

/** The current time, refreshed every minute and on returning to the tab, to keep "open now" fresh. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
  );
}

export type LocateStatus = "locating" | "locationError" | null;

/** Asks the browser for the user's position on demand; onLocated receives it. */
export function useLocate(onLocated: (near: LatLng) => void): { status: LocateStatus; locate: () => void } {
  const [status, setStatus] = useState<LocateStatus>(null);
  const locate = () => {
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus(null);
        onLocated({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setStatus("locationError"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };
  return { status, locate };
}

/** Whether the user already allowed location access, so asking for it shows no prompt. */
export async function locationAllowed(): Promise<boolean> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state === "granted";
  } catch {
    return false; // no Permissions API
  }
}
