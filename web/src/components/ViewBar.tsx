import { useI18n } from "../i18n";
import { onDuty, type Result, type View } from "../state";

interface Props {
  shown: Result[] | null; // the listed results; null until the data has loaded
  total: number; // all results on duty
  view: View;
  onViewChange: (view: View) => void;
  onShowAll: () => void;
}

export function ViewBar({ shown, total, view, onViewChange, onShowAll }: Props) {
  const { t, results, inMapArea, closedCount } = useI18n();
  let count = null;
  if (shown) {
    const shownOpen = shown.filter(onDuty).length;
    const shownClosed = shown.length - shownOpen;
    const closedNote = shownClosed ? ` · ${closedCount(shownClosed)}` : "";
    count =
      shownOpen < total ? (
        <>
          {inMapArea(shownOpen, total)}
          {closedNote}
          {" · "}
          <button type="button" className="link-button" onClick={onShowAll}>
            {t("showAll")}
          </button>
        </>
      ) : (
        `${results(total)}${closedNote}`
      );
  }
  return (
    <div className="view-bar">
      <p id="result-count" aria-live="polite">
        {count}
      </p>
      <div className="view-tabs" role="tablist">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            id={`tab-${v}`}
            role="tab"
            type="button"
            aria-selected={view === v}
            onClick={() => onViewChange(v)}
          >
            {t(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
