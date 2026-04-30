import { motion, AnimatePresence } from "framer-motion";
import type { Element } from "@/store/dragons";
import { Leaf } from "lucide-react";

/** VFX 이펙트 종류 */
export type EffectType =
  | "slash"
  | "fire"
  | "water"
  | "wood"
  | "earth"
  | "metal"
  | "poison"
  | "heal"
  | "buff"
  | "debuff"
  | "burst";

export interface ActiveEffect {
  id: number;
  target: "player" | "enemy";
  type: EffectType;
  /** burst/파티클 계열에서 강도 배수 (스킬은 3) */
  intensity?: number;
}

/** Element → EffectType 매핑 (공격 타격 시 사용) */
export function elementToEffect(el: Element | string): EffectType {
  switch (el) {
    case "Fire": return "fire";
    case "Water": return "water";
    case "Wood": return "wood";
    case "Earth": return "earth";
    case "Light":
    case "Metal": return "metal";
    default: return "slash";
  }
}

/**
 * 카드 위에 absolute로 덮이는 VFX 레이어.
 * `effects` 배열 중 이 카드(target)에 해당하는 것만 렌더링.
 */
export function EffectOverlay({
  effects,
  target,
}: {
  effects: ActiveEffect[];
  target: "player" | "enemy";
}) {
  const mine = effects.filter((e) => e.target === target);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {mine.map((e) => (
          <EffectRenderer key={e.id} effect={e} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function EffectRenderer({ effect }: { effect: ActiveEffect }) {
  switch (effect.type) {
    case "slash":
      return <SlashFx />;
    case "fire":
      return <FireFx intensity={effect.intensity ?? 1} />;
    case "water":
      return <WaterFx />;
    case "wood":
      return <WoodFx />;
    case "earth":
      return <EarthFx />;
    case "metal":
      return <MetalFx />;
    case "poison":
      return <PoisonFx />;
    case "heal":
      return <HealFx />;
    case "buff":
      return <BuffFx />;
    case "debuff":
      return <DebuffFx />;
    case "burst":
      return <BurstFx intensity={effect.intensity ?? 3} />;
    default:
      return null;
  }
}

/* ────────── 개별 이펙트 ────────── */

function SlashFx() {
  // 흰색 얇고 긴 대각선이 좌상→우하로 빠르게 그어짐
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 h-1 w-[180%] origin-center rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.9)]"
      style={{ rotate: -25 }}
      initial={{ x: "-90%", y: "-50%", opacity: 0, scaleX: 0.4 }}
      animate={{ x: "-10%", y: "-50%", opacity: [0, 1, 0], scaleX: 1.2 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    />
  );
}

function FireFx({ intensity = 1 }: { intensity?: number }) {
  // 5개 파티클이 중앙에서 사방으로 터지듯 퍼지며 위로 솟구침
  const count = Math.round(5 * intensity);
  const parts = Array.from({ length: count });
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-orange-500/40 via-rose-600/20 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.5 }}
      />
      {parts.map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dx = Math.cos(angle) * 60;
        const dy = Math.sin(angle) * 60 - 30;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full bg-gradient-to-br from-yellow-300 via-orange-500 to-rose-600 shadow-[0_0_12px_rgba(251,146,60,0.9)]"
            initial={{ x: -8, y: -8, scale: 0.4, opacity: 0 }}
            animate={{ x: -8 + dx, y: -8 + dy, scale: [0.4, 1.4, 0.6], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

/**
 * BurstFx — 스킬 적중용 화이트/골드 폭발.
 * 기본 5개 × intensity (스킬=3 → 15개) 파티클 + 화면 잔상 링.
 */
function BurstFx({ intensity = 3 }: { intensity?: number }) {
  const count = Math.max(6, Math.round(5 * intensity));
  const parts = Array.from({ length: count });
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-white/70 via-amber-300/40 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.45 }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-200"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      />
      {parts.map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const dist = 60 + Math.random() * 50;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_14px_rgba(253,224,71,1)]"
            initial={{ x: -6, y: -6, scale: 0.4, opacity: 0 }}
            animate={{ x: -6 + dx, y: -6 + dy, scale: [0.4, 1.6, 0.4], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

/* ════════════════ 상태 이상 상시 오버레이 ════════════════ */

export interface StatusFlags {
  poisoned?: boolean;
  burning?: boolean;
  feared?: boolean;
  stunned?: boolean;
}

/**
 * 카드 이미지 위에 상시 깔리는 디버프 오버레이.
 * - poison: 보라 필터 + 부유하는 녹색 방울
 * - burn: 주황 필터 + 깜박이는 불꽃
 * - fear: (떨림은 부모 wrapper에서 적용) — 어두운 비네트
 * - stun: 머리 위 회전하는 💫
 */
export function StatusOverlay({ flags }: { flags: StatusFlags }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flags.poisoned && <PoisonStatus />}
      {flags.burning && <BurnStatus />}
      {flags.feared && <FearStatus />}
      {flags.stunned && <StunStatus />}
      {flags.frozen && <FreezeStatus />}
    </div>
  );
}

function PoisonStatus() {
  const drops = [0, 1, 2, 3];
  return (
    <>
      <div className="absolute inset-0 bg-purple-600/20 mix-blend-multiply" />
      {drops.map((i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-gradient-to-br from-lime-400 to-green-700 shadow-[0_0_8px_rgba(132,204,22,0.8)]"
          style={{ left: `${15 + i * 20}%`, top: `${50 + (i % 2) * 15}%` }}
          animate={{ y: [0, -5, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.6 + i * 0.2, ease: "easeInOut", delay: i * 0.15 }}
        />
      ))}
    </>
  );
}

function BurnStatus() {
  const flames = [0, 1, 2];
  return (
    <>
      <div className="absolute inset-0 bg-orange-500/15 mix-blend-screen" />
      {flames.map((i) => (
        <motion.div
          key={i}
          className="absolute bottom-1 h-3 w-3 rounded-full bg-gradient-to-t from-rose-600 via-orange-400 to-yellow-200 shadow-[0_0_10px_rgba(251,146,60,0.9)]"
          style={{ left: `${25 + i * 25}%` }}
          animate={{ y: [0, -8, 0], scale: [0.8, 1.1, 0.8], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.2 + i * 0.15, ease: "easeInOut", delay: i * 0.1 }}
        />
      ))}
    </>
  );
}

function FearStatus() {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-900/50 mix-blend-multiply" />
      <motion.div
        className="absolute inset-0 ring-2 ring-inset ring-purple-900/40"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
      />
    </>
  );
}

function StunStatus() {
  return (
    <motion.div
      className="absolute left-1/2 top-1 -translate-x-1/2 select-none text-2xl"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
    >
      💫
    </motion.div>
  );
}

function WaterFx() {
  // 파란 링이 중앙에서 물결처럼 퍼짐 (2겹)
  return (
    <>
      {[0, 0.1].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-sky-300"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.6, delay, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-sky-400/30 via-blue-500/10 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.5 }}
      />
    </>
  );
}

function WoodFx() {
  // 초록 잎/덩굴 입자가 위로 흩날림
  const parts = Array.from({ length: 6 });
  return (
    <>
      {parts.map((_, i) => {
        const dx = (i - 2.5) * 18;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-sm bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
            initial={{ x: -5, y: -5, opacity: 0, rotate: 0 }}
            animate={{ x: -5 + dx, y: -50 - i * 8, opacity: [0, 1, 0], rotate: 180 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

function EarthFx() {
  // 카드가 흙먼지 충격 — 갈색 파편이 아래에서 튐
  const parts = Array.from({ length: 5 });
  return (
    <>
      <motion.div
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-amber-700/60 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.5 }}
      />
      {parts.map((_, i) => {
        const dx = (i - 2) * 22;
        return (
          <motion.div
            key={i}
            className="absolute bottom-2 left-1/2 h-3 w-3 rounded-md bg-amber-700 shadow-[0_0_8px_rgba(180,83,9,0.7)]"
            initial={{ x: -6, y: 0, opacity: 0 }}
            animate={{ x: -6 + dx, y: -50 - Math.random() * 20, opacity: [0, 1, 0], rotate: 360 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

function MetalFx() {
  // 금속/빛의 섬광 — 노란 라이트 빔 4개가 십자로 번쩍
  return (
    <>
      {[0, 45, 90, 135].map((rot, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-1.5 w-[140%] origin-center rounded-full bg-yellow-200 shadow-[0_0_18px_rgba(253,224,71,0.95)]"
          style={{ rotate: rot }}
          initial={{ x: "-50%", y: "-50%", scaleX: 0, opacity: 0 }}
          animate={{ x: "-50%", y: "-50%", scaleX: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

function PoisonFx() {
  // 보라/탁한 녹색 거품이 카드 아래에서 위로 천천히 올라옴
  const parts = Array.from({ length: 6 });
  return (
    <>
      {parts.map((_, i) => {
        const dx = (i - 2.5) * 14 + (Math.random() - 0.5) * 10;
        const size = 8 + (i % 3) * 4;
        const isGreen = i % 2 === 0;
        return (
          <motion.div
            key={i}
            className={`absolute bottom-0 left-1/2 rounded-full ${
              isGreen
                ? "bg-gradient-to-br from-lime-600 to-green-800"
                : "bg-gradient-to-br from-purple-500 to-violet-900"
            } shadow-[0_0_10px_rgba(168,85,247,0.7)]`}
            style={{ width: size, height: size, marginLeft: -size / 2 }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={{ x: dx, y: -90 - i * 6, opacity: [0, 0.9, 0], scale: [0.6, 1.1, 0.5] }}
            transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

function HealFx() {
  // 연두색 + 십자가 텍스트가 아래에서 위로 떠오르며 페이드아웃
  const parts = [0, 1, 2];
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-emerald-400/30 via-emerald-500/10 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.6 }}
      />
      {parts.map((i) => {
        const dx = (i - 1) * 20;
        return (
          <motion.div
            key={i}
            className="absolute bottom-2 left-1/2 select-none text-2xl font-extrabold text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]"
            style={{ marginLeft: -8 }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={{ x: dx, y: -70 - i * 8, opacity: [0, 1, 0], scale: 1 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
          >
            ＋
          </motion.div>
        );
      })}
    </>
  );
}

function BuffFx() {
  // 노란 오라가 위로 솟구침
  return (
    <>
      <motion.div
        className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-yellow-300/60 via-amber-300/30 to-transparent"
        initial={{ opacity: 0, y: "20%" }}
        animate={{ opacity: [0, 0.9, 0], y: ["20%", "-10%"] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {[0, 1, 2, 3].map((i) => {
        const dx = (i - 1.5) * 24;
        return (
          <motion.div
            key={i}
            className="absolute bottom-0 left-1/2 h-2 w-2 rounded-full bg-yellow-200 shadow-[0_0_12px_rgba(253,224,71,1)]"
            style={{ marginLeft: -4 }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: dx, y: -110, opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

function DebuffFx() {
  // 짙은 회색 그림자가 위에서 카드를 짓누름
  return (
    <motion.div
      className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-800/60 to-transparent"
      initial={{ opacity: 0, y: "-20%" }}
      animate={{ opacity: [0, 0.85, 0.5, 0], y: ["−20%", "0%", "0%", "0%"] }}
      transition={{ duration: 0.6, ease: "easeIn" }}
    />
  );
}