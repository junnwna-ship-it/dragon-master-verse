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

  const userId = user?.id ?? null;

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setGold(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("gold")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[profile] fetch failed:", error);
      setLoading(false);
      return;
    }
    setGold(data?.gold ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Realtime — gold updates from RPCs (battle reward, shop) reflect instantly.
  useEffect(() => {
    if (!userId) return;
    // Unique channel name per mount avoids "cannot add postgres_changes
    // callbacks ... after subscribe()" when multiple components consume
    // useProfile() at the same time.
    const channelName = `profile-${userId}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
          (payload) => {
            const next = (payload.new as { gold?: number } | null)?.gold;
            if (typeof next === "number") setGold(next);
          },
        )
        .subscribe();
    } catch (e) {
      console.error("[profile] realtime subscribe failed:", e);
    }
    return () => {
      if (!channel) return;
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.error("[profile] removeChannel failed:", e);
      }
    };
  }, [userId]);

  return { gold: gold ?? 0, loading, refetch: fetchProfile };
}
