import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppSettings {
  isShopOpen: boolean;
  isTrainingOpen: boolean;
}

const DEFAULTS: AppSettings = { isShopOpen: false, isTrainingOpen: false };

/**
 * Reads the global feature flags from `app_settings`, with realtime updates so
 * an admin toggle anywhere reflects on every connected client immediately.
 */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error) {
      console.error("[app_settings] fetch failed:", error);
      setLoading(false);
      return;
    }
    const next: AppSettings = { ...DEFAULTS };
    for (const row of data ?? []) {
      if (row.key === "isShopOpen") next.isShopOpen = row.value === true;
      if (row.key === "isTrainingOpen") next.isTrainingOpen = row.value === true;
    }
    setSettings(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`app-settings-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "app_settings" },
          () => {
            fetchSettings();
          },
        )
        .subscribe();
    } catch (e) {
      console.error("[app_settings] realtime subscribe failed:", e);
    }
    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.error("[app_settings] removeChannel failed:", e);
        }
      }
    };
  }, [fetchSettings]);

  const setFlag = useCallback(
    async (key: keyof AppSettings, value: boolean) => {
      // Optimistic update for instant feedback
      setSettings((s) => ({ ...s, [key]: value }));
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) {
        console.error("[app_settings] update failed:", error);
        toast.error(i18n.t("errors.settingsChangeFailed", { msg: error.message }));
        // Revert
        setSettings((s) => ({ ...s, [key]: !value }));
        throw error;
      }
      toast.success(`${key} = ${value ? "ON" : "OFF"}`);
    },
    [],
  );

  return { settings, loading, setFlag };
}
