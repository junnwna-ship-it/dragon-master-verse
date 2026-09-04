import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ownedGrowthKey } from "@/hooks/useOwnedGrowth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { emitInventoryChanged } from "./useInventory";

/** Reward payload authored on a story node (`story_nodes.rewards`). */
export interface StoryReward {
  gold?: number;
  stat_points?: number;
  items?: Record<string, number>;
}

export function hasReward(r: StoryReward | null | undefined): boolean {
  if (!r) return false;
  return (
    (r.gold ?? 0) > 0 ||
    (r.stat_points ?? 0) > 0 ||
    Object.values(r.items ?? {}).some((v) => Number(v) > 0)
  );
}

/** Coerce raw jsonb into a safe reward object. */
export function parseReward(raw: unknown): StoryReward | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const items: Record<string, number> = {};
  if (o.items && typeof o.items === "object" && !Array.isArray(o.items)) {
    for (const [k, v] of Object.entries(o.items as Record<string, unknown>)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) items[k] = Math.floor(n);
    }
  }
  const out: StoryReward = {
    gold: Math.max(Number(o.gold) || 0, 0),
    stat_points: Math.max(Number(o.stat_points) || 0, 0),
    items,
  };
  return hasReward(out) ? out : null;
}

const ITEM_LABELS: Record<string, string> = {
  bonding_token: "교감의 증표",
  exp_potion: "경험치 물약",
  forget_potion: "망각의 물약",
};

export function itemLabel(key: string) {
  return ITEM_LABELS[key] ?? key;
}

/**
 * Grants a story node's rewards through the `claim_story_reward` RPC.
 * The database enforces one claim per (user, chapter, node), so replaying a
 * chapter never farms the same reward twice.
 */
export function useStoryRewards() {
  const inFlight = useRef(new Set<string>());
  const queryClient = useQueryClient();

  const claim = useCallback(
    async (chapterId: string, nodeKey: string, dragonUuid?: string | null) => {
      const tag = `${chapterId}::${nodeKey}`;
      if (inFlight.current.has(tag)) return null;
      inFlight.current.add(tag);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return null;

        const { data, error } = await supabase.rpc("claim_story_reward", {
          _chapter_id: chapterId,
          _node_key: nodeKey,
          ...(dragonUuid ? { _dragon_uuid: dragonUuid } : {}),
        });
        if (error) {
          console.error("[useStoryRewards]", error.message);
          return null;
        }

        const res = (data ?? {}) as {
          granted?: boolean;
          gold?: number;
          stat_points?: number;
          items?: Record<string, number>;
        };
        if (!res.granted) return res;

        const parts: string[] = [];
        if ((res.gold ?? 0) > 0) parts.push(`${res.gold}G`);
        if ((res.stat_points ?? 0) > 0) parts.push(`능력 포인트 +${res.stat_points}`);
        for (const [k, v] of Object.entries(res.items ?? {})) {
          if (Number(v) > 0) parts.push(`${itemLabel(k)} x${v}`);
        }
        if (parts.length) {
          toast.success(`보상 획득: ${parts.join(" · ")}`);
          emitInventoryChanged();
        }
        // Stat points land on the player's own `owned_dragons` row — refresh
        // the growth cache so training/detail screens show them right away.
        void queryClient.invalidateQueries({ queryKey: ownedGrowthKey(auth.user.id) });
        return res;
      } finally {
        inFlight.current.delete(tag);
      }
    },
    [],
  );

  return { claim };
}
