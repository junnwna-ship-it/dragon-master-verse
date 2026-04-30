import { useEffect, useRef, useState } from "react";
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

const STAT_DESCRIPTIONS: Record<string, string> = {
  ATK: "공격력. 한 번의 공격으로 입히는 기본 피해량입니다.",
  DEF: "방어력. 받는 피해를 줄여주는 수치입니다.",
  HP: "체력. 0이 되면 전투에서 패배합니다.",
  MP: "마나. 스킬과 일부 행동에 소모되며, 0이 되면 지칩니다.",
};

/** Long-press threshold (ms) for showing the tooltip on touch devices. */
const LONG_PRESS_MS = 350;

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
  const [open, setOpen] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };
  // Auto-dismiss the tooltip a couple seconds after a long-press opens it,
  // so mobile users don't have to tap-elsewhere to clear it.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 2200);
    return () => clearTimeout(t);
  }, [open]);

  const desc = STAT_DESCRIPTIONS[label] ?? "";
  const tooltipId = `stat-${label.toLowerCase()}-tooltip`;
  // Full sentence used as the accessible name so screen readers announce
  // the stat label, current/max values, and the explanatory description in
  // one go (e.g. "공격력 ATK 80 of 100. 공격력. 한 번의 공격으로 ...").
  const srLabel = `${label} ${value}${max !== 100 ? ` of ${max}` : " of 100"}. ${desc}`;

  return (
    <div
      className="group relative space-y-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onTouchStart={() => {
        clearLongPress();
        longPressRef.current = setTimeout(() => setOpen(true), LONG_PRESS_MS);
      }}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      onTouchMove={clearLongPress}
      tabIndex={0}
      role="group"
      aria-label={srLabel}
      aria-describedby={tooltipId}
    >
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="flex items-center gap-1.5 font-medium">
          <span aria-hidden="true">{icon}</span>
          {label}
        </span>
        <span className="font-mono text-slate-200" aria-hidden="true">
          {value}
          {max !== 100 && <span className="text-slate-500">/{max}</span>}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-700/60"
        role="progressbar"
        aria-label={`${label} 진행도`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} / ${max}`}
        // Native browser tooltip as a last-resort fallback (e.g. desktop
        // assistive tech or environments that suppress our custom popup).
        title={`${label}: ${value}${max !== 100 ? `/${max}` : ""} — ${desc}`}
      >
        <div
          aria-hidden="true"
          className={`h-full rounded-full ${color} transition-[width] duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Screen-reader-only sentence repeating the full description, so
          even AT that ignores aria-label on grouping containers picks it up. */}
      <span className="sr-only">{srLabel}</span>

      {/* Custom tooltip — shown on hover/focus (desktop) or long-press (touch). */}
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute -top-2 left-1/2 z-20 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-[10px] leading-snug text-slate-200 shadow-lg transition-opacity duration-150 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="block font-bold text-slate-100">
          {label}
          <span className="ml-1 font-mono text-slate-400">
            {value}
            {max !== 100 ? `/${max}` : ""}
          </span>
        </span>
        <span className="mt-0.5 block text-slate-400">{desc}</span>
      </span>
    </div>
  );
}

export function DragonCard({ dragon }: { dragon: Dragon }) {
  const tone = elementColors[dragon.element] ?? elementColors.Wood;
  return (
    <div className="snap-center shrink-0 w-[78vw] max-w-[320px] rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-800/90 to-slate-900/90 p-4 shadow-2xl shadow-black/40">
      <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-gradient-to-br ${tone}`}>
        {dragon.image ? (
          <img
            src={dragon.image}
            srcSet={dragon.imageLarge ? `${dragon.image} 480w, ${dragon.imageLarge} 800w` : undefined}
            sizes="(max-width: 480px) 78vw, 320px"
            alt={`${dragon.name} 일러스트`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            // Tell the browser the intrinsic ratio so layout is stable
            // even before the bitmap finishes decoding.
            width={480}
            height={600}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700/60 text-slate-400">
              <Sparkles className="h-10 w-10" />
            </div>
          </div>
        )}
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