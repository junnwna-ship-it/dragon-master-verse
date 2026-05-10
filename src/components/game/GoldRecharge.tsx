import { useState } from "react";
import { Coins, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getPaddleEnvironment, getPaddlePriceId, initializePaddle } from "@/lib/paddle";

interface Pack {
  priceId: string;
  gold: number;
  price: string;
  badge?: string;
}

const PACKS: Pack[] = [
  { priceId: "gold_pack_small", gold: 1000, price: "$1.99" },
  { priceId: "gold_pack_medium", gold: 5500, price: "$8.99", badge: "+10% 보너스" },
  { priceId: "gold_pack_large", gold: 12000, price: "$17.99", badge: "+20% 보너스" },
];

export function GoldRecharge() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (pack: Pack) => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    setBusy(pack.priceId);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(pack.priceId);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: { email: user.email ?? undefined },
        customData: { userId: user.id },
        settings: {
          displayMode: "overlay",
          theme: "dark",
          successUrl: `${window.location.origin}/app?view=lobby`,
        },
      });
    } catch (e) {
      console.error("[gold-recharge] checkout failed", e);
      toast.error("결제 창을 열 수 없습니다");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-300" />
        <h2 className="text-lg font-bold text-slate-100">골드 충전</h2>
        {getPaddleEnvironment() === "sandbox" && (
          <span className="ml-auto rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300">
            테스트 모드
          </span>
        )}
      </div>
      <div className="space-y-2">
        {PACKS.map((p) => {
          const isBusy = busy === p.priceId;
          return (
            <button
              key={p.priceId}
              type="button"
              onClick={() => buy(p)}
              disabled={!!busy}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 text-left transition hover:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                <Coins className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-100">
                  {p.gold.toLocaleString()} 골드
                </p>
                {p.badge && (
                  <p className="text-[11px] font-semibold text-amber-300">{p.badge}</p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950">
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.price}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500">
        결제가 완료되면 골드가 자동으로 적립됩니다. (몇 초 소요될 수 있습니다)
      </p>
    </section>
  );
}