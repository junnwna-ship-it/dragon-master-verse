import { Home, ScrollText, Swords, Library } from "lucide-react";
import { useGameStore, type View } from "@/store/dragons";

const tabs: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "lobby", label: "Lobby", icon: Home },
  { id: "vault", label: "Vault", icon: Library },
  { id: "story", label: "Story", icon: ScrollText },
  { id: "pvp", label: "PvP", icon: Swords },
];

export function BottomNav() {
  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  return (
    <nav className="sticky bottom-0 z-20 border-t border-slate-700/60 bg-slate-900/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
        {tabs.map(({ id, label, icon: Icon }) => {
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
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}