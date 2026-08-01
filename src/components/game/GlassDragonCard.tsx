import { motion } from "framer-motion";
import { Heart, Droplet, Sword, Shield, Plus, Check } from "lucide-react";
import type { Dragon } from "@/store/dragons";
import { DragonImage } from "./DragonImage";

const elementBadge: Record<string, string> = {
  Wood: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100",
  Water: "border-sky-300/40 bg-sky-500/20 text-sky-100",
  Fire: "border-rose-300/40 bg-rose-500/20 text-rose-100",
  Earth: "border-amber-300/40 bg-amber-500/20 text-amber-100",
  Light: "border-yellow-200/40 bg-yellow-300/20 text-yellow-100",
  Dark: "border-violet-300/40 bg-violet-500/20 text-violet-100",
};

const elementGlow: Record<string, string> = {
  Wood: "shadow-[0_8px_32px_-8px_rgb(16_185_129/0.45)]",
  Water: "shadow-[0_8px_32px_-8px_rgb(14_165_233/0.45)]",
  Fire: "shadow-[0_8px_32px_-8px_rgb(244_63_94/0.45)]",
  Earth: "shadow-[0_8px_32px_-8px_rgb(245_158_11/0.45)]",
  Light: "shadow-[0_8px_32px_-8px_rgb(250_204_21/0.45)]",
  Dark: "shadow-[0_8px_32px_-8px_rgb(139_92_246/0.45)]",
};

/**
 * 글래스모피즘 드래곤 카드.
 * - 이미지를 메인으로 크게 노출 (object-cover)
 * - 하단에 원소 배지 + 이름 + 스탯 합계(=5000) 진행 바
 * - 선택 시 amber 링 강조, 우측 상단에 슬롯 번호 표시 가능
 * - 전투 로직과 무관 — 순수 표시용 컴포넌트
 */
export function GlassDragonCard({
  dragon,
  onClick,
  onToggleSelect,
  toggleLabel,
  selected = false,
  dim = false,
  slotIndex,
  className = "",
}: {
  dragon: Dragon;
  onClick?: () => void;
  /** 우상단 원형 버튼(덱 추가/제거). 지정하면 카드 탭과 분리된다. */
  onToggleSelect?: () => void;
  toggleLabel?: string;
  selected?: boolean;
  dim?: boolean;
  /** 1-based slot index (1..3) — 표시되면 우상단에 번호 배지가 뜬다 */
  slotIndex?: number;
  className?: string;
}) {
  const total = dragon.maxHp + dragon.mp + dragon.atk + dragon.def;
  // 합산 5000 기준의 4개 스탯 비율
  const segs = [
    { key: "HP", val: dragon.maxHp, color: "bg-emerald-400" },
    { key: "MP", val: dragon.mp, color: "bg-sky-400" },
    { key: "ATK", val: dragon.atk, color: "bg-rose-400" },
    { key: "DEF", val: dragon.def, color: "bg-amber-400" },
  ];
  const badgeTone = elementBadge[dragon.element] ?? elementBadge.Wood;
  const glow = elementGlow[dragon.element] ?? elementGlow.Wood;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={onClick ? { y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      aria-pressed={selected}
      className={`group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border text-left backdrop-blur-md transition ${
        selected
          ? `border-amber-300/70 bg-white/10 ring-2 ring-amber-300/60 ${glow}`
          : dim
            ? "border-white/5 bg-white/[0.03] opacity-50"
            : `border-white/15 bg-white/10 hover:border-white/30 ${glow}`
      } ${className}`}
    >
      {/* 이미지 (메인) — object-cover로 비율 유지 */}
      <div className="absolute inset-0">
        <DragonImage dragon={dragon} className="h-full w-full" />
        {/* 위쪽은 살짝, 아래는 깊게 어둡게 — 텍스트 가독성 */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/85" />
      </div>

      {/* 상단: 원소 배지 + (옵션) 슬롯 번호 */}
      <div className="relative z-10 flex items-start justify-between p-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${badgeTone}`}
        >
          {dragon.element}
        </span>
        <span className="flex items-center gap-1">
          {slotIndex && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] font-extrabold text-slate-950 shadow ring-2 ring-amber-200/60">
              {slotIndex}
            </span>
          )}
          {onToggleSelect && (
            <span
              role="button"
              tabIndex={0}
              aria-label={toggleLabel}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect();
                }
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-md transition ${
                selected
                  ? "border-amber-200/60 bg-amber-400 text-slate-950"
                  : "border-white/30 bg-slate-950/50 text-white hover:bg-slate-950/80"
              }`}
            >
              {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </span>
          )}
        </span>
      </div>

      {/* 하단: 이름 + 스탯 합계 진행 바 */}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-1.5 p-2.5">
        <div className="flex items-baseline justify-between gap-1">
          <p className="truncate text-sm font-extrabold tracking-wide text-white drop-shadow">
            {dragon.name}
          </p>
          <p className="font-mono text-[10px] font-bold text-white/80">
            ∑ {total.toLocaleString()}
          </p>
        </div>

        {/* 4분할 스탯 합계 바 — 시각적으로 5000의 분포가 한눈에 */}
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
          {segs.map((s) => (
            <div
              key={s.key}
              className={`${s.color} h-full`}
              style={{ width: `${(s.val / Math.max(1, total)) * 100}%` }}
              title={`${s.key} ${s.val}`}
            />
          ))}
        </div>

        {/* 스탯 미니 라벨 */}
        <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-semibold text-white/85">
          <span className="flex items-center justify-center gap-0.5">
            <Heart className="h-2.5 w-2.5 text-emerald-300" />
            {dragon.maxHp}
          </span>
          <span className="flex items-center justify-center gap-0.5">
            <Droplet className="h-2.5 w-2.5 text-sky-300" />
            {dragon.mp}
          </span>
          <span className="flex items-center justify-center gap-0.5">
            <Sword className="h-2.5 w-2.5 text-rose-300" />
            {dragon.atk}
          </span>
          <span className="flex items-center justify-center gap-0.5">
            <Shield className="h-2.5 w-2.5 text-amber-300" />
            {dragon.def}
          </span>
        </div>
      </div>
    </motion.button>
  );
}