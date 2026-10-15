import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Filters } from "./components/Filters";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { MapView, type MapHandle } from "./components/MapView";
import { PharmacyList } from "./components/PharmacyList";
import { ViewBar } from "./components/ViewBar";
import { filterPharmacies, onDuty, windowCovered } from "./filter";
import { inBounds, type Bounds } from "./geo";
import { useDataset, useMediaQuery, useNow } from "./hooks";
import { I18nContext, applyToDocument, i18nFor } from "./i18n";
import { readState, writeState, type StateUpdate, type View } from "./state";

export function App() {
  const [state, setState] = useState(() => readState(Date.now()));
  const { data, error } = useDataset();
  const now = useNow();
  // With list and map side by side, the list follows the visible map area.
  const sideBySide = useMediaQuery("(min-width: 1024px)");
  const [mapBounds, setMapBounds] = useState<Bounds | null>(null);
  const map = useRef<MapHandle>(null);
  const i18n = i18nFor(state.lang);
  const { t } = i18n;

  /** Apply a state change. The map keeps its current position; only pins and list update. */
  const update = (change: StateUpdate) =>
    setState((s) => ({ ...s, ...(typeof change === "function" ? change(s) : change) }));
  const setView = (view: View) => update({ view });

  useEffect(() => writeState(state), [state]);
  useEffect(() => applyToDocument(i18n), [i18n]);

  const results = data ? filterPharmacies(data.pharmacies, state, now) : null;
  const emptyMessage = data && windowCovered(data.dates, state, now) ? t("noResults") : t("outOfRange");
  // Result count and list; on wide screens only the pharmacies inside the visible map area.
  const bounds = sideBySide ? mapBounds : null;
  const shown = results && bounds ? results.filter((r) => inBounds(r.pharmacy, bounds)) : results;
  // The counts are about pharmacies on duty; closed ones (if shown) are counted separately.
  const total = results?.filter(onDuty).length ?? 0;

  const showOnMap = (id: string) => {
    // On narrow screens show the map first, so it can measure itself before flying.
    if (!sideBySide && state.view !== "map") flushSync(() => setView("map"));
    map.current?.focus(id);
  };

  return (
    <I18nContext value={i18n}>
      <div className="app" data-view={state.view}>
        <Header lang={state.lang} onLangChange={(lang) => update({ lang })} />
        <Filters state={state} data={data} now={now} onChange={update} />
        <ViewBar
          shown={shown}
          total={total}
          view={state.view}
          onViewChange={setView}
          onShowAll={() => map.current?.fitResults(true)}
        />
        <main className="views">
          <PharmacyList
            results={shown}
            now={now}
            emptyMessage={total ? t("noneInMapArea") : emptyMessage}
            error={error}
            onShowOnMap={showOnMap}
          />
          {/* MapLibre throws without WebGL 2; the list must keep working then. */}
          <ErrorBoundary
            fallback={
              <section className="map-pane" aria-labelledby="tab-map">
                <p className="empty">{t("mapUnavailable")}</p>
              </section>
            }
          >
            <MapView
              ref={map}
              results={results}
              now={now}
              near={state.near}
              // Without an area or location filter, results span all of Attica; zooming to them hides the city.
              fit={state.areas.length || state.near ? "results" : "athens"}
              view={state.view}
              onBoundsChange={setMapBounds}
            />
          </ErrorBoundary>
        </main>
        <Footer generatedAt={data?.generatedAt ?? null} />
      </div>
    </I18nContext>
  );
}
