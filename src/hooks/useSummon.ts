import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { emitInventoryChanged } from "./useInventory";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface PoolEntry {
  id: string;
  dragon_id: string;
  rarity: Rarity;
  weight: number;
  shard_cost: number;
  dragon: { id: string; name: string; element: string; image_url: string | null } | null;
}

export interface SummonResult {
  dragon_id: string;
  name: string;
  rarity: Rarity;
  duplicate: boolean;
  shards: number;
}

export interface SummonResponse {
  ok: boolean;
  results: SummonResult[];
  gold: number;
  shards: number;
}

export const SUMMON_GOLD_SINGLE = 500;
export const SUMMON_GOLD_TEN = 4500;

/** Active summon pool joined with the dragon it grants. */
export function useSummonPool() {
  return useQuery({
    queryKey: ["summon_pool"],
    queryFn: async (): Promise<PoolEntry[]> => {
      const { data, error } = await supabase
        .from("dragon_pool")
        .select("id, dragon_id, rarity, weight, shard_cost, dragon:dragons(id, name, element, image_url)")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as unknown as PoolEntry[];
    },
  });
}

/** Rate table (percentages) derived from the live pool weights. */
export function rarityRates(pool: PoolEntry[]): { rarity: Rarity; pct: number }[] {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  if (!total) return [];
  const order: Rarity[] = ["legendary", "epic", "rare", "common"];
  return order
    .map((rarity) => {
      const w = pool.filter((p) => p.rarity === rarity).reduce((s, p) => s + p.weight, 0);
      return { rarity, pct: Math.round((w / total) * 1000) / 10 };
    })
    .filter((r) => r.pct > 0);
}

export async function summonDragons(count: 1 | 10, pay: "gold" | "ticket"): Promise<SummonResponse> {
  const { data, error } = await supabase.rpc("summon_dragon", { _count: count, _pay: pay });
  if (error) throw error;
  emitInventoryChanged();
  return data as unknown as SummonResponse;
}

export async function exchangeShards(dragonUuid: string) {
  const { data, error } = await supabase.rpc("exchange_shards", { _dragon_uuid: dragonUuid });
  if (error) throw error;
  emitInventoryChanged({ itemKey: "dragon_shard" });
  return data as unknown as { ok: boolean; shards: number; cost: number };
}

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; text: string; glow: string }> = {
  common: {
    label: "Common",
    ring: "border-slate-600/70",
    text: "text-slate-300",
    glow: "shadow-none",
  },
  rare: {
    label: "Rare",
    ring: "border-sky-500/60",
    text: "text-sky-300",
    glow: "shadow-[0_0_24px_-6px_rgba(56,189,248,0.7)]",
  },
  epic: {
    label: "Epic",
    ring: "border-violet-500/60",
    text: "text-violet-300",
    glow: "shadow-[0_0_28px_-6px_rgba(167,139,250,0.8)]",
  },
  legendary: {
    label: "Legendary",
    ring: "border-amber-400/70",
    text: "text-amber-300",
    glow: "shadow-[0_0_34px_-4px_rgba(251,191,36,0.85)]",
  },
};
