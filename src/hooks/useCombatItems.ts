import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { emitInventoryChanged } from "./useInventory";
import type { ResolvedItemEffect } from "@/lib/battleItems";

export type CombatItem = Tables<"combat_items">;

/** All published combat items, ordered as configured in the admin dashboard. */
export function useCombatItems() {
  return useQuery({
    queryKey: ["combat_items", "published"],
    queryFn: async (): Promise<CombatItem[]> => {
      const { data, error } = await supabase
        .from("combat_items")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Items usable inside a battle (everything except the summon ticket). */
export function useBattleItems() {
  const q = useCombatItems();
  return {
    ...q,
    data: (q.data ?? []).filter((i) => i.effect_type !== "summon_ticket"),
  };
}

/**
 * Spends one item server-side and returns the resolved effect.
 * The server validates ownership/quantity and rolls the random effect.
 */
export async function consumeBattleItem(itemKey: string): Promise<ResolvedItemEffect> {
  const { data, error } = await supabase.rpc("consume_battle_item", { _item_key: itemKey });
  if (error) throw error;
  emitInventoryChanged({ itemKey, delta: -1 });
  return data as unknown as ResolvedItemEffect;
}

/** Buys `quantity` copies of an item with gold. */
export async function buyCombatItem(itemKey: string, quantity = 1) {
  const { data, error } = await supabase.rpc("buy_combat_item", {
    _item_key: itemKey,
    _quantity: quantity,
  });
  if (error) throw error;
  emitInventoryChanged({ itemKey, delta: quantity });
  return data as unknown as { ok: boolean; quantity: number; remaining_gold: number; cost: number };
}
