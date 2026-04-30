import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2, Egg, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useGameStore, type Dragon } from "@/store/dragons";
import { supabase } from "@/integrations/supabase/client";
import { DragonImage } from "../DragonImage";
import { QuizModal } from "../quiz/QuizModal";
import { useInventory } from "@/hooks/useInventory";

type Phase = "intro" | "items" | "quiz" | "contract" | "done";

interface Props {
  /** invoked when stage 1 is fully cleared (advance to stage 2). */
  onComplete: () => void;
  /** Re-fetch owned dragons after recruitment. */
  refetchOwned: () => Promise<void>;
}

/**
 * 마법사 멀린의 시험 — 스테이지 1 전용.
 * 드래곤 없이 진행: 인트로 → 아이템 획득 → 퀴즈 3문제 → 첫 드래곤 계약 → 다음 스테이지.
 * 시드 드래곤 8마리 중 무작위 3마리를 후보로 보여줘 하나 선택.
 */
export function MerlinStageView({ onComplete, refetchOwned }: Props) {
  const dragons = useGameStore((s) => s.dragons);
  const [phase, setPhase] = useState<Phase>("intro");
  const [contracting, setContracting] = useState(false);
  const { qty: invQty, loading: invLoading } = useInventory();
  const bondingTokens = invQty("bonding_token");

  // 후보 3마리 (시드 우선, 부족하면 전체에서 보충)
  const [candidates] = useState<Dragon[]>(() => {
    const seeds = dragons.filter((d) => d.isSeed);
    const pool = seeds.length >= 3 ? seeds : dragons;
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 3);
  });

  const handleContract = async (d: Dragon) => {
    if (!d.uuid) {
      toast.error("이 드래곤은 계약할 수 없습니다");
      return;
    }
    setContracting(true);
    const { error } = await supabase.rpc("recruit_dragon", { _dragon_uuid: d.uuid });
    setContracting(false);
    if (error) {
      toast.error(`계약 실패: ${error.message}`);
      return;
    }
    await refetchOwned();
    toast.success(`${d.name}와(과) 영혼의 계약을 맺었습니다!`);
    setPhase("done");
    setTimeout(() => onComplete(), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-900/40 via-slate-900 to-slate-950 p-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">Stage 1 · 입문</p>
        <h2 className="mt-1 text-xl font-extrabold text-purple-100">마법사 멀린의 시험</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6">
            <MerlinAvatar />
            <Bubble>
              "어서 오게, 수습생이여. 드래곤 마스터가 되기 위해선 <b>지혜와 용기</b>가 필요하다네.
              먼저 그대에게 마법 도구를 선물하지."
            </Bubble>
            <button onClick={() => setPhase("items")}
              className="rounded-xl bg-purple-500 px-6 py-3 text-sm font-extrabold text-white hover:bg-purple-400">
              계속 <ChevronRight className="ml-1 inline h-4 w-4" />
            </button>
          </motion.div>
        )}

        {phase === "items" && (
          <motion.div key="items" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 rounded-2xl border border-amber-500/40 bg-slate-900/70 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">선물 획득</p>
            <div className="grid grid-cols-2 gap-3">
              <ItemCard icon={<Egg className="h-10 w-10 text-amber-300" />} name="신비한 알" />
              <ItemCard icon={<Wand2 className="h-10 w-10 text-purple-300" />} name="마법 지팡이" />
            </div>
            <InventoryBadge label="교감의 증표" count={invLoading ? null : bondingTokens} />
            <Bubble>"이 도구들이 그대의 여정을 도울 걸세. 이제 <b>지혜의 시련</b>을 시작하지!"</Bubble>
            <button onClick={() => setPhase("quiz")}
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400">
              퀴즈 시작
            </button>
          </motion.div>
        )}

        {phase === "quiz" && (
          <QuizModal
            title="멀린의 지혜 시련"
            count={3}
            onClose={(res) => {
              if (res.correct === res.total && res.total > 0) {
                setPhase("contract");
              } else {
                // Allow retry
                toast.message("다시 도전해 보세요!");
                setPhase("intro");
              }
            }}
          />
        )}

        {phase === "contract" && (
          <motion.div key="contract" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="space-y-4 rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-900/30 to-slate-950 p-5">
            <div className="text-center">
              <Sparkles className="mx-auto h-10 w-10 text-amber-300" />
              <h3 className="mt-2 text-lg font-extrabold text-amber-200">첫 드래곤을 선택하라</h3>
              <p className="mt-1 text-xs text-slate-400">한 마리만 선택할 수 있다네. 신중히 고르게...</p>
              <InventoryBadge label="교감의 증표" count={invLoading ? null : bondingTokens} className="mx-auto mt-2" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {candidates.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleContract(d)}
                  disabled={contracting}
                  className="group relative aspect-[3/4] overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 transition hover:border-amber-400 hover:scale-105 disabled:opacity-50"
                >
                  <DragonImage dragon={d} className="h-full w-full" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 to-transparent p-1.5">
                    <p className="truncate text-xs font-extrabold text-white">{d.name}</p>
                    <p className="text-[9px] text-amber-300">{d.element}</p>
                  </div>
                </button>
              ))}
            </div>
            {contracting && (
              <div className="flex items-center justify-center gap-2 text-sm text-amber-300">
                <Loader2 className="h-4 w-4 animate-spin" /> 영혼의 계약을 체결 중...
              </div>
            )}
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
            <Sparkles className="mx-auto h-16 w-16 text-emerald-300 animate-pulse" />
            <p className="mt-3 text-lg font-extrabold text-emerald-200">선택한 드래곤과 영혼의 계약을 맺었습니다!</p>
            <p className="mt-1 text-xs text-slate-400">스테이지 2로 이동합니다...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MerlinAvatar() {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-b from-purple-600 to-indigo-900 text-6xl shadow-[0_0_40px_rgba(168,85,247,0.5)]"
    >
      🧙‍♂️
      <div className="absolute -inset-2 rounded-full ring-2 ring-purple-400/40 animate-pulse" />
    </motion.div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative max-w-md rounded-2xl border border-purple-400/40 bg-slate-950/80 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-lg">
      {children}
    </div>
  );
}

function ItemCard({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="flex flex-col items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-950/80 p-4"
    >
      {icon}
      <p className="text-xs font-bold text-amber-200">{name}</p>
    </motion.div>
  );
}

/**
 * 인벤토리 동기화 배지 — useInventory 훅 값을 실시간으로 표시.
 * count === null 이면 로딩 상태(…), 0이면 회색, 1+ 이면 강조 색상.
 */
function InventoryBadge({
  label,
  count,
  className = "",
}: {
  label: string;
  count: number | null;
  className?: string;
}) {
  const has = (count ?? 0) > 0;
  return (
    <motion.span
      key={count ?? "loading"}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
        has
          ? "border-pink-400/50 bg-pink-500/15 text-pink-100"
          : "border-slate-700 bg-slate-800/60 text-slate-400"
      } ${className}`}
    >
      <Sparkles className={`h-3 w-3 ${has ? "text-pink-300" : "text-slate-500"}`} />
      {label} × {count === null ? "…" : count}
    </motion.span>
  );
}