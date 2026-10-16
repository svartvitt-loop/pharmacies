import { useI18n } from "../i18n";
import { formatClock, formatDay } from "../time";

export function Footer({ generatedAt }: { generatedAt: number | null }) {
  const { t, locale } = useI18n();
  return (
    <footer className="footer">
      <p>{t("disclaimer")}</p>
      <p>{t("scope")}</p>
      <p>
        <a href="https://fsa-efimeries.gr/" target="_blank" rel="noopener">
          {t("source")}
        </a>
        {" · "}
        {generatedAt !== null && (
          <span>{`${t("updated")}: ${formatDay(generatedAt, locale)} ${formatClock(generatedAt, locale)}`}</span>
        )}
      </p>
      <p>
        <a href="https://photon.komoot.io/" target="_blank" rel="noopener">
          {t("geocoder")}
        </a>
      </p>
    </footer>
  );
}
