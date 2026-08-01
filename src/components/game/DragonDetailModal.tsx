import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Swords, Shield, Heart, Sparkles, Flame, Droplets, Leaf, Mountain, Sun, Moon, ChevronLeft, ChevronRight, Dumbbell, Lock, Loader2, HeartHandshake, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import i18n from "@/i18n";
/**
 * BondingSection이 성공할 때 모달 내 다른 컴포넌트(카드 이미지 영역, EXP 게이지)에
 * 동시에 VFX를 트리거하기 위한 가벼운 이벤트 버스.
 * payload: { dragonId, expGain }
 */
export const BOND_SUCCESS_EVENT = "dragon:bond-success";
export interface BondSuccessDetail { dragonId: number; expGain: number }

function emitBondSuccess(detail: BondSuccessDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BondSuccessDetail>(BOND_SUCCESS_EVENT, { detail }));
}

function useBondSuccess(dragonId: number, handler: (detail: BondSuccessDetail) => void) {
  useEffect(() => {
    const fn = (e: Event) => {
      const ce = e as CustomEvent<BondSuccessDetail>;
      if (ce.detail?.dragonId === dragonId) handler(ce.detail);
    };
    window.addEventListener(BOND_SUCCESS_EVENT, fn);
    return () => window.removeEventListener(BOND_SUCCESS_EVENT, fn);
  }, [dragonId, handler]);
}

import type { Dragon, Element } from "@/store/dragons";
import { useGameStore } from "@/store/dragons";
import { DragonImage } from "./DragonImage";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInventory, emitInventoryChanged } from "@/hooks/useInventory";

type ElementMeta = { labelKey: string; color: string; icon: React.ComponentType<{ className?: string }>; strong: Element; weak: Element };
const ELEMENT_META: Record<Element, ElementMeta> = {
  Fire:  { labelKey: "dragon.elementsKr.Fire",  color: "text-rose-300",    icon: Flame,    strong: "Wood",  weak: "Water" },
  Water: { labelKey: "dragon.elementsKr.Water", color: "text-sky-300",     icon: Droplets, strong: "Fire",  weak: "Earth" },
  Wood:  { labelKey: "dragon.elementsKr.Wood",  color: "text-emerald-300", icon: Leaf,     strong: "Earth", weak: "Fire" },
  Earth: { labelKey: "dragon.elementsKr.Earth", color: "text-amber-300",   icon: Mountain, strong: "Water", weak: "Wood" },
  Light: { labelKey: "dragon.elementsKr.Light", color: "text-yellow-200",  icon: Sun,      strong: "Dark",  weak: "Dark" },
  Dark:  { labelKey: "dragon.elementsKr.Dark",  color: "text-violet-300",  icon: Moon,     strong: "Light", weak: "Light" },
};

// Build presets keyed by stat focus. Each preset carries a title, narrative
// description, suggested gameplay tags, and a recommended-stat scalar so we
// can pick a sensible default tab from the dragon's strongest attribute.
type BuildKey = "ATK" | "DEF" | "HP" | "MP";
function getBuildPresets(): Record<BuildKey, { title: string; desc: string; tags: string[] }> {
  const tt = (k: string, fallback: string) => {
    const v = i18n.t(`buildPresets.${k}`, { defaultValue: "" });
    return v && typeof v === "string" ? v : fallback;
  };
  const tagList = (k: string, fb: string[]) => {
    const v = i18n.t(`buildPresets.${k}`, { returnObjects: true, defaultValue: fb }) as unknown;
    return Array.isArray(v) ? (v as string[]) : fb;
  };
  return {
    ATK: {
      title: tt("ATK.title", "Attacker"),
      desc: tt("ATK.desc", "Burst-damage build focused on quick kills."),
      tags: tagList("ATK.tags", ["First strike", "Crit", "ATK buff"]),
    },
    DEF: {
      title: tt("DEF.title", "Tank"),
      desc: tt("DEF.desc", "Soaks hits and protects allies."),
      tags: tagList("DEF.tags", ["Mitigation", "Taunt", "Recovery"]),
    },
    HP: {
      title: tt("HP.title", "Bruiser"),
      desc: tt("HP.desc", "High-HP fighter that scales into late game."),
      tags: tagList("HP.tags", ["HP", "Lifesteal", "Regen"]),
    },
    MP: {
      title: tt("MP.title", "Caster"),
      desc: tt("MP.desc", "MP-driven skill caster with ranged poke."),
      tags: tagList("MP.tags", ["Skill", "Mana", "Ranged"]),
    },
  };
}

