import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OwnedDragonRow {
  id: string;
  user_id: string;
  dragon_id: string;
  bonus_stat_points: number;
  acquired_at: string;
}

/**
 * Returns the current user's owned-dragon rows. Empty array for guests or
 * brand-new players (Trainee state) — never throws.
 */
export function useOwnedDragons() {
  const { user } = useAuth();
  const [rows, setRows] = useState<OwnedDragonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("owned_dragons")
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      console.error("[owned_dragons] fetch failed:", error);
      setRows([]);
    } else {
      setRows((data ?? []) as OwnedDragonRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);

  return { rows, loading, refetch, isTrainee: rows.length === 0 };
}