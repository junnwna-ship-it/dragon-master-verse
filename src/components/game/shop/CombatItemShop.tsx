import { useState } from "react";
import { Coins, FlaskConical, Loader2, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { buyCombatItem, useCombatItems } from "@/hooks/useCombatItems";
import { useInventory } from "@/hooks/useInventory";
import { useProfile } from "@/hooks/useProfile";

/**
 * Consumables + summon tickets, bought with gold.
 * Prices and visibility are managed in the admin dashboard (`combat_items`).
 */
export function CombatItemShop() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = useCombatItems();
  const { qty, refetch: refetchInventory } = useInventory();
  const { gold, refetch: refetchProfile } = useProfile();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (itemKey: string, name: string, price: number) => {
    if (gold < price) {
      toast.error(t("items.noGold"));
      return;
    }
    setBusy(itemKey);
    try {
      await buyCombatItem(itemKey, 1);
      toast.success(t("items.bought", { name }));
      await Promise.all([refetchInventory(), refetchProfile()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.includes("NOT_ENOUGH_GOLD") ? t("items.noGold") : t("items.buyFailed", { msg }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-emerald-300" />
        <h3 className="text-sm font-bold text-slate-100">{t("items.shopTitle")}</h3>
      </div>
      <p className="text-[11px] text-slate-400">{t("items.shopDesc")}</p>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      <div className="space-y-1.5">
        {items
          .filter((i) => i.price_gold > 0)
          .map((it) => {
            const isTicket = it.effect_type === "summon_ticket";
            return (
              <div
                key={it.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                  isTicket ? "border-sky-500/40 bg-sky-500/5" : "border-slate-700/60 bg-slate-900/60"
                }`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-100">
                    {isTicket && <Ticket className="h-3.5 w-3.5 text-sky-300" />}
                    {it.name}
                    <span className="text-[10px] font-normal text-slate-500">x{qty(it.item_key)}</span>
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{it.description}</p>
                </div>
                <button
                  onClick={() => buy(it.item_key, it.name, it.price_gold)}
                  disabled={busy != null}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-40"
                >
                  {busy === it.item_key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Coins className="h-3.5 w-3.5" /> {it.price_gold.toLocaleString()}
                    </>
                  )}
                </button>
              </div>
            );
          })}
      </div>
    </section>
  );
}
