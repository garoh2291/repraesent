import { useTranslation } from "react-i18next";

export function LegalFooter() {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const base = isEn ? "https://repraesent.com/en" : "https://repraesent.com";
  return (
    <div className="shrink-0 flex items-center justify-center gap-4 py-4 border-t border-stone-100">
      <a
        href={`${base}/privacy.html`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
      >
        {isEn ? "Privacy Policy" : "Datenschutz"}
      </a>
      <span className="text-stone-300 text-[11px]">·</span>
      <a
        href={`${base}/impressum.html`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
      >
        Impressum
      </a>
    </div>
  );
}
