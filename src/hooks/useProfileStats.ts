import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ProfileStats {
  gold: number;
  worm_affinity: number;
  courage: number;
}

const EMPTY: ProfileStats = { gold: 0, worm_affinity: 0, courage: 0 };

export function profileStatsKey(userId: string | null) {
  return ["profile-stats", userId] as const;
}

/**
 * React Query view of the player's persistent currencies/stats on `profiles`.
 * Realtime row updates (story finalize, shop, training) invalidate the cache so
 * the GNB always renders live numbers.
 */
export function useProfileStats() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: profileStatsKey(userId),
    enabled: !!userId && !authLoading,
    queryFn: async (): Promise<ProfileStats> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("gold, worm_affinity, courage")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? null) as Partial<ProfileStats> | null;
      return {
        gold: row?.gold ?? 0,
        worm_affinity: row?.worm_affinity ?? 0,
        courage: row?.courage ?? 0,
      };
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-stats-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: profileStatsKey(userId) });
        },
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.error("[profile-stats] removeChannel failed:", e);
      }
    };
  }, [userId, queryClient]);

  return {
    stats: query.data ?? EMPTY,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
