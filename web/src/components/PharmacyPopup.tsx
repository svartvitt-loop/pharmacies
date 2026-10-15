import { status, type Result } from "../filter";
import { directionsUrl, hoursText, statusText } from "../format";
import { useI18n } from "../i18n";

export function PharmacyPopup({ result, now }: { result: Result; now: number }) {
  const i18n = useI18n();
  const { t, display } = i18n;
  const p = result.pharmacy;
  return (
    <div className="popup">
      <strong>{display(p.name)}</strong>
      <div>{`${display(p.address)}, ${display(p.area)}`}</div>
      <div className={`status status-${status(result, now)}`}>{statusText(result, now, i18n)}</div>
      <div className="muted">{hoursText(result, i18n).join(" · ")}</div>
      <div className="popup-actions">
        <a href={`tel:${p.phone}`}>☎ {p.phone}</a>
        <a href={directionsUrl(p)} target="_blank" rel="noopener">
          {t("directions")}
        </a>
      </div>
    </div>
  );
}
