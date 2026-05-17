import { useEffect, useMemo, useState } from "react";
import { Lock, Dumbbell, Sparkles, Coins, Heart, Swords, Shield, Zap, Flame, ArrowRight, ArrowLeft, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
              <h2 className="text-xl font-bold text-slate-100">{t("training.title")}</h2>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              {t("training.tag")}
            </span>
          </div>

          {/* Horizontal scroll picker */}
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t("training.pickDragon")}
            </p>
            {trainable.length === 0 ? (
              <p className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-4 text-center text-xs text-slate-500">
                {t("training.noTrainable")}
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
            {t("training.lockedHeading")}
          </p>
          <p className="mt-1 px-6 text-xs text-slate-400">
            {t("training.lockedDesc")}
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
  const { t } = useTranslation();
  const stats = [
    { icon: Heart, label: "HP", value: dragon.maxHp, tint: "text-rose-300" },
    { icon: Zap, label: "MP", value: dragon.mp, tint: "text-sky-300" },
    { icon: Swords, label: "ATK", value: dragon.atk, tint: "text-amber-300" },
    { icon: Shield, label: "DEF", value: dragon.def, tint: "text-emerald-300" },
  ];

  const elementInfo = ELEMENT_INFO[dragon.element];
  const passive = PASSIVES[dragon.name];

  return (
    <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      {/* Hero */}
      <div className="flex gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700/60">
          <DragonImage dragon={dragon} className="h-full w-full" preferLarge />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${elementInfo.tint}`}>
            {elementInfo.icon} {dragon.element} · {elementInfo.kr}
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
          {t("training.currentStats")}
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

      {/* Element matchup (5행 상성) */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {t("training.elementMatchup")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-500/5 px-2 py-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] text-slate-400">{t("training.strong")}</span>
            <span className="ml-auto text-xs font-bold text-emerald-200">
              {ELEMENT_INFO[elementInfo.strongVs].icon} {elementInfo.strongVs}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-500/5 px-2 py-1.5">
            <ArrowLeft className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] text-slate-400">{t("training.weak")}</span>
            <span className="ml-auto text-xs font-bold text-rose-200">
              {ELEMENT_INFO[elementInfo.weakTo].icon} {elementInfo.weakTo}
            </span>
          </div>
        </div>
      </div>

      {/* Passive / Signature skill */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {t("training.uniqueSkill")}
        </p>
        <div className="space-y-1.5">
          <div className="rounded-lg border border-amber-800/60 bg-amber-500/5 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[11px] font-bold text-amber-200">{t("training.specialSkill")}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
              {t("training.specialSkillDesc")}
            </p>
          </div>
          {passive && (
            <div className="rounded-lg border border-violet-800/60 bg-violet-500/5 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5 text-violet-300" />
                <span className="text-[11px] font-bold text-violet-200">{passive.name}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{passive.desc}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lore */}
      {dragon.lore && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t("training.lore")}
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

// ─────────────────────────────────────────────────────────────────────────────
// Static catalogs (read-only): 5행 상성 + 드래곤 고유 패시브.
// 5행 정규화: Light→Metal, Dark→Soil(=Earth). 사이클: Wood>Soil>Water>Fire>Metal>Wood.
// ─────────────────────────────────────────────────────────────────────────────
type ElementMeta = {
  kr: string;
  icon: string;
  tint: string;
  strongVs: Dragon["element"];
  weakTo: Dragon["element"];
};
const ELEMENT_INFO: Record<Dragon["element"], ElementMeta> = {
  Wood:  { kr: "목", icon: "🌳", tint: "text-emerald-300", strongVs: "Earth", weakTo: "Light" },
  Earth: { kr: "토", icon: "🪨", tint: "text-amber-300",   strongVs: "Water", weakTo: "Wood"  },
  Water: { kr: "수", icon: "💧", tint: "text-sky-300",     strongVs: "Fire",  weakTo: "Earth" },
  Fire:  { kr: "화", icon: "🔥", tint: "text-rose-300",    strongVs: "Light", weakTo: "Water" },
  Light: { kr: "금", icon: "✨", tint: "text-yellow-200",  strongVs: "Wood",  weakTo: "Fire"  },
  Dark:  { kr: "토(암)", icon: "🌑", tint: "text-violet-300", strongVs: "Water", weakTo: "Wood" },
};

const PASSIVES: Record<string, { name: string; desc: string }> = {
  Comi:      { name: "강철의 인내",   desc: "피격 시 받는 데미지가 일정 비율 경감됩니다." },
  Snowy:     { name: "빙결의 신중함", desc: "짝수 턴에 30% 회피, 자신의 공격은 20% 약화됩니다." },
  Caminont:  { name: "맹독의 송곳니", desc: "공격 시 적에게 지속 독 데미지를 부여합니다." },
};