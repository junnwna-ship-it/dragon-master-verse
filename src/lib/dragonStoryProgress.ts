import { supabase } from "@/integrations/supabase/client";

export const DRAGON_STORY_VERSION = "v1";

export type DragonStoryScope = {
  dragonId: string;
  chapterId: string;
  storyVersion: string;
};

export type VnProgress = {
  chapterId: string | null;
  nodeKey: string | null;
  stats: Record<string, number>;
  visited: string[];
  applied: string[];
  finished: boolean;
};

type ProgressRow = {
  node_key: string;
  stats: Record<string, number> | null;
  visited: string[] | null;
  applied: string[] | null;
  finished: boolean;
};

export function isMissingProgressTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function scopedProgressFromRow(row: ProgressRow, runId: string): VnProgress {
  return {
    chapterId: runId,
    nodeKey: row.node_key,
    stats: row.stats ?? {},
    visited: row.visited ?? [row.node_key],
    applied: row.applied ?? [],
    finished: row.finished,
  };
}

export function legacyProgressFromRow(
  row: Record<string, unknown> | null,
  runId: string,
): VnProgress | null {
  if (
    !row ||
    row.vn_chapter_id !== runId ||
    typeof row.vn_node_key !== "string" ||
    !row.vn_node_key.trim()
  )
    return null;
  return {
    chapterId: runId,
    nodeKey: row.vn_node_key,
    stats: (row.vn_stats as Record<string, number> | null) ?? {},
    visited: (row.vn_visited as string[] | null) ?? [row.vn_node_key],
    applied: (row.vn_applied as string[] | null) ?? [],
    finished: Boolean(row.vn_finished),
  };
}

export async function readScopedProgress(userId: string, scope: DragonStoryScope) {
  const { data, error } = await supabase
    .from("dragon_story_progress" as never)
    .select("node_key,stats,visited,applied,finished")
    .eq("user_id", userId)
    .eq("dragon_id", scope.dragonId)
    .eq("chapter_id", scope.chapterId)
    .eq("story_version", scope.storyVersion)
    .maybeSingle();
  return { row: data as ProgressRow | null, error };
}

export async function writeScopedProgress(
  userId: string,
  scope: DragonStoryScope,
  snapshot: VnProgress,
) {
  return supabase.from("dragon_story_progress" as never).upsert(
    {
      user_id: userId,
      dragon_id: scope.dragonId,
      chapter_id: scope.chapterId,
      story_version: scope.storyVersion,
      node_key: snapshot.nodeKey,
      stats: snapshot.stats,
      visited: snapshot.visited,
      applied: snapshot.applied,
      finished: snapshot.finished,
    } as never,
    { onConflict: "user_id,dragon_id,chapter_id,story_version" },
  );
}

export async function deleteScopedProgress(userId: string, scope: DragonStoryScope) {
  return supabase
    .from("dragon_story_progress" as never)
    .delete()
    .eq("user_id", userId)
    .eq("dragon_id", scope.dragonId)
    .eq("chapter_id", scope.chapterId)
    .eq("story_version", scope.storyVersion);
}
