import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Text-based CMS data layer.
 *
 * All four CMS tables are protected by RLS in the database:
 *  - admins (user_roles.role = 'admin') have full access regardless of is_published
 *  - other signed-in users can only SELECT rows where is_published = true
 *
 * So the same `select('*')` returns everything for an admin and only the
 * published rows for a player — no client-side filtering is relied upon for
 * security. We still pass `publishedOnly` for admin previews / player screens
 * to make the intent explicit.
 */
export type CmsTable =
  | "store_items"
  | "story_nodes"
  | "training_stats"
  | "game_settings"
  | "characters"
  | "bgm_tracks"
  | "battle_skills";

export type StoreItem = Tables<"store_items">;
export type StoryNode = Tables<"story_nodes">;
export type TrainingStat = Tables<"training_stats">;
export type GameSetting = Tables<"game_settings">;
export type CharacterRow = Tables<"characters">;
export type BgmTrack = Tables<"bgm_tracks">;
export type BattleSkill = Tables<"battle_skills">;

const ORDER_BY: Record<CmsTable, { column: string; ascending: boolean }> = {
  store_items: { column: "sort_order", ascending: true },
  story_nodes: { column: "stage_number", ascending: true },
  training_stats: { column: "sort_order", ascending: true },
  game_settings: { column: "key", ascending: true },
  characters: { column: "sort_order", ascending: true },
  bgm_tracks: { column: "sort_order", ascending: true },
  battle_skills: { column: "sort_order", ascending: true },
};

export function cmsKey(table: CmsTable, publishedOnly: boolean) {
  return ["cms", table, publishedOnly ? "published" : "all"] as const;
}

/** Generic list hook for any CMS table. */
export function useCmsList<T>(table: CmsTable, opts?: { publishedOnly?: boolean; enabled?: boolean }) {
  const publishedOnly = opts?.publishedOnly ?? false;
  return useQuery({
    queryKey: cmsKey(table, publishedOnly),
    enabled: opts?.enabled ?? true,
    queryFn: async (): Promise<T[]> => {
      let q = supabase.from(table).select("*");
      if (publishedOnly) q = q.eq("is_published", true);
      const ord = ORDER_BY[table];
      const { data, error } = await q.order(ord.column, { ascending: ord.ascending });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

/** Published-only convenience hooks used by the player-facing screens. */
export const usePublishedStoreItems = () =>
  useCmsList<StoreItem>("store_items", { publishedOnly: true });
export const usePublishedStoryNodes = () =>
  useCmsList<StoryNode>("story_nodes", { publishedOnly: true });
export const usePublishedTrainingStats = () =>
  useCmsList<TrainingStat>("training_stats", { publishedOnly: true });
export const usePublishedGameSettings = () =>
  useCmsList<GameSetting>("game_settings", { publishedOnly: true });
export const usePublishedCharacters = () =>
  useCmsList<CharacterRow>("characters", { publishedOnly: true });
export const usePublishedBgmTracks = () =>
  useCmsList<BgmTrack>("bgm_tracks", { publishedOnly: true });
export const usePublishedBattleSkills = () =>
  useCmsList<BattleSkill>("battle_skills", { publishedOnly: true });

/** Admin write helpers — insert / update / delete on any CMS table. */
export function useCmsMutations(table: CmsTable) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cms", table] });
  };

  const create = useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from(table)
        .insert(row as TablesInsert<CmsTable>)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from(table)
        .update(patch as TablesUpdate<CmsTable>)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}