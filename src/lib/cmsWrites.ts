import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export type CmsTable =
  | "store_items"
  | "story_nodes"
  | "training_stats"
  | "game_settings"
  | "characters"
  | "bgm_tracks"
  | "battle_skills"
  | "combat_items"
  | "dragon_pool";

/** Keep each table paired with its insert schema at the dynamic CMS boundary.
 * Required fields and permissions remain validated by Postgres and RLS.
 */
export function insertCmsRow(table: CmsTable, row: Record<string, unknown>) {
  switch (table) {
    case "store_items":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"store_items">)
        .select()
        .single();
    case "story_nodes":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"story_nodes">)
        .select()
        .single();
    case "training_stats":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"training_stats">)
        .select()
        .single();
    case "game_settings":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"game_settings">)
        .select()
        .single();
    case "characters":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"characters">)
        .select()
        .single();
    case "bgm_tracks":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"bgm_tracks">)
        .select()
        .single();
    case "battle_skills":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"battle_skills">)
        .select()
        .single();
    case "combat_items":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"combat_items">)
        .select()
        .single();
    case "dragon_pool":
      return supabase
        .from(table)
        .insert(row as TablesInsert<"dragon_pool">)
        .select()
        .single();
  }
}
