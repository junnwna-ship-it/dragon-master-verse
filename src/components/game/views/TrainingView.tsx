import { useEffect, useMemo, useState } from "react";
import { Lock, Dumbbell, Sparkles, Coins, Heart, Swords, Shield, Zap } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { useAppSettings } from "@/hooks/useAppSettings";
import { DragonImage } from "../DragonImage";
import { TrainingSection } from "../DragonDetailModal";

/**
 * Training view — dedicated tab for distributing stat points.
 * Layout:
 *  1) Locked overlay when `isTrainingOpen === false`.
 *  2) Horizontal-scroll dragon picker (overflow-x-auto).
 *  3) Read-only detail panel for the picked dragon (image, lore, stats,
 *     level/EXP, owner) plus the existing stat-point distribution UI.
 */
export function TrainingView() {
  const dragons = useGameStore((s) => s.dragons);
  const { settings, loading } = useAppSettings();

  // Only cloud-synced dragons can be trained (RPC needs a UUID).
  const trainable = useMemo(() => dragons.filter((d) => d.uuid), [dragons]);

  const [pickedId, setPickedId] = useState<number | null>(null);
  // Auto-select the first dragon when the list arrives or the picked one
  // disappears from the list.
  useEffect(() => {
    if (trainable.length === 0) {
      setPickedId(null);
      return;
    }
    if (pickedId == null || !trainable.some((d) => d.id === pickedId)) {
      setPickedId(trainable[0].id);
    }
  }, [trainable, pickedId]);

  const picked = trainable.find((d) => d.id === pickedId) ?? null;

  return (
    <div className="relative">
      <div className={settings.isTrainingOpen ? "" : "pointer-events-none select-none"}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-amber-300" />
              <h2 className="text-xl font-bold text-slate-100">훈련소</h2>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              스탯 분배
            </span>
          </div>

          {/* Horizontal scroll picker */}
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              훈련할 드래곤 선택
            </p>
            {trainable.length === 0 ? (
              <p className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-4 text-center text-xs text-slate-500">
                훈련 가능한 드래곤이 없습니다.
              </p>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 pb-2">
                <div className="flex gap-2">
                  {trainable.map((d) => {
                    const active = pickedId === d.id;
                    const sp = d.statPoints ?? 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setPickedId(d.id)}
                        className={`relative flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 transition ${
                          active
                            ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/60"
                            : "border-slate-700 bg-slate-800/40 hover:border-slate-500"
                        }`}
                      >
                        <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-900">
                          <DragonImage dragon={d} className="h-full w-full" />
                        </div>
                        <span className="line-clamp-1 w-full text-center text-[11px] font-semibold text-slate-100">
                          {d.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Lv.{d.level ?? 1}
                        </span>
                        {sp > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950 shadow">
                            {sp}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Detail panel */}
          {picked && <DetailPanel dragon={picked} />}
        </div>
      </div>

      {/* Locked overlay */}
      {!loading && !settings.isTrainingOpen && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/60 backdrop-blur-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 ring-1 ring-amber-500/40">
            <Lock className="h-8 w-8 text-amber-300" />
          </div>
          <p className="mt-4 px-6 text-base font-bold text-slate-100">
            🔧 드래곤 훈련소 공사 중
          </p>
          <p className="mt-1 px-6 text-xs text-slate-400">
            관리자가 훈련소를 오픈하면 이용할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only detail card + the reusable TrainingSection (stat-point spend UI).
 */
function DetailPanel({ dragon }: { dragon: Dragon }) {
  const stats = [
    { icon: Heart, label: "HP", value: dragon.maxHp, tint: "text-rose-300" },
    { icon: Zap, label: "MP", value: dragon.mp, tint: "text-sky-300" },
    { icon: Swords, label: "ATK", value: dragon.atk, tint: "text-amber-300" },
    { icon: Shield, label: "DEF", value: dragon.def, tint: "text-emerald-300" },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      {/* Hero */}
      <div className="flex gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700/60">
          <DragonImage dragon={dragon} className="h-full w-full" preferLarge />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {dragon.element}
          </p>
          <h3 className="truncate text-lg font-bold text-slate-100">{dragon.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300">
              Lv.{dragon.level ?? 1}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-sky-300">
              <Sparkles className="h-3 w-3" /> EXP {dragon.exp ?? 0}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-300">
              <Coins className="h-3 w-3" /> SP {dragon.statPoints ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          현재 스탯
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {stats.map(({ icon: Icon, label, value, tint }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5"
            >
              <Icon className={`h-3.5 w-3.5 ${tint}`} />
              <span className="text-[10px] text-slate-400">{label}</span>
              <span className="font-mono text-xs font-bold text-slate-100">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lore */}
      {dragon.lore && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            전설
          </p>
          <p className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-[12px] leading-relaxed text-slate-300">
            {dragon.lore}
          </p>
        </div>
      )}

      {/* Stat-point spend (reuses the modal's section) */}
      <div className="border-t border-slate-800 pt-3">
        <TrainingSection dragon={dragon} />
      </div>
    </section>
  );
}