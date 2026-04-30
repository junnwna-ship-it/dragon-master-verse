import { useEffect } from "react";
import { X, Swords, Shield, Heart, Sparkles, Flame, Droplets, Leaf, Mountain, Sun, Moon } from "lucide-react";
import type { Dragon, Element } from "@/store/dragons";

const ELEMENT_META: Record<Element, { label: string; color: string; icon: React.ComponentType<{ className?: string }>; strong: Element; weak: Element }> = {
  Fire:  { label: "화염",   color: "text-rose-300",    icon: Flame,    strong: "Wood",  weak: "Water" },
  Water: { label: "물",     color: "text-sky-300",     icon: Droplets, strong: "Fire",  weak: "Earth" },
  Wood:  { label: "나무",   color: "text-emerald-300", icon: Leaf,     strong: "Earth", weak: "Fire" },
  Earth: { label: "대지",   color: "text-amber-300",   icon: Mountain, strong: "Water", weak: "Wood" },
  Light: { label: "빛",     color: "text-yellow-200",  icon: Sun,      strong: "Dark",  weak: "Dark" },
  Dark:  { label: "어둠",   color: "text-violet-300",  icon: Moon,     strong: "Light", weak: "Light" },
};

function recommendBuild(d: Dragon): { title: string; desc: string; tags: string[] } {
  const { atk, def, maxHp, mp } = d;
  const max = Math.max(atk, def, maxHp / 10, mp / 5);
  if (max === atk) return { title: "공격형 딜러", desc: "선공으로 적의 체력을 빠르게 깎는 빌드. 공격 보조 장비를 우선 장착하세요.", tags: ["선공", "치명타", "공격 버프"] };
  if (max === def) return { title: "방어형 탱커", desc: "긴 교전을 버티며 아군을 보호하는 빌드. 방어/회복 장비가 잘 어울립니다.", tags: ["피해 감소", "도발", "회복"] };
  if (max === maxHp / 10) return { title: "지속형 브루저", desc: "높은 체력을 바탕으로 끈질기게 싸우는 빌드. 흡혈/재생 효과와 시너지가 좋습니다.", tags: ["체력", "흡혈", "재생"] };
  return { title: "마법형 캐스터", desc: "MP를 활용한 스킬 위주 빌드. 마나 회복과 스킬 강화 장비를 권장합니다.", tags: ["스킬", "마나", "원거리"] };
}

export function DragonDetailModal({ dragon, onClose }: { dragon: Dragon; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const meta = ELEMENT_META[dragon.element];
  const ElIcon = meta.icon;
  const total = dragon.atk + dragon.def + dragon.maxHp + dragon.mp;
  const build = recommendBuild(dragon);
  const strongMeta = ELEMENT_META[meta.strong];
  const weakMeta = ELEMENT_META[meta.weak];

  const stats = [
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
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
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
            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5 px-3 py-3">
              <p className="text-sm font-bold text-amber-200">{build.title}</p>
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
      </div>
    </div>
  );
}