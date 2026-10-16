import { useEffect, useEffectEvent, useState } from "react";
import type { Dataset } from "../data";
import { PLACES, WHEN_OPTIONS, type Place } from "../filter";
import { locationAllowed, useLocate } from "../hooks";
import { useI18n, type StringKey } from "../i18n";
import type { State, StateUpdate } from "../state";
import { athensDate } from "../time";
import { AddressSearch } from "./AddressSearch";
import { AreaPicker } from "./AreaPicker";
import { RadiusSlider } from "./RadiusSlider";

const PLACE_LABELS: Record<Place, StringKey> = { me: "nearMe", address: "address", areas: "areas" };

interface Props {
  state: State;
  data: Dataset | null;
  now: number;
  onChange: (change: StateUpdate) => void;
}

export function Filters({ state, data, now, onChange }: Props) {
  const { t } = useI18n();
  // The custom window applies only once all three fields are filled in.
  const [custom, setCustom] = useState({ date: state.date, from: state.from, to: state.to });
  const { status: locateStatus, locate } = useLocate((near) => onChange({ near }));

  // A link with place=me finds the user on load, but only if that shows no permission prompt.
  const locateOnLoad = useEffectEvent(() => {
    if (state.place === "me" && !state.near) locationAllowed().then((allowed) => allowed && locate());
  });
  useEffect(() => {
    locateOnLoad();
  }, []);

  const changeCustom = (field: keyof typeof custom, value: string) => {
    const next = { ...custom, [field]: value };
    setCustom(next);
    if (next.date && next.from && next.to) onChange(next);
  };

  const choosePlace = (place: Place | null) => {
    onChange({ place });
    if (place === "me" && !state.near) locate();
  };

  const radius = <RadiusSlider radiusKm={state.radiusKm} onChange={(radiusKm) => onChange({ radiusKm })} />;

  return (
    <section className="filters" aria-label="Filters">
      <div className="filter-group">
        <span className="filter-label">{t("when")}</span>
        <div className="chips" role="group">
          {WHEN_OPTIONS.map((when) => (
            <button key={when} type="button" className="chip" aria-pressed={state.when === when} onClick={() => onChange({ when })}>
              {t(when)}
            </button>
          ))}
        </div>
        <div className="custom-range" hidden={state.when !== "custom"}>
          <label>
            <span>{t("date")}</span>
            <input
              type="date"
              value={custom.date}
              min={data ? athensDate(now) : undefined}
              max={data?.dates[data.dates.length - 1]}
              onChange={(e) => changeCustom("date", e.target.value)}
            />
          </label>
          <label>
            <span>{t("from")}</span>
            <input type="time" step="900" value={custom.from} onChange={(e) => changeCustom("from", e.target.value)} />
          </label>
          <label>
            <span>{t("to")}</span>
            <input type="time" step="900" value={custom.to} onChange={(e) => changeCustom("to", e.target.value)} />
          </label>
        </div>
      </div>

      {/* One place filter at a time; each panel keeps its input while another is chosen. */}
      <div className="filter-group">
        <span className="filter-label">{t("where")}</span>
        <div className="chips" role="group">
          {[null, ...PLACES].map((place) => (
            <button
              key={place ?? "everywhere"}
              type="button"
              className="chip"
              aria-pressed={state.place === place}
              onClick={() => choosePlace(place)}
            >
              {t(place ? PLACE_LABELS[place] : "everywhere")}
            </button>
          ))}
        </div>
        {state.place === "me" && (
          <div className="place-panel">
            {radius}
            {!state.near && locateStatus !== "locating" && (
              <button type="button" className="chip" onClick={locate}>
                {t("findMe")}
              </button>
            )}
            <span className="muted" aria-live="polite">
              {locateStatus && t(locateStatus)}
            </span>
          </div>
        )}
        {state.place === "address" && (
          <div className="place-panel">
            <AddressSearch address={state.address} bounds={data?.bounds ?? null} onChange={(address) => onChange({ address })} />
            {radius}
          </div>
        )}
        {state.place === "areas" && (
          <AreaPicker state={state} data={data} now={now} onChange={(areas) => onChange({ areas })} />
        )}
      </div>

      <div className="filter-group near">
        <button className="chip" type="button" aria-pressed={state.showClosed} onClick={() => onChange({ showClosed: !state.showClosed })}>
          {t("showClosed")}
        </button>
      </div>
    </section>
  );
}
