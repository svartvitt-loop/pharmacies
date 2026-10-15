import { status, type Result } from "../filter";
import { distanceText, hoursText, moreInfoUrl, statusText } from "../format";
import { useI18n } from "../i18n";
import { DirectionsLink } from "./DirectionsLink";

interface Props {
  result: Result;
  now: number;
  onShowOnMap: (id: string) => void;
}

export function PharmacyCard({ result, now, onShowOnMap }: Props) {
  const i18n = useI18n();
  const { t, display } = i18n;
  const p = result.pharmacy;
  return (
    <article className={`card status-${status(result, now)}`} id={`pharmacy-${p.id}`}>
      <div className="card-meta">
        <span className="area">{display(p.area)}</span>
        {result.distanceKm !== null && <span className="distance">{distanceText(result.distanceKm)}</span>}
      </div>
      <h2>{display(p.name)}</h2>
      <p className="address">
        {display(p.address)}
        {display(p.address) !== p.address && <span className="muted greek">{p.address}</span>}
      </p>
      <p className="status">{statusText(result, now, i18n)}</p>
      <ul className="hours">
        {hoursText(result, i18n).map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
      <div className="actions">
        <a className="btn primary" href={`tel:${p.phone}`}>
          ☎ {t("call")} {p.phone}
        </a>
        <DirectionsLink className="btn" pharmacy={p} />
        <button type="button" className="btn" onClick={() => onShowOnMap(p.id)}>
          {t("showOnMap")}
        </button>
        <a className="btn subtle" href={moreInfoUrl(p)} target="_blank" rel="noopener">
          {t("moreInfo")}
        </a>
      </div>
    </article>
  );
}
