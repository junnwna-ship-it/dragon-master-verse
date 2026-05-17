import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage === "en" ? "en" : "ko";
  const next = current === "ko" ? "en" : "ko";
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      aria-label={t("language.label")}
      title={t("language.label")}
      className="flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-amber-300"
    >
      <Languages className="h-3.5 w-3.5" />
      {current === "ko" ? "KO" : "EN"}
    </button>
  );
}