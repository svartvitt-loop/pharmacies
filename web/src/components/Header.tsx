import { useI18n, type Lang } from "../i18n";

export function Header({ lang, onLangChange }: { lang: Lang; onLangChange: (lang: Lang) => void }) {
  const { t } = useI18n();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          ✚
        </span>
        <div>
          <h1>{t("title")}</h1>
          <p className="subtitle">{t("subtitle")}</p>
        </div>
      </div>
      <button
        className="lang-toggle"
        type="button"
        aria-label={lang === "el" ? "English" : "Ελληνικά"}
        onClick={() => onLangChange(lang === "el" ? "en" : "el")}
      >
        {lang === "el" ? "EN" : "ΕΛ"}
      </button>
    </header>
  );
}
