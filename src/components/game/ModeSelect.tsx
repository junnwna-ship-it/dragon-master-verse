import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { BookOpen, Swords, X, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * 로그인 직후 랜딩에서 노출되는 모드 선택 오버레이.
 * 스토리 모드 / PvP 모드 두 갈래만 제공하며, 시각 언어는 스토리 모드의
 * 시네마틱 글래스 패널(black/60 + white/15 border + amber kicker)과 통일.
 */
export function ModeSelect({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-black/60 p-6 text-center shadow-2xl backdrop-blur-md"
      >
        <button
          onClick={onClose}
          aria-label={t("landing.modal.ariaClose")}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-amber-300/90">
          {t("landing.modeSelect.kicker")}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-50">{t("landing.modeSelect.title")}</h2>
        <p className="mt-2 text-sm text-slate-300">{t("landing.modeSelect.subtitle")}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ModeCard
            to="/story/play/$chapterId"
            params={{ chapterId: "dragon_master" }}
            icon={<BookOpen className="h-6 w-6" />}
            accent="from-amber-400/20 to-purple-500/20 border-amber-300/40 text-amber-200"
            title={t("landing.modeSelect.storyTitle")}
            desc={t("landing.modeSelect.storyDesc")}
            onClick={onClose}
          />
          <ModeCard
            to="/app"
            search={{ view: "pvp" as const }}
            icon={<Swords className="h-6 w-6" />}
            accent="from-rose-500/20 to-slate-500/10 border-rose-400/40 text-rose-200"
            title={t("landing.modeSelect.pvpTitle")}
            desc={t("landing.modeSelect.pvpDesc")}
            onClick={onClose}
          />
        </div>

        <Link
          to="/app"
          onClick={onClose}
          className="mt-5 inline-flex items-center gap-1 text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          {t("landing.modeSelect.lobbyLink")} <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>
    </motion.div>
  );
}

type ModeCardProps = {
  icon: React.ReactNode;
  accent: string;
  title: string;
  desc: string;
  onClick: () => void;
} & (
  | { to: "/story/play/$chapterId"; params: { chapterId: string }; search?: never }
  | { to: "/app"; search?: { view: "pvp" }; params?: never }
);

function ModeCard({ icon, accent, title, desc, onClick, ...link }: ModeCardProps) {
  return (
    <Link
      {...(link as never)}
      onClick={onClick}
      className={`group flex flex-col items-start gap-2 rounded-2xl border bg-gradient-to-br p-4 text-left backdrop-blur transition hover:scale-[1.02] hover:shadow-lg ${accent}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/40">{icon}</span>
      <span className="text-base font-bold text-slate-50">{title}</span>
      <span className="text-xs leading-relaxed text-slate-300">{desc}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold">
        {title} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
