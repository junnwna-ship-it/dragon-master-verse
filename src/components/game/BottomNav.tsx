import { useState } from "react";
import { Home, ScrollText, Swords, Library, Wrench, Bug, ShoppingBag, Dumbbell, Sparkles, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameStore, type View } from "@/store/dragons";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const tabs = [
  { id: "lobby", labelKey: "nav.lobby", icon: Home },
  { id: "story", labelKey: "nav.story", icon: ScrollText },
  { id: "vault", labelKey: "nav.vault", icon: Library },
  { id: "training", labelKey: "nav.training", icon: Dumbbell },
  { id: "pvp", labelKey: "nav.pvp", icon: Swords },
  { id: "shop", labelKey: "nav.shop", icon: ShoppingBag },
  { id: "summon", labelKey: "nav.summon", icon: Sparkles },
] as const;
const adminTabs = [
  { id: "admin", labelKey: "nav.admin", icon: Wrench },
  { id: "debug", labelKey: "nav.debug", icon: Bug },
] as const;

export function BottomNav({ desktop = false }: { desktop?: boolean }) {
  const { t, i18n } = useTranslation();
  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const ko = i18n.language.startsWith("ko");
  const allTabs = [...tabs, ...(isAdmin ? adminTabs : [])];
  const select = (id: View) => {
    setView(id);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const renderTab = ({ id, labelKey, icon: Icon }: (typeof allTabs)[number], compact = false) => (
    <button type="button" onClick={() => select(id)} aria-current={view === id ? "page" : undefined}
      className={`flex min-h-12 w-full items-center rounded-xl text-sm font-semibold transition-colors ${compact ? "flex-col justify-center gap-1 px-1 py-2 text-[11px]" : "gap-3 px-4 py-3 text-left"} ${view === id ? "bg-amber-300/10 text-amber-200" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{t(labelKey)}</span>
    </button>
  );

  if (desktop) return (
    <nav aria-label={ko ? "게임 메뉴" : "Game navigation"} className="sticky top-24 space-y-2">
      <p className="px-4 pb-3 text-xs font-bold tracking-widest text-amber-200/70">{ko ? "우리의 모험" : "OUR ADVENTURE"}</p>
      {allTabs.map((tab) => <div key={tab.id}>{renderTab(tab)}</div>)}
    </nav>
  );

  return (
    <nav aria-label={ko ? "게임 메뉴" : "Game navigation"} className="mobile-game-nav sticky bottom-0 z-30 border-t border-slate-700/60 bg-slate-950/95 px-2 pt-2 backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.slice(0, 4).map((tab) => <li key={tab.id}>{renderTab(tab, true)}</li>)}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className={`flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold ${allTabs.slice(4).some((tab) => tab.id === view) ? "bg-amber-300/10 text-amber-200" : "text-slate-300"}`}>
                <Menu className="h-5 w-5" aria-hidden="true" />{ko ? "더보기" : "More"}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="mobile-menu-sheet max-h-[85dvh] overflow-y-auto rounded-t-3xl border-slate-700 bg-slate-900">
              <SheetTitle>{ko ? "더 많은 모험" : "More adventures"}</SheetTitle>
              <SheetDescription>{ko ? "대결, 상점, 소환을 여기에서 찾아보세요." : "Explore the arena, shop and summoning."}</SheetDescription>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">{allTabs.slice(4).map((tab) => <div key={tab.id}>{renderTab(tab)}</div>)}</div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
