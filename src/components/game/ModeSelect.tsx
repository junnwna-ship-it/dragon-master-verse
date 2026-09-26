import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { BookOpen, Swords, X, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";

/**
 * 로그인 직후 랜딩에서 노출되는 모드 선택 오버레이.
 * 스토리 모드 / PvP 모드 두 갈래만 제공하며, 시각 언어는 스토리 모드의
 * 시네마틱 글래스 패널(black/60 + white/15 border + amber kicker)과 통일.
 */
export function ModeSelect({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-6 text-center shadow-2xl backdrop-blur-md"
          >
            <button
              onClick={onClose}
              aria-label={t("landing.modal.ariaClose")}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-xs uppercase tracking-[0.3em] text-amber-300/90">
              {t("landing.modeSelect.kicker")}
            </p>
            <Dialog.Title className="mt-2 text-2xl font-bold text-slate-50">
              {t("landing.modeSelect.title")}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-300">
              {t("landing.modeSelect.subtitle")}
            </Dialog.Description>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                to="/story/play/$chapterId"
                params={{ chapterId: "my_dragon" }}
                onClick={onClose}
                className={cardClass(
                  "from-amber-400/20 to-purple-500/20 border-amber-300/40 text-amber-200",
                )}
              >
                <ModeCardBody
                  icon={<BookOpen className="h-6 w-6" />}
                  title={t("landing.modeSelect.storyTitle")}
                  desc={t("landing.modeSelect.storyDesc")}
                />
              </Link>
              <Link
                to="/app"
                search={{ view: "pvp" }}
                onClick={onClose}
                className={cardClass(
                  "from-rose-500/20 to-slate-500/10 border-rose-400/40 text-rose-200",
                )}
              >
                <ModeCardBody
                  icon={<Swords className="h-6 w-6" />}
                  title={t("landing.modeSelect.pvpTitle")}
                  desc={t("landing.modeSelect.pvpDesc")}
                />
              </Link>
            </div>

            <Link
              to="/app"
              onClick={onClose}
              className="mt-5 inline-flex items-center gap-1 text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            >
              {t("landing.modeSelect.lobbyLink")} <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ModeShellProps = {
  icon: React.ReactNode;
  accent: string;
  title: string;
  desc: string;
};

function ModeCardBody({ icon, title, desc }: Omit<ModeShellProps, "accent">) {
  return (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/40">
        {icon}
      </span>
      <span className="text-base font-bold text-slate-50">{title}</span>
      <span className="text-xs leading-relaxed text-slate-300">{desc}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold opacity-90">
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </>
  );
}

const cardClass = (accent: string) =>
  `group flex flex-col items-start gap-2 rounded-2xl border bg-gradient-to-br p-4 text-left backdrop-blur transition hover:scale-[1.02] hover:shadow-lg ${accent}`;
