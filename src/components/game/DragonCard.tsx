import { Heart, Droplet, Sword, Shield, Sparkles } from "lucide-react";
import type { Dragon } from "@/store/dragons";

const elementColors: Record<string, string> = {
  Wood: "from-emerald-500/30 to-emerald-700/10 text-emerald-300 border-emerald-500/40",
  Water: "from-sky-500/30 to-sky-700/10 text-sky-300 border-sky-500/40",
  Fire: "from-rose-500/30 to-rose-700/10 text-rose-300 border-rose-500/40",
  Earth: "from-amber-500/30 to-amber-700/10 text-amber-300 border-amber-500/40",
  Light: "from-yellow-300/30 to-yellow-600/10 text-yellow-200 border-yellow-400/40",
  Dark: "from-violet-500/30 to-violet-800/10 text-violet-300 border-violet-500/40",
};

function StatBar({
  label,
  value,
  max = 100,
  icon,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  icon: React.ReactNode;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="flex items-center gap-1.5 font-medium">
          {icon}
          {label}
        </span>
        <span className="font-mono text-slate-200">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DragonCard({ dragon }: { dragon: Dragon }) {
  const tone = elementColors[dragon.element] ?? elementColors.Wood;
  return (
    <div className="snap-center shrink-0 w-[78vw] max-w-[320px] rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-800/90 to-slate-900/90 p-4 shadow-2xl shadow-black/40">
      <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-gradient-to-br ${tone}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700/60 text-slate-400">
            <Sparkles className="h-10 w-10" />
          </div>
        </div>
        <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur ${tone}`}>
          {dragon.element}
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <h3 className="text-xl font-bold text-slate-100">{dragon.name}</h3>
        <span className="text-[10px] font-mono text-slate-500">#{String(dragon.id).padStart(3, "0")}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2.5">
        <StatBar label="ATK" value={dragon.atk} icon={<Sword className="h-3.5 w-3.5" />} color="bg-rose-500" />
        <StatBar label="DEF" value={dragon.def} icon={<Shield className="h-3.5 w-3.5" />} color="bg-amber-500" />
        <StatBar label="HP" value={dragon.hp} max={dragon.maxHp} icon={<Heart className="h-3.5 w-3.5" />} color="bg-emerald-500" />
        <StatBar label="MP" value={dragon.mp} icon={<Droplet className="h-3.5 w-3.5" />} color="bg-sky-500" />
      </div>
    </div>
  );
}