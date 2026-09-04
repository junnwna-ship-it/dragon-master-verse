import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Dragon } from "@/store/dragons";

/**
 * Per-player dragon growth (`owned_dragons`).
 *
 * The `dragons` table only holds the shared base stats; every player's
 * level / exp / stat points / stat bonuses live in `owned_dragons`. UI that
 * shows a dragon's *current* numbers must bind to these rows, not to the
 * global table, so one player's training never leaks into another's view.
 */
export interface GrowthRow {
  dragon_id: string;
  level: number;
  exp: number;
  stat_points: number;
  bonus_atk: number;
  bonus_max_hp: number;
  bonus_def: number;
  bonus_mp: number;
}

export const ownedGrowthKey = (userId: string | null) => ["owned_growth", userId] as const;

/** Applies an `owned_dragons` row on top of the dragon's shared base stats. */
export function applyGrowth(dragon: Dragon, row?: GrowthRow): Dragon {
  const base = dragon.base ?? {
    maxHp: dragon.maxHp,
    mp: dragon.mp,
    atk: dragon.atk,
    def: dragon.def,
  };
  const maxHp = base.maxHp + (row?.bonus_max_hp ?? 0);
  return {
    ...dragon,
    base,
    maxHp,
    hp: maxHp,
    mp: base.mp + (row?.bonus_mp ?? 0),
    atk: base.atk + (row?.bonus_atk ?? 0),
    def: base.def + (row?.bonus_def ?? 0),
    level: row?.level ?? 1,
    exp: row?.exp ?? 0,
    statPoints: row?.stat_points ?? 0,
  };
}

export function useOwnedGrowth() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ownedGrowthKey(userId),
    enabled: !!userId,
    staleTime: 10_000,
    queryFn: async (): Promise<GrowthRow[]> => {
      const { data, error } = await supabase
        .from("owned_dragons")
        .select("dragon_id, level, exp, stat_points, bonus_atk, bonus_max_hp, bonus_def, bonus_mp")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as GrowthRow[];
    },
  });

  const rows = query.data ?? [];
  const byDragon = new Map(rows.map((r) => [r.dragon_id, r]));

  /**
   * Returns the dragon with the caller's own growth applied. While the rows
   * are still loading (or for guests) the dragon is returned untouched so the
   * card never flashes base numbers over already-correct ones.
   */
  const resolve = useCallback(
    (dragon: Dragon): Dragon => {
      if (!userId || query.isLoading) return dragon;
      return applyGrowth(dragon, dragon.uuid ? byDragon.get(dragon.uuid) : undefined);
    },
    // byDragon is rebuilt from query.data on each render; depend on the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, query.isLoading, query.data],
  );

  return { rows, byDragon, resolve, loading: query.isLoading, userId };
}
