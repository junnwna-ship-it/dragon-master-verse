import { useMemo, useState } from "react";
import { Coins, Gem, Loader2, Sparkles, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "@/store/dragons";
import { useProfile } from "@/hooks/useProfile";
import { useInventory } from "@/hooks/useInventory";
import {
  RARITY_STYLE,
  SUMMON_GOLD_SINGLE,
  SUMMON_GOLD_TEN,
  exchangeShards,
  rarityRates,
  summonDragons,
  useSummonPool,
  type SummonResult,
} from "@/hooks/useSummon";

/**
 * Summoning Altar — gold/ticket gacha.
 * Every draw, cost check and duplicate→shard conversion happens server side in
 * the `summon_dragon` RPC; this screen only presents the returned results.
 */
export function SummonView() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: pool = [], isLoading } = useSummonPool();
  const { gold, refetch: refetchProfile } = useProfile();
  const { qty, refetch: refetchInventory } = useInventory();
  const fetchDragons = useGameStore((s) => s.fetchDragons);

  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<SummonResult[] | null>(null);
  const [revealed, setRevealed] = useState(0);

  const rates = useMemo(() => rarityRates(pool), [pool]);
  const tickets = qty("summon_ticket");
  const shards = qty("dragon_shard");

  const afterChange = async () => {
    await Promise.all([fetchDragons(), refetchProfile(), refetchInventory()]);
    void qc.invalidateQueries({ queryKey: ["owned-growth"] });
  };

  const draw = async (count: 1 | 10, pay: "gold" | "ticket") => {
    setBusy(`${pay}-${count}`);
    try {
      const res = await summonDragons(count, pay);
      setResults(res.results);
      setRevealed(0);
      for (let i = 1; i <= res.results.length; i++) {
        setTimeout(() => setRevealed(i), i * 260);
      }
      await afterChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("NOT_ENOUGH_GOLD")
          ? t("summon.errNoGold")
          : msg.includes("NOT_ENOUGH_TICKETS")
            ? t("summon.errNoTicket")
            : msg.includes("EMPTY_POOL")
              ? t("summon.errEmptyPool")
              : t("summon.errFailed", { msg }),
      );
    } finally {
      setBusy(null);
    }
  };

  const exchange = async (dragonId: string, cost: number, name: string) => {
    if (shards < cost) {
      toast.error(t("summon.errNoShards", { need: cost }));
      return;
    }
    setBusy(`ex-${dragonId}`);
    try {
      await exchangeShards(dragonId);
      toast.success(t("summon.exchangeDone", { name }));
      await afterChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("ALREADY_OWNED")
          ? t("summon.errOwned")
          : msg.includes("NOT_ENOUGH_SHARDS")
            ? t("summon.errNoShards", { need: cost })
            : t("summon.errFailed", { msg }),
      );
    } finally {
      setBusy(null);
    }
  };

  const ownedNames = new Set(useGameStore.getState().dragons.map((d) => d.uuid));

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300/80">{t("summon.kicker")}</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-100">
          <Sparkles className="h-5 w-5 text-violet-300" /> {t("summon.title")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{t("summon.subtitle")}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-amber-300">
            <Coins className="h-3.5 w-3.5" /> {(gold ?? 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-sky-300">
            <Ticket className="h-3.5 w-3.5" /> {tickets}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-fuchsia-300">
            <Gem className="h-3.5 w-3.5" /> {shards}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2">
        <button
          onClick={() => draw(1, "gold")}
          disabled={busy != null}
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-4 text-sm font-bold text-amber-200 transition hover:bg-amber-500/20 active:scale-95 disabled:opacity-50"
        >
          {busy === "gold-1" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("summon.single", { cost: SUMMON_GOLD_SINGLE.toLocaleString() })}
        </button>
        <button
          onClick={() => draw(10, "gold")}
          disabled={busy != null}
          className="rounded-2xl border border-violet-500/50 bg-violet-500/15 px-3 py-4 text-sm font-bold text-violet-200 transition hover:bg-violet-500/25 active:scale-95 disabled:opacity-50"
        >
          {busy === "gold-10" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("summon.ten", { cost: SUMMON_GOLD_TEN.toLocaleString() })}
        </button>
        <button
          onClick={() => draw(1, "ticket")}
          disabled={busy != null || tickets < 1}
          className="rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-3 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 active:scale-95 disabled:opacity-40"
        >
          {t("summon.singleTicket")}
        </button>
        <button
          onClick={() => draw(10, "ticket")}
          disabled={busy != null || tickets < 10}
          className="rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-3 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 active:scale-95 disabled:opacity-40"
        >
          {t("summon.tenTicket")}
        </button>
      </section>

      <p className="text-center text-[11px] text-violet-300/80">{t("summon.guarantee")}</p>

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
        <h3 className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">{t("summon.rates")}</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
          {rates.map((r) => (
            <span key={r.rarity} className={`rounded-full border px-2.5 py-1 font-semibold ${RARITY_STYLE[r.rarity].ring} ${RARITY_STYLE[r.rarity].text}`}>
              {RARITY_STYLE[r.rarity].label} {r.pct}%
            </span>
          ))}
        </div>
      </section>

      {results && (
        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3">
          <h3 className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">{t("summon.resultsTitle")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {results.map((r, i) => {
              const style = RARITY_STYLE[r.rarity];
              const shown = i < revealed;
              return (
                <div
                  key={`${r.dragon_id}-${i}`}
                  className={`rounded-xl border p-2.5 transition-all duration-300 ${
                    shown ? `${style.ring} ${style.glow} bg-slate-900/80 opacity-100` : "border-slate-800 bg-slate-900/40 opacity-40"
                  }`}
                >
                  {shown ? (
                    <>
                      <p className={`text-sm font-bold ${style.text}`}>{r.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">{style.label}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {r.duplicate ? t("summon.duplicate", { n: r.shards }) : t("summon.brandNew")}
                      </p>
                    </>
                  ) : (
                    <p className="py-3 text-center text-slate-600">???</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-fuchsia-200">
          <Gem className="h-4 w-4" /> {t("summon.exchangeTitle")}
        </h3>
        <p className="mb-2 text-[11px] text-slate-400">{t("summon.exchangeDesc")}</p>
        <div className="space-y-1.5">
          {pool.map((p) => {
            const style = RARITY_STYLE[p.rarity];
            const owned = ownedNames.has(p.dragon_id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${style.text}`}>{p.dragon?.name ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    {style.label} · {t("summon.shardCost", { n: p.shard_cost })}
                  </p>
                </div>
                <button
                  onClick={() => exchange(p.dragon_id, p.shard_cost, p.dragon?.name ?? "")}
                  disabled={busy != null || owned || shards < p.shard_cost}
                  className="shrink-0 rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/15 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/25 disabled:opacity-40"
                >
                  {owned ? t("summon.owned") : busy === `ex-${p.dragon_id}` ? "…" : t("summon.exchange")}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
