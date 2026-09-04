/**
 * Cloud persistence for studio (UGC) story playthroughs.
 *
 * Mirrors `ugcProgress.ts` (localStorage) so a signed-in player resumes the
 * same node on any device. Local storage stays as the guest / offline fallback.
 */
import { supabase } from "@/integrations/supabase/client";
import { isValidProgress, type UgcProgress } from "./ugcProgress";

type Row = {
  story_id: string;
  node_key: string | null;
  finished: boolean;
  stats: Record<string, number> | null;
  picked: number | null;
  quiz_result: "correct" | "wrong" | null;
  updated_at: string;
};

export function rowToProgress(row: Row): UgcProgress | null {
  const progress = {
    nodeKey: row.node_key ?? null,
    finished: !!row.finished,
    stats: (row.stats ?? {}) as Record<string, number>,
    picked: row.picked ?? null,
    quizResult: row.quiz_result ?? null,
    updatedAt: new Date(row.updated_at).getTime() || 0,
  };
  return isValidProgress(progress) ? progress : null;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchUgcProgress(storyId: string | null | undefined): Promise<UgcProgress | null> {
  if (!storyId) return null;
  try {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await supabase
      .from("ugc_story_progress")
      .select("story_id,node_key,finished,stats,picked,quiz_result,updated_at")
      .eq("user_id", userId)
      .eq("story_id", storyId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToProgress(data as Row);
  } catch {
    return null;
  }
}

export async function persistUgcProgress(
  storyId: string | null | undefined,
  progress: Omit<UgcProgress, "updatedAt">,
): Promise<boolean> {
  if (!storyId) return false;
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase.from("ugc_story_progress").upsert(
      {
        user_id: userId,
        story_id: storyId,
        node_key: progress.nodeKey,
        finished: progress.finished,
        stats: progress.stats,
        picked: progress.picked,
        quiz_result: progress.quizResult,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,story_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function deleteUgcProgress(storyId: string | null | undefined): Promise<void> {
  if (!storyId) return;
  try {
    const userId = await currentUserId();
    if (!userId) return;
    await supabase.from("ugc_story_progress").delete().eq("user_id", userId).eq("story_id", storyId);
  } catch {
    /* best effort */
  }
}

/** Prefer whichever snapshot was written last (device sync tie-break). */
export function pickNewestProgress(
  a: UgcProgress | null,
  b: UgcProgress | null,
): UgcProgress | null {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}
