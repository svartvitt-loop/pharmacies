import { useState, type KeyboardEvent } from "react";
import type { Dataset } from "../data";
import { filterPharmacies } from "../filter";
import { fold } from "../greek";
import { useI18n } from "../i18n";
import type { State } from "../state";

interface Props {
  state: State;
  data: Dataset | null;
  now: number;
  onChange: (areas: string[]) => void;
}

/** Selected areas as removable chips, and a search box with suggestions. */
export function AreaPicker({ state, data, now, onChange }: Props) {
  const { t, display } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  let counts = new Map<string, number>();
  let matches: Dataset["areas"] = [];
  if (open && data) {
    const q = fold(query.trim());
    // Count pharmacies per area in the current time window, ignoring the area filter itself.
    counts = new Map();
    for (const r of filterPharmacies(data.pharmacies, { ...state, areas: [], near: null, showClosed: false }, now)) {
      counts.set(r.pharmacy.area, (counts.get(r.pharmacy.area) ?? 0) + 1);
    }
    matches = data.areas
      .filter((a) => !state.areas.includes(a.name) && (!q || a.key.includes(q)))
      .sort((a, b) => (q ? 0 : (counts.get(b.name) ?? 0) - (counts.get(a.name) ?? 0)))
      .slice(0, 10);
  }

  const addArea = (area: string) => {
    onChange([...state.areas, area]);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (matches.length) addArea(matches[0].name);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && !query && state.areas.length) {
      onChange(state.areas.slice(0, -1));
    }
  };

  return (
    <div className="area-picker">
      <div className="chips">
        {state.areas.map((area) => (
          <button
            key={area}
            type="button"
            className="chip selected"
            title={t("removeArea")}
            onClick={() => onChange(state.areas.filter((a) => a !== area))}
          >
            {display(area)} ✕
          </button>
        ))}
      </div>
      <input
        className="area-search"
        type="search"
        autoComplete="off"
        placeholder={t("areaPlaceholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul className="suggestions" role="listbox" hidden={!matches.length}>
        {matches.map((area) => (
          <li
            key={area.name}
            role="option"
            aria-selected={false}
            // mousedown fires before the input's blur hides the list.
            onMouseDown={(event) => {
              event.preventDefault();
              addArea(area.name);
            }}
          >
            {display(area.name)}
            <span className="muted">{counts.get(area.name) ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
