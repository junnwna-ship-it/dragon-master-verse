import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface StorySaveData {
  dragonUuid: string | null;
  dragonName: string | null;
  currentNodeId: number;
  playerHp: number;
  playerMp: number;
  visited: number[];
  updatedAt: string | null;
}

/**
 * Cloud-backed single-slot save for the story run.
 * Auto-persists (debounced) via `persist()` and can be resumed or cleared.
 */
export function useStorySave() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [save, setSave] = useState<StorySaveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setSave(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("story_saves")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[story_save] load failed:", error);
        setLoading(false);
        return;
      }
      setSave(
        data
          ? {
              dragonUuid: data.dragon_uuid,
              dragonName: data.dragon_name,
              currentNodeId: data.current_node_id,
              playerHp: data.player_hp,
              playerMp: data.player_mp,
              visited: data.visited ?? [],
              updatedAt: data.updated_at,
            }
          : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  /** Debounced upsert of the current run state. */
  const persist = useCallback(
    (next: Omit<StorySaveData, "updatedAt">) => {
      if (!userId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSaving(true);
        const { error } = await supabase.from("story_saves").upsert(
          {
            user_id: userId,
            dragon_uuid: next.dragonUuid,
            dragon_name: next.dragonName,
            current_node_id: next.currentNodeId,
            player_hp: next.playerHp,
            player_mp: next.playerMp,
            visited: next.visited,
          },
          { onConflict: "user_id" },
        );
        setSaving(false);
        if (error) {
          console.error("[story_save] save failed:", error);
          return;
        }
        setSave({ ...next, updatedAt: new Date().toISOString() });
      }, 400);
    },
    [userId],
  );

  const clear = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSave(null);
    if (!userId) return;
    const { error } = await supabase.from("story_saves").delete().eq("user_id", userId);
    if (error) console.error("[story_save] delete failed:", error);
  }, [userId]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { save, loading, saving, persist, clear };
}
