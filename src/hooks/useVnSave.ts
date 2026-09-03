import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface VnSaveSnapshot {
  chapterId: string | null;
  nodeKey: string | null;
  stats: Record<string, number>;
  visited: string[];
  applied: string[];
  finished: boolean;
}

/**
 * Cloud-backed visual-novel progress on the single `story_saves` row.
 *
 * The `vn_*` columns are additive CMS-era columns that are not part of the
 * generated Supabase types yet, so reads/writes go through a loose cast.
 */
export function useVnSave(chapterId: string) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [remote, setRemote] = useState<VnSaveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setRemote(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("story_saves")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[vn_save] load failed:", error);
        setLoading(false);
        return;
      }
      const row = (data ?? null) as Record<string, unknown> | null;
      const savedChapter = (row?.vn_chapter_id as string | null) ?? null;
      const savedNode = (row?.vn_node_key as string | null) ?? null;
      setRemote(
        row && savedChapter === chapterId && savedNode
          ? {
              chapterId: savedChapter,
              nodeKey: savedNode,
              stats: (row.vn_stats as Record<string, number> | null) ?? {},
              visited: (row.vn_visited as string[] | null) ?? [savedNode],
              applied: (row.vn_applied as string[] | null) ?? [],
              finished: Boolean(row.vn_finished),
            }
          : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, chapterId]);

  /** Debounced upsert of the current run. */
  const persist = useCallback(
    (snapshot: VnSaveSnapshot) => {
      if (!userId || !snapshot.nodeKey) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSaving(true);
        const payload = {
          user_id: userId,
          vn_chapter_id: snapshot.chapterId,
          vn_node_key: snapshot.nodeKey,
          vn_stats: snapshot.stats,
          vn_visited: snapshot.visited,
          vn_applied: snapshot.applied,
          vn_finished: snapshot.finished,
        } as unknown as never;
        const { error } = await supabase
          .from("story_saves")
          .upsert(payload, { onConflict: "user_id" });
        setSaving(false);
        if (error) console.error("[vn_save] save failed:", error);
      }, 500);
    },
    [userId],
  );

  const clear = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRemote(null);
    if (!userId) return;
    const patch = {
      vn_chapter_id: null,
      vn_node_key: null,
      vn_stats: {},
      vn_visited: [],
      vn_applied: [],
      vn_finished: false,
    } as unknown as never;
    const { error } = await supabase.from("story_saves").update(patch).eq("user_id", userId);
    if (error) console.error("[vn_save] clear failed:", error);
  }, [userId]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { remote, loading, saving, persist, clear, signedIn: !!userId };
}
