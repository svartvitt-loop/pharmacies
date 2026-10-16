import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal, flushSync } from "react-dom";
import type { Frame, Result } from "../filter";
import type { Bounds } from "../geo";
import { useI18n } from "../i18n";
import { PharmacyMap, type Camera, type PlaceMarks } from "../map";
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
  marks: PlaceMarks; // what the place filter draws
  frame: Frame; // where the place filter wants the map
  frameKey: string; // changes with the place filter; the map moves to frame then
  view: View;
  onBoundsChange: (bounds: Bounds) => void;
}

export function MapView({ ref, results, now, marks, frame, frameKey, view, onBoundsChange }: Props) {
  const { lang } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<PharmacyMap>(null);
  // The frameKey the map was last placed for; null until it is first placed. Other changes
  // (time window, language, show closed) keep the user's position.
  const placedFor = useRef<string | null>(null);
  const [popupContent] = useState(() => document.createElement("div"));
  const [popupId, setPopupId] = useState<string | null>(null);
  const onMove = useEffectEvent(onBoundsChange);

  useEffect(() => {
    const instance = new PharmacyMap(container.current!, popupContent, (bounds) => onMove(bounds), (id) => {
      if (id) flushSync(() => setPopupId(id));
      else setPopupId(null);
    });
    map.current = instance;
    placedFor.current = null;
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
    let camera: Camera | null = null;
    if (visible && placedFor.current !== frameKey) {
      // First placement jumps (to central Athens without a place filter); later ones fly, and
      // turning the place filter off leaves the map where it is.
      const first = placedFor.current === null;
      const fit = frame ?? (first ? "athens" : null);
      if (fit) camera = { fit, animate: !first };
      placedFor.current = frameKey;
    }
    map.current.update(results, now, marks, lang, camera);
  }, [results, now, marks, lang, frame, frameKey, view]);

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
