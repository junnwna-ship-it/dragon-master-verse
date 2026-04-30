import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 인벤토리 변경 이벤트 — RPC(claim_quiz_reward, bond_with_dragon)가 성공한 뒤
 * `emitInventoryChanged()` 를 호출하면 화면에 떠 있는 모든 useInventory 구독자가
 * 자동으로 최신값을 다시 불러온다.
 */
export const INVENTORY_CHANGED_EVENT = "user-inventory:changed";

export function emitInventoryChanged(detail?: { itemKey?: string; delta?: number }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INVENTORY_CHANGED_EVENT, { detail }));
}

export type InventoryMap = Record<string, number>;

/**
 * 사용자의 인벤토리(item_key → quantity)를 구독.
 * - 마운트 시 한 번 fetch
 * - INVENTORY_CHANGED_EVENT 발생 시 재조회
 * - 로그인/로그아웃 시 재조회
 */
export function useInventory() {
  const [items, setItems] = useState<InventoryMap>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setItems({});
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("user_inventory")
      .select("item_key, quantity");
    if (error) {
      console.error("[useInventory] fetch:", error);
      setItems({});
    } else {
      const next: InventoryMap = {};
      for (const r of data ?? []) next[r.item_key] = r.quantity;
      setItems(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
    const onChange = () => { void refetch(); };
    window.addEventListener(INVENTORY_CHANGED_EVENT, onChange);
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void refetch(); });
    return () => {
      window.removeEventListener(INVENTORY_CHANGED_EVENT, onChange);
      sub.subscription.unsubscribe();
    };
  }, [refetch]);

  const qty = useCallback((key: string) => items[key] ?? 0, [items]);

  return { items, qty, loading, refetch };
}
