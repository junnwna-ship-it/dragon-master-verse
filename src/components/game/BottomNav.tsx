import { Home, ScrollText, Swords, Library, Wrench, Bug, ShoppingBag, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameStore, type View } from "@/store/dragons";

const tabs: { id: View; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "lobby", labelKey: "nav.lobby", icon: Home },
  { id: "vault", labelKey: "nav.vault", icon: Library },
  { id: "story", labelKey: "nav.story", icon: ScrollText },
  { id: "pvp", labelKey: "nav.pvp", icon: Swords },
  { id: "shop", labelKey: "nav.shop", icon: ShoppingBag },
  { id: "training", labelKey: "nav.training", icon: Dumbbell },
];

export function BottomNav() {
  const { t } = useTranslation();
  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const adminActive = view === "admin";
  const debugActive = view === "debug";
  return (
    <nav className="sticky bottom-0 z-20 border-t border-slate-700/60 bg-slate-900/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
        {tabs.map(({ id, labelKey, icon: Icon }) => {
          const active = view === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => setView(id)}
                className={`flex w-full flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  active ? "bg-slate-800 text-amber-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[11px] font-semibold">{t(labelKey)}</span>
              </button>
            </li>
          );
        })}
        {/* Admin — 가장자리에 작고 흐릿하게. 일반 유저 시선을 끌지 않도록 의도. */}
        <li className="flex w-8 items-stretch">
          <button
            type="button"
            onClick={() => setView("admin")}
            aria-label={t("nav.admin")}
            title={t("nav.admin")}
            className={`flex w-full items-center justify-center rounded-lg py-2 transition-colors ${
              adminActive ? "text-slate-300" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
          </button>
        </li>
        <li className="flex w-8 items-stretch">
          <button
            type="button"
            onClick={() => setView("debug")}
            aria-label={t("nav.debug")}
            title={t("nav.debug")}
            className={`flex w-full items-center justify-center rounded-lg py-2 transition-colors ${
              debugActive ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Bug className="h-3.5 w-3.5" />
          </button>
        </li>
      </ul>
    </nav>
  );
}