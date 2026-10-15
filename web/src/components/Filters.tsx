import { useState } from "react";
import type { StateUpdate } from "../App";
import type { Dataset } from "../data";
import { useI18n, type StringKey } from "../i18n";
import { RADII_KM, WHEN_OPTIONS, type State } from "../state";
import { athensDate } from "../time";
import { AreaPicker } from "./AreaPicker";

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
  const [nearStatus, setNearStatus] = useState<StringKey | null>(null);

  const changeCustom = (field: keyof typeof custom, value: string) => {
    const next = { ...custom, [field]: value };
    setCustom(next);
    if (next.date && next.from && next.to) onChange(next);
  };

  const toggleNear = () => {
    if (state.near) {
      setNearStatus(null);
      onChange({ near: null });
      return;
    }
    setNearStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearStatus(null);
        onChange((s) => ({ near: { lat: pos.coords.latitude, lng: pos.coords.longitude }, radiusKm: s.radiusKm || 2 }));
      },
      () => setNearStatus("locationError"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

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

      <div className="filter-group">
        <span className="filter-label">{t("areas")}</span>
        <AreaPicker state={state} data={data} now={now} onChange={(areas) => onChange({ areas })} />
      </div>

      <div className="filter-group near">
        <button className="chip" type="button" aria-pressed={!!state.near} onClick={toggleNear}>
          {state.near ? t("nearMeOn") : t("nearMe")}
        </button>
        <label className="radius-label" hidden={!state.near}>
          <span>{t("radius")}</span>
          <select value={state.radiusKm} onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}>
            {RADII_KM.map((km) => (
              <option key={km} value={km}>
                {km ? `${km} km` : t("anyDistance")}
              </option>
            ))}
          </select>
        </label>
        <span className="muted" aria-live="polite">
          {nearStatus && t(nearStatus)}
        </span>
      </div>

      <div className="filter-group near">
        <button className="chip" type="button" aria-pressed={state.showClosed} onClick={() => onChange({ showClosed: !state.showClosed })}>
          {t("showClosed")}
        </button>
      </div>
    </section>
  );
}
