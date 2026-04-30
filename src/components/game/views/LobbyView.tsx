import { useGameStore } from "@/store/dragons";
import { DragonCard } from "../DragonCard";

export function LobbyView() {
  const dragons = useGameStore((s) => s.dragons);
  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs uppercase tracking-widest text-slate-500">My Collection</p>
        <h2 className="text-2xl font-bold text-slate-100">My Dragons</h2>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dragons.map((d) => (
          <DragonCard key={d.id} dragon={d} />
        ))}
      </div>
    </div>
  );
}