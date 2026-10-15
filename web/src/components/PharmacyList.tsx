import { useI18n } from "../i18n";
import { onDuty, type Result } from "../state";
import { PharmacyCard } from "./PharmacyCard";

interface Props {
  results: Result[] | null; // null until the data has loaded
  now: number;
  emptyMessage: string;
  error: boolean;
  onShowOnMap: (id: string) => void;
}

/** Pharmacies on duty (or emptyMessage if there are none), then the closed ones under their own heading. */
export function PharmacyList({ results, now, emptyMessage, error, onShowOnMap }: Props) {
  const { t } = useI18n();
  let content;
  if (error) {
    content = <p className="empty error">{t("loadError")}</p>;
  } else if (!results) {
    content = <p className="empty">{t("loading")}</p>;
  } else {
    const open = results.filter(onDuty);
    const closed = results.filter((r) => !onDuty(r));
    const card = (r: Result) => <PharmacyCard key={r.pharmacy.id} result={r} now={now} onShowOnMap={onShowOnMap} />;
    content = (
      <>
        {open.length ? open.map(card) : <p className="empty">{emptyMessage}</p>}
        {closed.length > 0 && (
          <>
            <h2 className="group-heading">{t("closed")}</h2>
            {closed.map(card)}
          </>
        )}
      </>
    );
  }
  return (
    <section id="list" className="list" aria-labelledby="tab-list">
      {content}
    </section>
  );
}
