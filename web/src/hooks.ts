import { useEffect, useState, useSyncExternalStore } from "react";
import { loadDataset, type Dataset } from "./data";

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
