import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal, flushSync } from "react-dom";
import type { Result } from "../filter";
import type { Bounds, LatLng } from "../geo";
import { useI18n } from "../i18n";
import { PharmacyMap, type Fit } from "../map";
import type { View } from "../state";
import { PharmacyPopup } from "./PharmacyPopup";

export interface MapHandle {
  focus(id: string): void;
  fitResults(animate: boolean): void;
}

interface Props {
  ref: Ref<MapHandle>;
  results: Result[] | null; // null until the data has loaded
  now: number;
  near: LatLng | null;
  fit: Exclude<Fit, false>; // how to place the map on first showing the results
  view: View;
  onBoundsChange: (bounds: Bounds) => void;
}

export function MapView({ ref, results, now, near, fit, view, onBoundsChange }: Props) {
  const { lang } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<PharmacyMap>(null);
  // The map is placed once, the first time it shows results; after that it keeps the user's position.
  const fitPending = useRef(true);
  const [popupContent] = useState(() => document.createElement("div"));
  const [popupId, setPopupId] = useState<string | null>(null);
  const onMove = useEffectEvent(onBoundsChange);

  useEffect(() => {
    const instance = new PharmacyMap(container.current!, popupContent, (bounds) => onMove(bounds), (id) => {
      if (id) flushSync(() => setPopupId(id));
      else setPopupId(null);
    });
    map.current = instance;
    fitPending.current = true;
    return () => {
      map.current = null;
      instance.destroy();
    };
  }, [popupContent]);

  // MapLibre must re-measure after its container changes from hidden to visible.
  useEffect(() => map.current?.resize(), [view]);

  useEffect(() => {
    if (!map.current || !results) return;
    // A hidden map (the List tab on a phone) can't fit anything yet; wait until it is shown.
    // view is a dependency for this reason: switching tabs is what makes it visible.
    const visible = container.current!.offsetWidth > 0;
    map.current.update(results, now, near, lang, fitPending.current && visible ? fit : false);
    if (visible) fitPending.current = false;
  }, [results, now, near, lang, fit, view]);

  useImperativeHandle(
    ref,
    () => ({
      focus(id) {
        map.current?.resize();
        map.current?.focus(id);
      },
      fitResults(animate) {
        map.current?.fitResults(animate);
      },
    }),
    [],
  );

  const popupResult = popupId ? results?.find((r) => r.pharmacy.id === popupId) : undefined;
  return (
    <section className="map-pane" aria-labelledby="tab-map">
      <div id="map" ref={container} />
      {popupResult && createPortal(<PharmacyPopup result={popupResult} now={now} />, popupContent)}
    </section>
  );
}
