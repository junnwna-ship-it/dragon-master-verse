import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Subscribes to the current user's profile (gold etc.) with realtime updates.
 * Returns null while loading or signed-out.
 */
export function useProfile() {
  const { user } = useAuth();
  const [gold, setGold] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setGold(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("gold")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[profile] fetch failed:", error);
      setLoading(false);
      return;
    }
    setGold(data?.gold ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Realtime — gold updates from RPCs (battle reward, shop) reflect instantly.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as { gold?: number } | null)?.gold;
          if (typeof next === "number") setGold(next);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { gold: gold ?? 0, loading, refetch: fetchProfile };
}
