import { useEffect, useMemo, useRef, useState } from "react";
import { X, Swords, Shield, Heart, Sparkles, Flame, Droplets, Leaf, Mountain, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import type { Dragon, Element } from "@/store/dragons";

const ELEMENT_META: Record<Element, { label: string; color: string; icon: React.ComponentType<{ className?: string }>; strong: Element; weak: Element }> = {
  Fire:  { label: "화염",   color: "text-rose-300",    icon: Flame,    strong: "Wood",  weak: "Water" },
  Water: { label: "물",     color: "text-sky-300",     icon: Droplets, strong: "Fire",  weak: "Earth" },
  Wood:  { label: "나무",   color: "text-emerald-300", icon: Leaf,     strong: "Earth", weak: "Fire" },
  Earth: { label: "대지",   color: "text-amber-300",   icon: Mountain, strong: "Water", weak: "Wood" },
  Light: { label: "빛",     color: "text-yellow-200",  icon: Sun,      strong: "Dark",  weak: "Dark" },
  Dark:  { label: "어둠",   color: "text-violet-300",  icon: Moon,     strong: "Light", weak: "Light" },
};

// Build presets keyed by stat focus. Each preset carries a title, narrative
// description, suggested gameplay tags, and a recommended-stat scalar so we
// can pick a sensible default tab from the dragon's strongest attribute.
type BuildKey = "ATK" | "DEF" | "HP" | "MP";
const BUILD_PRESETS: Record<BuildKey, { title: string; desc: string; tags: string[] }> = {
  ATK: {
    title: "공격형 딜러",
    desc: "선공으로 적의 체력을 빠르게 깎는 빌드. 공격 보조 장비를 우선 장착하고, 치명타·관통 옵션을 노려 단기전을 끝내세요.",
    tags: ["선공", "치명타", "공격 버프"],
  },
  DEF: {
    title: "방어형 탱커",
    desc: "긴 교전을 버티며 아군을 보호하는 빌드. 피해 감소·도발 효과와 회복 장비를 조합해 전선을 유지하세요.",
    tags: ["피해 감소", "도발", "회복"],
  },
  HP: {
    title: "지속형 브루저",
    desc: "높은 체력을 바탕으로 끈질기게 싸우는 빌드. 흡혈·재생 효과와 시너지가 좋아 장기전에서 유리합니다.",
    tags: ["체력", "흡혈", "재생"],
  },
  MP: {
    title: "마법형 캐스터",
    desc: "MP를 활용한 스킬 위주 빌드. 마나 회복과 스킬 강화 장비를 권장하며, 원거리 견제로 거리를 유지하세요.",
    tags: ["스킬", "마나", "원거리"],
  },
};

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
  // Keyboard: ESC closes; ←/→ navigate when handlers are wired.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
  }, [onClose, onNext, onPrev]);

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
  const build = BUILD_PRESETS[buildTab];

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
              <span className="font-semibold">{meta.label} 속성</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(onPrev || onNext) && (
              <>
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="이전 드래곤"
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label="다음 드래곤"
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="닫기"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {dragon.image && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40">
              <img
                // Prefer the high-res variant in the modal hero.
                src={dragon.imageLarge ?? dragon.image}
                srcSet={dragon.imageLarge ? `${dragon.image} 480w, ${dragon.imageLarge} 800w` : undefined}
                sizes="(max-width: 640px) 100vw, 448px"
                alt={`${dragon.name} 일러스트`}
                className="absolute inset-0 h-full w-full object-contain"
                decoding="async"
                // High priority hint — this is the modal's focal point.
                fetchPriority="high"
              />
            </div>
          )}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">스탯</h4>
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300">합계 {total}</span>
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
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">속성 상성</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <p className="text-[10px] uppercase text-emerald-400/80">강함</p>
                <p className={`flex items-center gap-1 text-sm font-bold ${strongMeta.color}`}>
                  <strongMeta.icon className="h-3.5 w-3.5" />
                  {strongMeta.label}
                </p>
              </div>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <p className="text-[10px] uppercase text-rose-400/80">약함</p>
                <p className={`flex items-center gap-1 text-sm font-bold ${weakMeta.color}`}>
                  <weakMeta.icon className="h-3.5 w-3.5" />
                  {weakMeta.label}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">추천 빌드</h4>
            {/* Tab bar: one button per stat focus. The dragon's natural
                strength is highlighted with a small badge so the user can
                tell at a glance which preset matches its raw stats best. */}
            <div
              role="tablist"
              aria-label="빌드 분류"
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
                        title="기본 추천"
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
                    기본 추천
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{build.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {build.tags.map((t) => (
                  <span key={t} className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-slate-800 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-100 hover:bg-slate-700"
          >
            닫기
          </button>
        </div>
        </div>
        {/* Neighbor preloading. Render hidden <img> tags for the previous
            and next dragons so swiping/arrow-key navigation gets a
            decoded bitmap from cache instead of a fresh network round-trip.
            We preload the small variant (480w) which is what the modal
            falls back to when the large one isn't yet decoded. */}
        <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          {nextDragon?.image && (
            <img src={nextDragon.image} alt="" decoding="async" loading="eager" />
          )}
          {nextDragon?.imageLarge && (
            <img src={nextDragon.imageLarge} alt="" decoding="async" loading="eager" />
          )}
          {prevDragon?.image && (
            <img src={prevDragon.image} alt="" decoding="async" loading="eager" />
          )}
          {prevDragon?.imageLarge && (
            <img src={prevDragon.imageLarge} alt="" decoding="async" loading="eager" />
          )}
        </div>
      </div>
    </div>
  );
}