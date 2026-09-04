import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGameStore, type Dragon } from "@/store/dragons";
import { usePublishedTrainingStats } from "@/hooks/useCms";
import { useProfileStats, profileStatsKey } from "@/hooks/useProfileStats";
import { useAuth } from "@/hooks/useAuth";
import { ownedGrowthKey } from "@/hooks/useOwnedGrowth";

/**
 * Gold-priced training: each published `training_stats` row spends the player's
 * real `profiles.gold` (base_cost) and raises the dragon's stat by
 * `stat_increase` through the `train_stat_with_gold` RPC.
 */
export function GoldTrainingSection({ dragon }: { dragon: Dragon }) {
  const { data: rows, isLoading } = usePublishedTrainingStats();
  const { stats } = useProfileStats();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const refetchDragons = useGameStore((s) => s.fetchDragons);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading || !rows || rows.length === 0) return null;

  const upgrade = async (statCode: string, cost: number) => {
    if (!dragon.uuid) {
      toast.error("이 드래곤은 아직 클라우드에 저장되지 않았습니다.");
      return;
    }
    if (stats.gold < cost) {
      toast.error(`골드가 부족합니다. (보유 ${stats.gold.toLocaleString()}G / 필요 ${cost.toLocaleString()}G)`);
      return;
    }
    setBusy(statCode);
    const { data, error } = await supabase.rpc("train_stat_with_gold", {
      _dragon_uuid: dragon.uuid,
      _stat_code: statCode,
    });
    setBusy(null);
    if (error) {
      console.error("[gold-training] failed:", error);
      toast.error(`훈련 실패: ${error.message}`);
      return;
    }
    const result = (data ?? {}) as { increase?: number; remaining_gold?: number };
    toast.success(
      `훈련 완료! +${result.increase ?? 0} (남은 골드 ${(result.remaining_gold ?? 0).toLocaleString()}G)`,
    );
    void queryClient.invalidateQueries({ queryKey: profileStatsKey(user?.id ?? null) });
    void queryClient.invalidateQueries({ queryKey: ownedGrowthKey(user?.id ?? null) });
    void refetchDragons();
  };

  return (
    <section className="space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
          <Dumbbell className="h-3.5 w-3.5" /> 골드 훈련
        </p>
        <span className="flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-bold text-amber-300">
          <Coins className="h-3 w-3" /> {stats.gold.toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((s) => {
          const affordable = stats.gold >= s.base_cost;
          return (
            <button
              key={s.id}
              type="button"
              disabled={busy === s.stat_code || !affordable}
              onClick={() => void upgrade(s.stat_code, s.base_cost)}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                affordable
                  ? "border-slate-700/60 bg-slate-900/60 hover:border-amber-400"
                  : "cursor-not-allowed border-slate-800 bg-slate-900/40 opacity-50"
              }`}
            >
              {s.icon_url ? (
                <img src={s.icon_url} alt={s.stat_name} loading="lazy" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-lg border border-dashed border-slate-700" />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-100">{s.stat_name}</p>
                <p className="text-[10px] text-slate-400">
                  +{s.stat_increase} · {s.base_cost.toLocaleString()} G
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
