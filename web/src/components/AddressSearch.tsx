import { useEffect, useState, type KeyboardEvent } from "react";
import type { Address } from "../filter";
import { searchAddress } from "../geocode";
import type { Bounds } from "../geo";
import { useI18n } from "../i18n";
import { Suggestions } from "./Suggestions";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

interface Props {
  address: Address | null;
  bounds: Bounds | null; // where to look: around the pharmacies
  onChange: (address: Address | null) => void;
}

/**
 * One address at a time: the box shows the chosen address. Typing in it searches for another one,
 * which replaces it when picked; emptying the box removes it.
 */
export function AddressSearch({ address, bounds, onChange }: Props) {
  const { t, lang } = useI18n();
  const label = address?.label ?? "";
  const [query, setQuery] = useState(label);
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<Address[]>([]);
  const [error, setError] = useState(false);
  const q = query.trim();
  // Only text the user typed is searched for, not the chosen address shown in the box.
  const searching = q.length >= MIN_CHARS && query !== label;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAddress(q, lang, bounds, controller.signal).then(
        (addresses) => {
          setFound(addresses);
          setError(false);
        },
        (e: unknown) => {
          if (controller.signal.aborted) return;
          console.error(e);
          setFound([]);
          setError(true);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searching, q, lang, bounds]);

  // While a new query is pending, keep showing the last results.
  const matches = open && searching ? found : [];

  const pick = (picked: Address) => {
    onChange(picked);
    setQuery(picked.label);
    setOpen(false);
  };

  /** Leaving the box without picking: back to the chosen address, if there is one. */
  const restore = () => {
    setOpen(false);
    if (address) setQuery(label);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (matches.length) pick(matches[0]);
    } else if (event.key === "Escape") {
      restore();
    }
  };

  return (
    <div className="search-picker">
      <input
        className="picker-search address-search"
        type="search"
        autoComplete="off"
        placeholder={t("addressPlaceholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value && address) onChange(null);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select(); // typing replaces the chosen address
        }}
        onBlur={restore}
        onKeyDown={onKeyDown}
      />
      {error && open && searching ? (
        <p className="suggestions muted" role="status">
          {t("addressError")}
        </p>
      ) : (
        <Suggestions items={matches} itemKey={(a) => a.label} onPick={pick}>
          {(a) => a.label}
        </Suggestions>
      )}
    </div>
  );
}
