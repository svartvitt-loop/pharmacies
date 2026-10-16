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

/** The chosen address as a removable chip, and a search box suggesting addresses as you type. */
export function AddressSearch({ address, bounds, onChange }: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{ query: string; addresses: Address[] } | null>(null);
  const [error, setError] = useState(false);
  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAddress(q, lang, bounds, controller.signal).then(
        (addresses) => {
          setFound({ query: q, addresses });
          setError(false);
        },
        (e: unknown) => {
          if (controller.signal.aborted) return;
          console.error(e);
          setError(true);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, lang, bounds]);

  // While a new query is pending, keep showing the last results; none for a query too short.
  const matches = open && q.length >= MIN_CHARS && found ? found.addresses : [];

  const pick = (picked: Address) => {
    onChange(picked);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (matches.length) pick(matches[0]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="search-picker">
      {address && (
        <div className="chips">
          <button type="button" className="chip selected" title={t("remove")} onClick={() => onChange(null)}>
            {address.label} ✕
          </button>
        </div>
      )}
      <input
        className="picker-search"
        type="search"
        autoComplete="off"
        placeholder={t("addressPlaceholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {error && open && q.length >= MIN_CHARS ? (
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