// Returns the build key whose normalized stat is highest — used as the
// default selected tab so the modal opens on the dragon's natural strength.
function defaultBuildKey(d: Dragon): BuildKey {
  const scores: Record<BuildKey, number> = {
    ATK: d.atk,
    DEF: d.def,
    HP: d.maxHp / 10,
    MP: d.mp / 5,
  };
  return (Object.entries(scores) as [BuildKey, number][]) 
    .reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

export function DragonDetailModal({
  dragon,
  nextDragon,
  prevDragon,
  onClose,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
}: {
  dragon: Dragon;
  /** Optional neighbor dragons — used purely to preload artwork so swiping
      to the next/previous card feels instant. */
  nextDragon?: Dragon;
  prevDragon?: Dragon;
  onClose: () => void;
  /** Advance to the next dragon in the roster (called by swipe-left / →). */
  onNext?: () => void;
  /** Go back to the previous dragon in the roster (swipe-right / ←). */
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}) {
  // Exit animation gate: closing sets `visible` to false, and the real
  // onClose fires once the exit transition finishes.
  const [visible, setVisible] = useState(true);
  const requestClose = useCallback(() => setVisible(false), []);

  // Keyboard: ESC closes; ←/→ navigate when handlers are wired.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose, onNext, onPrev]);

  // Touch swipe — horizontal gesture > 50px and at least 1.5× the vertical
  // delta counts as a navigation. Anything else is treated as a regular
  // tap/scroll and ignored so we don't fight scrollable inner content.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    // Threshold: meaningful horizontal motion, mostly horizontal, fast enough.
    if (absX < 50 || absX < absY * 1.5) return;
    if (Date.now() - start.t > 600) return;
    if (dx < 0 && onNext) onNext();
    else if (dx > 0 && onPrev) onPrev();
  };

  const meta = ELEMENT_META[dragon.element];
  const ElIcon = meta.icon;
  const total = dragon.atk + dragon.def + dragon.maxHp + dragon.mp;
  const strongMeta = ELEMENT_META[meta.strong];
  const weakMeta = ELEMENT_META[meta.weak];

  // Active build tab. Defaults to the dragon's strongest stat and resets
  // whenever the dragon changes (swipe-navigation, lobby selection update,
  // etc.) so the recommendation is always meaningful for the active card.
  const naturalKey = useMemo(() => defaultBuildKey(dragon), [dragon]);
  const [buildTab, setBuildTab] = useState<BuildKey>(naturalKey);
  useEffect(() => {
    setBuildTab(naturalKey);
  }, [naturalKey]);
  const build = getBuildPresets()[buildTab];

  const stats: { label: BuildKey; value: number; icon: typeof Swords; color: string; bg: string }[] = [
    { label: "ATK", value: dragon.atk, icon: Swords, color: "text-rose-300", bg: "bg-rose-500/20" },
    { label: "DEF", value: dragon.def, icon: Shield, color: "text-sky-300", bg: "bg-sky-500/20" },
    { label: "HP",  value: dragon.maxHp, icon: Heart, color: "text-emerald-300", bg: "bg-emerald-500/20" },
    { label: "MP",  value: dragon.mp, icon: Sparkles, color: "text-violet-300", bg: "bg-violet-500/20" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dragon-detail-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-700/70 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-black/60 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300"
      >
        {/* Inner content is keyed by dragon.id so swapping the globally
            selected dragon while the modal is open re-runs a quick
            cross-fade animation on every section — no close/reopen needed. */}
        <div
          key={dragon.id}
          className="animate-in fade-in duration-200"
          aria-live="polite"
        >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Dragon</p>
            <h3 id="dragon-detail-title" className="truncate text-xl font-bold text-slate-100">{dragon.name}</h3>
            <div className={`mt-1 inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] ${meta.color}`}>
              <ElIcon className="h-3 w-3" />
              <span className="font-semibold">{i18n.t("dragon.modal2.elementSuffix2", { label: i18n.t(meta.labelKey) })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(onPrev || onNext) && (
              <>
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label={i18n.t("dragon.modal.prev")}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label={i18n.t("dragon.modal.next")}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label={i18n.t("dragon.modal2.close")}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <BondableCardImage dragon={dragon} />
          <ExpGauge dragon={dragon} />
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{i18n.t("dragon.modal.stats")}</h4>
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300">{i18n.t("dragon.modal.totalSum", { sum: total })}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg} ${s.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-slate-500">{s.label}</p>
                      <p className="font-mono text-sm font-bold text-slate-100">{s.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{i18n.t("dragon.modal.elementMatchup")}</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <p className="text-[10px] uppercase text-emerald-400/80">{i18n.t("dragon.modal2.strong")}</p>
                <p className={`flex items-center gap-1 text-sm font-bold ${strongMeta.color}`}>
                  <strongMeta.icon className="h-3.5 w-3.5" />
                  {i18n.t(strongMeta.labelKey)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <p className="text-[10px] uppercase text-rose-400/80">{i18n.t("dragon.modal2.weak")}</p>
                <p className={`flex items-center gap-1 text-sm font-bold ${weakMeta.color}`}>
                  <weakMeta.icon className="h-3.5 w-3.5" />
                  {i18n.t(weakMeta.labelKey)}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{i18n.t("dragon.modal.recommendedBuild")}</h4>
            {/* Tab bar: one button per stat focus. The dragon's natural
                strength is highlighted with a small badge so the user can
                tell at a glance which preset matches its raw stats best. */}
            <div
              role="tablist"
              aria-label={i18n.t("dragon.modal.tabsLabel")}
              className="mb-2 grid grid-cols-4 gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1"
            >
              {stats.map((s) => {
                const Icon = s.icon;
                const active = buildTab === s.label;
                const isNatural = naturalKey === s.label;
                return (
                  <button
                    key={s.label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="recommended-build-panel"
                    onClick={() => setBuildTab(s.label)}
                    className={`relative flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                      active
                        ? `${s.bg} ${s.color} shadow-inner`
                        : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{s.label}</span>
                    {isNatural && !active && (
                      <span
                        aria-hidden
                        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
                        title={i18n.t("dragon.modal2.naturalTip")}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div
              id="recommended-build-panel"
              role="tabpanel"
              aria-live="polite"
              key={buildTab}
              className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5 px-3 py-3 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-amber-200">{build.title}</p>
                {naturalKey === buildTab && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                    {i18n.t("dragon.modal2.naturalBadge")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{build.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {build.tags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <TrainingSection dragon={dragon} />
          <BondingSection dragon={dragon} />
        </div>

        <div className="border-t border-slate-800 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-100 hover:bg-slate-700"
          >
            {i18n.t("dragon.modal2.close")}
          </button>
        </div>
        </div>
        {/* Neighbor preloading. Render hidden <img> tags for the previous
            and next dragons so swiping/arrow-key navigation gets a
            decoded bitmap from cache instead of a fresh network round-trip.
            We preload the small variant (480w) which is what the modal
            falls back to when the large one isn't yet decoded. */}
        <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          {nextDragon?.imageUrl && (
            <img src={nextDragon.imageUrl} alt="" decoding="async" loading="eager" />
          )}
          {prevDragon?.imageUrl && (
            <img src={prevDragon.imageUrl} alt="" decoding="async" loading="eager" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 훈련소(Training) 섹션.
 * - statPoints 1점당 [ATK +10 / HP +50 / DEF +5 / MP +20]
 * - `isTrainingOpen === false` 또는 보유 포인트가 없으면 버튼 비활성화.
 * - 잠금 시 회색 + 툴팁("드래곤 훈련소 공사 중") 표시.
 */
export function TrainingSection({ dragon }: { dragon: Dragon }) {
  const { t } = useTranslation();
  const { settings } = useAppSettings();
  const refetchDragons = useGameStore((s) => s.fetchDragons);
  const [busyStat, setBusyStat] = useState<string | null>(null);
  const open = settings.isTrainingOpen;
  const points = dragon.statPoints ?? 0;

  const buttons: { stat: "atk" | "hp" | "def" | "mp"; label: string; gain: string }[] = [
    { stat: "atk", label: "ATK", gain: "+10" },
    { stat: "hp",  label: "HP",  gain: "+50" },
    { stat: "def", label: "DEF", gain: "+5"  },
    { stat: "mp",  label: "MP",  gain: "+20" },
  ];

  const spend = async (stat: "atk" | "hp" | "def" | "mp") => {
    if (!dragon.uuid) {
      toast.error(t("dragon.bonding.notInCloud"));
      return;
    }
    setBusyStat(stat);
    const { error } = await supabase.rpc("spend_stat_point", {
      _dragon_uuid: dragon.uuid,
      _stat: stat,
    });
    setBusyStat(null);
    if (error) {
      console.error("[training] spend failed:", error);
      toast.error(t("dragon.training.spendFailed", { msg: error.message, defaultValue: `Stat allocation failed: ${error.message}` }));
      return;
    }
    toast.success(t("dragon.training.spendSuccess", { stat: stat.toUpperCase(), defaultValue: `${stat.toUpperCase()} upgraded!` }));
    void refetchDragons();
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Dumbbell className="h-3 w-3" /> {t("dragon.modal.training")}
          {!open && <Lock className="h-3 w-3 text-slate-500" />}
        </h4>
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300">
          Lv.{dragon.level ?? 1} · EXP {dragon.exp ?? 0}
        </span>
      </div>
      <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5">
        <span className="text-[11px] text-slate-400">{t("dragon.training.remainingPoints", { defaultValue: "Remaining stat points" })}</span>
        <span className="font-mono text-sm font-bold text-amber-300">{points}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((b) => {
          const disabled = !open || points < 1 || busyStat !== null;
          return (
            <button
              key={b.stat}
              type="button"
              onClick={() => spend(b.stat)}
              disabled={disabled}
              title={
                !open
                  ? t("dragon.training.closed", { defaultValue: "Training ground under construction" })
                  : points < 1
                    ? t("dragon.training.noPoints", { defaultValue: "No stat points" })
                    : `${b.label} ${b.gain}`
              }
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition ${
                open
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  : "border-slate-700 bg-slate-800/40 text-slate-500"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span>{b.label}</span>
              <span className="font-mono">
                {busyStat === b.stat ? <Loader2 className="h-3 w-3 animate-spin" /> : b.gain}
              </span>
            </button>
          );
        })}
      </div>
      {!open && (
        <p className="mt-2 text-center text-[11px] text-slate-500">🔧 {t("dragon.training.closed", { defaultValue: "Training ground under construction" })}</p>
      )}
    </section>
  );
}

/**
 * 카드 이미지 영역 — 교감 성공 시 핑크 오라/하트 폭발/카드 살짝 펄스 연출.
 * 자체적으로 BOND_SUCCESS_EVENT를 듣고 일치하는 dragon.id에만 반응.
 */
function BondableCardImage({ dragon }: { dragon: Dragon }) {
  const [burst, setBurst] = useState(0); // bump key to retrigger animation
  const burstHandler = useCallback(() => setBurst((k) => k + 1), []);
  useBondSuccess(dragon.id, burstHandler);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40">
      <DragonImage
        dragon={dragon}
        preferLarge
        fit="contain"
        className={`absolute inset-0 h-full w-full transition ${burst ? "bond-card-pulse" : ""}`}
        sizes="(max-width: 640px) 100vw, 448px"
        loading="eager"
        fetchPriority="high"
      />
      {burst > 0 && (
        <div key={burst} className="pointer-events-none absolute inset-0">
          {/* 핑크 오라 — 카드 전체를 덮는 라디얼 글로우 */}
          <div className="absolute inset-0 bond-aura" />
          {/* 회전하는 하트 링 */}
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const x = Math.cos(a) * 110;
              const y = Math.sin(a) * 80;
              return (
                <Heart
                  key={i}
                  className="absolute h-5 w-5 fill-pink-400 text-pink-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.9)]"
                  style={{
                    animation: `bond-heart-fly 1.1s cubic-bezier(0.22,0.61,0.36,1) forwards`,
                    animationDelay: `${i * 0.04}s`,
                    ["--bx" as string]: `${x}px`,
                    ["--by" as string]: `${y}px`,
                  }}
                />
              );
            })}
          </div>
          {/* 중앙 큰 하트 + 별 — 임팩트 프레임 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="h-24 w-24 fill-pink-500 text-pink-400 drop-shadow-[0_0_24px_rgba(236,72,153,0.95)] bond-impact" />
            <Star className="absolute h-10 w-10 fill-amber-300 text-amber-200 bond-star" />
          </div>
          {/* 위로 떠오르는 작은 입자 */}
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={`p-${i}`}
              className="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-pink-300 shadow-[0_0_6px_rgba(244,114,182,0.9)]"
              style={{
                left: `${5 + Math.random() * 90}%`,
                animation: `bond-rise 1.2s ease-out forwards`,
                animationDelay: `${Math.random() * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}
      <style>{`
        @keyframes bond-heart-fly {
          0%   { transform: translate(0,0) scale(0.4); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(var(--bx), var(--by)) scale(1.1); opacity: 0; }
        }
        @keyframes bond-impact {
          0%   { transform: scale(0.2); opacity: 0; }
          35%  { transform: scale(1.3); opacity: 1; }
          70%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .bond-impact { animation: bond-impact 1.1s ease-out forwards; }
        @keyframes bond-star {
          0%   { transform: rotate(-30deg) scale(0); opacity: 0; }
          50%  { transform: rotate(0deg) scale(1.3); opacity: 1; }
          100% { transform: rotate(40deg) scale(0.6); opacity: 0; }
        }
        .bond-star { animation: bond-star 1.1s ease-out forwards; }
        @keyframes bond-aura {
          0%   { background: radial-gradient(circle at 50% 50%, rgba(244,114,182,0.0) 0%, transparent 60%); opacity: 0; }
          30%  { background: radial-gradient(circle at 50% 50%, rgba(244,114,182,0.55) 0%, rgba(236,72,153,0.25) 35%, transparent 70%); opacity: 1; }
          100% { background: radial-gradient(circle at 50% 50%, rgba(244,114,182,0.0) 0%, transparent 60%); opacity: 0; }
        }
        .bond-aura { animation: bond-aura 1.1s ease-out forwards; mix-blend-mode: screen; }
        @keyframes bond-card-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1) saturate(1); }
          40%      { transform: scale(1.04); filter: brightness(1.15) saturate(1.25); }
        }
        .bond-card-pulse { animation: bond-card-pulse 0.9s ease-out 1; }
        @keyframes bond-rise {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-180px) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * EXP 게이지 — Lv/EXP 표시 + 진행 바.
 * 교감 성공 시 게이지가 부드럽게 채워지며, +EXP 숫자가 위로 떠오르고 골드 펄스가 진행바를 훑고 지나간다.
 * (다음 레벨까지 필요한 EXP는 단순 계산: nextExp = level * 1000)
 */
function ExpGauge({ dragon }: { dragon: Dragon }) {
  const level = dragon.level ?? 1;
  const exp = dragon.exp ?? 0;
  const nextExp = Math.max(100, level * 1000);
  const pct = Math.min(100, (exp / nextExp) * 100);

  const [pop, setPop] = useState<{ key: number; gain: number } | null>(null);
  const [shimmer, setShimmer] = useState(0);

  const onBond = useCallback((d: BondSuccessDetail) => {
    setPop({ key: Date.now(), gain: d.expGain });
    setShimmer((k) => k + 1);
    setTimeout(() => setPop(null), 1400);
  }, []);
  useBondSuccess(dragon.id, onBond);

  return (
    <section className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-slate-900/60 px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 font-bold text-amber-300">
          <Star className="h-3 w-3 fill-amber-300" /> Lv.{level}
        </span>
        <span className="font-mono text-slate-400">
          EXP <span className="text-slate-200">{exp.toLocaleString()}</span> / {nextExp.toLocaleString()}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-400 to-rose-400 shadow-[0_0_8px_rgba(244,114,182,0.7)] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {shimmer > 0 && (
          <span
            key={shimmer}
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"
            style={{ animation: "exp-shimmer 0.9s ease-out 1" }}
          />
        )}
      </div>
      {/* +EXP 숫자 팝업 */}
      {pop && (
        <span
          key={pop.key}
          className="pointer-events-none absolute right-3 top-1 select-none text-sm font-extrabold text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.9)]"
          style={{ animation: "exp-pop 1.3s ease-out forwards" }}
        >
          +{pop.gain} EXP
        </span>
      )}
      <style>{`
        @keyframes exp-shimmer {
          0%   { transform: translateX(0); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translateX(450%); opacity: 0; }
        }
        @keyframes exp-pop {
          0%   { transform: translateY(0) scale(0.6); opacity: 0; }
          25%  { transform: translateY(-4px) scale(1.2); opacity: 1; }
          75%  { transform: translateY(-22px) scale(1); opacity: 1; }
          100% { transform: translateY(-40px) scale(0.85); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

/**
 * 교감하기(Bonding) 섹션.
 * - 인벤토리에서 'bonding_token' 1개를 소모해 드래곤에게 EXP +500 제공.
 * - 토큰이 없으면 안내 메시지와 함께 비활성화.
 * - 성공 시 EXP 게이지 위로 솟구치는 하트/스파크 VFX를 잠깐 띄운다.
 */
export function BondingSection({ dragon }: { dragon: Dragon }) {
  const { t } = useTranslation();
  const refetchDragons = useGameStore((s) => s.fetchDragons);
  const { qty, loading: invLoading } = useInventory();
  const tokens = qty("bonding_token");
  const [busy, setBusy] = useState(false);
  const [vfx, setVfx] = useState(false);

  const bond = async () => {
    if (!dragon.uuid) { toast.error(t("dragon.bonding.notInCloud")); return; }
    if (tokens < 1) { toast.error(t("dragon.modal.tokenLow")); return; }
    setBusy(true);
    const { error } = await supabase.rpc("bond_with_dragon", { _dragon_uuid: dragon.uuid });
    setBusy(false);
    if (error) { toast.error(t("dragon.bonding.bondFailed", { msg: error.message })); return; }
    setVfx(true);
    emitInventoryChanged({ itemKey: "bonding_token", delta: -1 });
    emitBondSuccess({ dragonId: dragon.id, expGain: 500 });
    toast.success(t("dragon.bonding.bondSuccess", { name: dragon.name }));
    setTimeout(() => setVfx(false), 1200);
    await refetchDragons();
  };

  const disabled = busy || tokens < 1 || !dragon.uuid;

  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-300">
          <HeartHandshake className="h-3.5 w-3.5" /> {t("dragon.bonding.title")}
        </h4>
        <span className="rounded-md bg-pink-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-pink-200">
          {t("dragon.bonding.tokens", { n: invLoading ? "…" : tokens })}
        </span>
      </div>
      <button
        type="button"
        onClick={bond}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-pink-500/40 bg-gradient-to-r from-pink-500/20 to-rose-500/20 px-3 py-3 text-sm font-extrabold text-pink-100 transition hover:from-pink-500/30 hover:to-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {tokens < 1 ? t("dragon.modal.needToken") : t("dragon.modal.useToken")}
      </button>
      {vfx && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return (
              <span
                key={i}
                className="absolute h-2 w-2 rounded-full bg-pink-300"
                style={{
                  animation: `bond-burst-${i} 1s ease-out forwards`,
                }}
              />
            );
          })}
          <Sparkles className="absolute h-12 w-12 animate-ping text-pink-200" />
          <style>{Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const x = Math.cos(a) * 90, y = Math.sin(a) * 90;
            return `@keyframes bond-burst-${i} { to { transform: translate(${x}px, ${y}px); opacity: 0; } }`;
          }).join("\n")}</style>
        </div>
      )}
    </section>
  );
}