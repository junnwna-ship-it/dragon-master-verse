import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  deleteScopedProgress,
  isMissingProgressTable,
  legacyProgressFromRow,
  readScopedProgress,
  scopedProgressFromRow,
  writeScopedProgress,
  type DragonStoryScope,
} from "@/lib/dragonStoryProgress";

export interface VnSaveSnapshot {
  chapterId: string | null;
  nodeKey: string | null;
  stats: Record<string, number>;
  visited: string[];
  applied: string[];
  finished: boolean;
}

/**
 * Per-dragon/chapter progress after DM-02 migration, with the old single-slot
 * row retained only as a compatibility fallback until the schema is applied.
 */
export function useVnSave(chapterId: string, scope?: DragonStoryScope) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [remote, setRemote] = useState<VnSaveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [backend, setBackend] = useState<"scoped" | "legacy" | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const writeRevision = useRef(0);
  const scopeDragonId = scope?.dragonId;
  const scopeChapterId = scope?.chapterId;
  const scopeVersion = scope?.storyVersion;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setRemote(null);
      setBackend(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSaveError(null);
    const activeScope =
      scopeDragonId && scopeChapterId && scopeVersion
        ? { dragonId: scopeDragonId, chapterId: scopeChapterId, storyVersion: scopeVersion }
        : null;
    void (async () => {
      try {
        const readLegacy = async () => {
          const { data, error } = await supabase
            .from("story_saves")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (error) throw error;
          return legacyProgressFromRow((data ?? null) as Record<string, unknown> | null, chapterId);
        };
        if (activeScope) {
          const { row, error } = await readScopedProgress(userId, activeScope);
          if (cancelled) return;
          if (!error && row) {
            setRemote(scopedProgressFromRow(row, chapterId));
            setBackend("scoped");
            return;
          }
          if (error && !isMissingProgressTable(error)) throw error;
          const legacy = await readLegacy();
          if (cancelled) return;
          if (!error && legacy) {
            // Copy only the matching legacy slot. Do not delete it: older
            // clients may still read it until the transition is complete.
            const migrated = await writeScopedProgress(userId, activeScope, legacy);
            if (cancelled) return;
            if (migrated.error) throw migrated.error;
          }
          setRemote(legacy);
          setBackend(error ? "legacy" : "scoped");
        } else {
          const legacy = await readLegacy();
          if (cancelled) return;
          setRemote(legacy);
          setBackend("legacy");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[vn_save] load failed:", error);
          setSaveError(error instanceof Error ? error.message : "진행 기록을 불러오지 못했습니다.");
          setBackend(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, chapterId, scopeDragonId, scopeChapterId, scopeVersion]);

  /** Serialize writes so quick navigation cannot reorder or drop the last scene. */
  const persist = useCallback(
    (snapshot: VnSaveSnapshot) => {
      if (!userId || !snapshot.nodeKey || !backend) return;
      const activeScope =
        scopeDragonId && scopeChapterId && scopeVersion
          ? { dragonId: scopeDragonId, chapterId: scopeChapterId, storyVersion: scopeVersion }
          : null;
      const revision = ++writeRevision.current;
      setSaving(true);
      writeQueue.current = writeQueue.current.then(async () => {
        try {
          const { error } =
            backend === "scoped" && activeScope
              ? await writeScopedProgress(userId, activeScope, snapshot)
              : await supabase.from("story_saves").upsert(
                  {
                    user_id: userId,
                    vn_chapter_id: snapshot.chapterId,
                    vn_node_key: snapshot.nodeKey,
                    vn_stats: snapshot.stats,
                    vn_visited: snapshot.visited,
                    vn_applied: snapshot.applied,
                    vn_finished: snapshot.finished,
                  },
                  { onConflict: "user_id" },
                );
          if (error) throw error;
          setSaveError(null);
        } catch (error) {
          console.error("[vn_save] save failed:", error);
          setSaveError(error instanceof Error ? error.message : "진행 기록을 저장하지 못했습니다.");
        } finally {
          if (revision === writeRevision.current) setSaving(false);
        }
      });
    },
    [userId, backend, scopeDragonId, scopeChapterId, scopeVersion],
  );

  const clear = useCallback(async () => {
    await writeQueue.current;
    if (!userId) {
      setRemote(null);
      return true;
    }
    if (!backend) return false;
    const activeScope =
      scopeDragonId && scopeChapterId && scopeVersion
        ? { dragonId: scopeDragonId, chapterId: scopeChapterId, storyVersion: scopeVersion }
        : null;
    try {
      if (backend === "scoped" && activeScope) {
        const { error } = await deleteScopedProgress(userId, activeScope);
        if (error) throw error;
      }
      // A copied legacy slot must not reappear when its scoped row is cleared.
      // The chapter filter protects the other dragon's legacy snapshot.
      const { error } = await supabase
        .from("story_saves")
        .update({
          vn_chapter_id: null,
          vn_node_key: null,
          vn_stats: {},
          vn_visited: [],
          vn_applied: [],
          vn_finished: false,
        })
        .eq("user_id", userId)
        .eq("vn_chapter_id", chapterId);
      if (error) throw error;
      setRemote(null);
      setSaveError(null);
      return true;
    } catch (error) {
      console.error("[vn_save] clear failed:", error);
      setSaveError(error instanceof Error ? error.message : "진행 기록을 지우지 못했습니다.");
      return false;
    }
  }, [userId, backend, chapterId, scopeDragonId, scopeChapterId, scopeVersion]);

  return { remote, loading, saving, saveError, backend, persist, clear, signedIn: !!userId };
}
