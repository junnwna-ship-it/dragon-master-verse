import { useState } from "react";
import { FlaskConical, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useBattleItems, consumeBattleItem } from "@/hooks/useCombatItems";
import { useInventory } from "@/hooks/useInventory";
import type { ResolvedItemEffect } from "@/lib/battleItems";

/**
 * Battle item button + picker sheet.
 * The parent battle engine receives the server-resolved effect and applies it.
 */
export function BattleItemPanel({
  disabled,
  usesLeft,
  onUsed,
}: {
  disabled: boolean;
  usesLeft: number;
  onUsed: (effect: ResolvedItemEffect) => void;
}) {
  const { t } = useTranslation();
  const { data: items } = useBattleItems();
  const { qty, refetch } = useInventory();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const use = async (itemKey: string, name: string, owned: number) => {
    if (owned < 1) {
      toast.error(t("items.outOfStock", { name }));
      return;
    }
    if (usesLeft <= 0) {
      toast.error(t("items.noUsesLeft"));
      return;
    }
    setBusy(itemKey);
    try {
      const effect = await consumeBattleItem(itemKey);
      onUsed(effect);
      setOpen(false);
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.includes("OUT_OF_STOCK") ? t("items.outOfStock", { name }) : t("items.useFailed", { msg }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600/90 px-4 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
      >
        <FlaskConical className="h-5 w-5" /> {t("items.button", { n: usesLeft })}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="max-h-[70vh] w-full overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">{t("items.sheetTitle")}</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] text-slate-400">{t("items.sheetHint", { n: usesLeft })}</p>
            <div className="space-y-2">
              {items.map((it) => {
                const owned = qty(it.item_key);
                return (
                  <button
                    key={it.id}
                    onClick={() => use(it.item_key, it.name, owned)}
                    disabled={owned < 1 || busy != null || usesLeft <= 0}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-800/60 px-3 py-2.5 text-left transition hover:bg-slate-800 disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-100">{it.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{it.description}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-emerald-300">
                      {busy === it.item_key ? <Loader2 className="h-4 w-4 animate-spin" /> : `x${owned}`}
                    </span>
                  </button>
                );
              })}
              {items.length === 0 && <p className="text-xs text-slate-500">{t("items.empty")}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
