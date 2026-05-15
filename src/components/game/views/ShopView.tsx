import { useState } from "react";
import { Lock, ShoppingBag, Sparkles, RotateCcw, Coins, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useGameStore } from "@/store/dragons";
import { useProfile } from "@/hooks/useProfile";
import { useAppSettings } from "@/hooks/useAppSettings";
import { DragonImage } from "../DragonImage";
import { GoldRecharge } from "../GoldRecharge";
import { PaymentHistory } from "../PaymentHistory";

/**
 * Shop view — gated by the `isShopOpen` feature flag.
 * - When closed: full-surface backdrop-blur overlay + lock icon + announcement.
 * - When open: 2 consumables (exp potion, forget potion) wired to the
 *   `purchase_shop_item` RPC. The user must select one of their dragons as
 *   the target before buying.
 */

interface ShopItem {
  key: "exp_potion" | "forget_potion";
  name: string;
  cost: number;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ITEMS: ShopItem[] = [
  {
    key: "exp_potion",
    name: "경험치 물약",
    cost: 500,
    desc: "선택한 드래곤의 경험치를 +100 올립니다.",
    icon: Sparkles,
  },
  {
    key: "forget_potion",
    name: "망각의 물약",
    cost: 1000,
    desc: "선택한 드래곤의 미사용 스탯 포인트를 모두 초기화합니다.",
    icon: RotateCcw,
  },
];

export function ShopView() {
  const dragons = useGameStore((s) => s.dragons);
  const refetchDragons = useGameStore((s) => s.fetchDragons);
  const { gold } = useProfile();
  const { settings, loading } = useAppSettings();
  const [targetUuid, setTargetUuid] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const buy = async (item: ShopItem) => {
    if (!targetUuid) {
      toast.error("대상 드래곤을 먼저 선택하세요");
      return;
    }
    if (gold < item.cost) {
      toast.error("골드가 부족합니다");
      return;
    }
    setBusyKey(item.key);
    const { data, error } = await supabase.rpc("purchase_shop_item", {
      _item_key: item.key,
      _dragon_uuid: targetUuid,
    });
    setBusyKey(null);
    if (error) {
      console.error("[shop] purchase failed:", error);
      toast.error(`구매 실패: ${error.message}`);
      return;
    }
    toast.success(`${item.name} 구매 완료!`);
    void refetchDragons();
    void data;
  };

  // Pre-render the actual content; we'll overlay the lock when closed.
  const targetDragons = dragons.filter((d) => d.uuid);

  return (
    <div className="relative">
      <div className="mb-6">
        <GoldRecharge />
      </div>
      <div className="mb-6">
        <PaymentHistory />
      </div>
      <div className={settings.isShopOpen ? "" : "pointer-events-none select-none"}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-amber-300" />
              <h2 className="text-xl font-bold text-slate-100">Shop</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
              <Coins className="h-3.5 w-3.5" /> {gold.toLocaleString()}
            </div>
          </div>

          {/* Target dragon picker */}
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              대상 드래곤 선택
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {targetDragons.length === 0 && (
                <p className="text-xs text-slate-500">드래곤이 없습니다.</p>
              )}
              {targetDragons.map((d) => {
                const active = targetUuid === d.uuid;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setTargetUuid(d.uuid!)}
                    className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-2 transition ${
                      active
                        ? "border-amber-400 bg-amber-500/15"
                        : "border-slate-700 bg-slate-800/40 hover:border-slate-500"
                    }`}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-900">
                      <DragonImage dragon={d} className="h-full w-full" />
                    </div>
                    <span className="line-clamp-1 text-[10px] font-semibold text-slate-200">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Items */}
          <section className="space-y-2">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const tooBroke = gold < item.cost;
              const busy = busyKey === item.key;
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-100">{item.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(item)}
                    disabled={busy || !targetUuid || tooBroke}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                    {item.cost.toLocaleString()}
                  </button>
                </div>
              );
            })}
          </section>
        </div>
      </div>

      {/* Locked overlay */}
      {!loading && !settings.isShopOpen && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/60 backdrop-blur-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 ring-1 ring-amber-500/40">
            <Lock className="h-8 w-8 text-amber-300" />
          </div>
          <p className="mt-4 px-6 text-base font-bold text-slate-100">
            🔒 새로운 상점이 곧 오픈됩니다!
          </p>
          <p className="mt-1 px-6 text-xs text-slate-400">
            골드를 모아두세요.
          </p>
        </div>
      )}
    </div>
  );
}
