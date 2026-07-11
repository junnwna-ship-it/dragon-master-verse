import { useEffect, useMemo, useRef, useState } from "react";
import {
  Swords,
  Sword,
  Trophy,
  Skull,
  Minus,
  Loader2,
  Shield,
  Heart,
  Droplet,
  Crown,
  Search,
  TrendingUp,
  TrendingDown,
  Library,
  ChevronRight,
} from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { useTranslation } from "react-i18next";
import { TagBattleEngine } from "../battle/TagBattleEngine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * 3:3 Tag-Team PvP arena.
 *  - Player must have a 3-dragon `selectedDeck` (편성은 Vault에서) — 부족하면 진입 불가.
 *  - 매칭 시 GHOST 트레이너 1명 + 그 트레이너의 3-dragon 덱 생성.
 *  - TagBattleEngine이 필드/벤치/교체/벤치 MP 회복/사망 자동 출전/3마리 전멸 판정 처리.
 */

const RP_KEY = "pvp.rp";
const RP_INITIAL = 1000;
const RP_WIN_DELTA = 25;
const RP_LOSS_DELTA = -15;
const MATCH_SEARCH_MS = 2000;

function loadRp(): number {
  if (typeof window === "undefined") return RP_INITIAL;
  const raw = window.localStorage.getItem(RP_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && raw !== null ? n : RP_INITIAL;
}

// Ghost trainer pool (handle + RP). 적 덱은 GHOST_DRAGONS에서 3마리 추첨.
interface GhostTrainer {
  trainer: string;
  rp: number;
}
const GHOST_TRAINERS: GhostTrainer[] = [
  { trainer: "@vortex_kr", rp: 1024 },
  { trainer: "@mossguard", rp: 988 },
  { trainer: "@cinder99", rp: 1041 },
  { trainer: "@ironscale", rp: 1012 },
];

const GHOST_DRAGONS: Dragon[] = [
  { id: 201, name: "Vortex", element: "Water", hp: 1160, maxHp: 1160, mp: 1480, atk: 1730, def: 630 },
  { id: 202, name: "Mossguard", element: "Wood", hp: 1665, maxHp: 1665, mp: 1000, atk: 1110, def: 1225 },
  { id: 203, name: "Cinder", element: "Fire", hp: 1340, maxHp: 1340, mp: 1340, atk: 1695, def: 625 },
  { id: 204, name: "Ironscale", element: "Earth", hp: 1665, maxHp: 1665, mp: 835, atk: 1210, def: 1290 },
  { id: 205, name: "Glimmer", element: "Light", hp: 1320, maxHp: 1320, mp: 1240, atk: 1340, def: 1100 },
  { id: 206, name: "Nyxshade", element: "Dark", hp: 980, maxHp: 980, mp: 540, atk: 2280, def: 1200 },
];

function pickEnemyDeck(): { trainer: GhostTrainer; deck: Dragon[] } {
  const trainer = GHOST_TRAINERS[Math.floor(Math.random() * GHOST_TRAINERS.length)];
  const pool = [...GHOST_DRAGONS];
  const deck: Dragon[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    deck.push(pool.splice(idx, 1)[0]);
  }
  return { trainer, deck };
}

type Phase = "idle" | "searching" | "battle" | "result";

export function PvpView() {
  const { t } = useTranslation();
  const dragons = useGameStore((s) => s.dragons);
  const recordPvp = useGameStore((s) => s.recordPvp);
  const pvpRecords = useGameStore((s) => s.pvpRecords);
  const pvpWins = useGameStore((s) => s.pvpWins);
  const pvpLosses = useGameStore((s) => s.pvpLosses);
  const pvpDraws = useGameStore((s) => s.pvpDraws);
  const selectedDeck = useGameStore((s) => s.selectedDeck);
  const enemyDeckIds = useGameStore((s) => s.enemyDeck);
  const setEnemyDeckStore = useGameStore((s) => s.setEnemyDeck);
  const setView = useGameStore((s) => s.setView);

  const playerDeck = useMemo(
    () => selectedDeck.map((id) => dragons.find((d) => d.id === id)).filter((d): d is Dragon => !!d),
    [selectedDeck, dragons],
  );
  const enemyDeck = useMemo(
    () =>
      enemyDeckIds
        .map((id) => GHOST_DRAGONS.find((d) => d.id === id))
        .filter((d): d is Dragon => !!d),
    [enemyDeckIds],
  );

  const deckReady = playerDeck.length === 3;

  const [rp, setRp] = useState<number>(() => loadRp());
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RP_KEY, String(rp));
  }, [rp]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [matchedTrainer, setMatchedTrainer] = useState<GhostTrainer | null>(null);
  const [lastResult, setLastResult] = useState<{
    outcome: "win" | "lose" | "draw";
    delta: number;
    rpBefore: number;
    rpAfter: number;
    trainer: string;
  } | null>(null);

  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMatchmaking = () => {
    if (!deckReady) return;
    if (matchTimerRef.current !== null) return;
    if (phase === "searching") return;
    setPhase("searching");
    matchTimerRef.current = setTimeout(() => {
      const { trainer, deck } = pickEnemyDeck();
      setMatchedTrainer(trainer);
      setEnemyDeckStore(deck.map((d) => d.id));
      setPhase("battle");
      matchTimerRef.current = null;
    }, MATCH_SEARCH_MS);
  };

  const cancelMatchmaking = () => {
    if (matchTimerRef.current !== null) {
      clearTimeout(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    setPhase("idle");
  };

  useEffect(() => {
    return () => {
      if (matchTimerRef.current !== null) clearTimeout(matchTimerRef.current);
    };
  }, []);

  const tier = useMemo(() => {
    if (rp >= 1500) return { rank: 5, label: "Diamond", tone: "text-sky-300 border-sky-400/40 bg-sky-500/10" };
    if (rp >= 1200) return { rank: 4, label: "Platinum", tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" };
    if (rp >= 1000) return { rank: 3, label: "Gold", tone: "text-amber-300 border-amber-400/40 bg-amber-500/10" };
    if (rp >= 800) return { rank: 2, label: "Silver", tone: "text-slate-200 border-slate-400/40 bg-slate-400/10" };
    return { rank: 1, label: "Bronze", tone: "text-orange-300 border-orange-400/40 bg-orange-500/10" };
  }, [rp]);

  // ---------------- Battle ----------------
  if (phase === "battle" && deckReady && enemyDeck.length === 3 && matchedTrainer) {
    return (
      <TagBattleEngine
        playerDeck={playerDeck}
        enemyDeck={enemyDeck}
        context="pvp"
        autoExitMs={1500}
        onResolved={(outcome) => {
          recordPvp({
            playerName: playerDeck[0].name,
            enemyName: matchedTrainer.trainer,
            outcome,
          });
          // Cloud reward — atomic gold/exp via SECURITY DEFINER RPC.
          // Win: +100G, +50exp · Lose: +20G · Draw: +30G, +10exp
          const lead = playerDeck[0];
          (async () => {
            const { data, error } = await supabase.rpc("award_battle_reward", {
              _outcome: outcome,
              _dragon_uuid: lead.uuid as string,
            });
            if (error) {
              console.error("[pvp] award failed:", error);
              toast.error(t("pvp.rewardFailed", { msg: error.message }));
              return;
            }
            const r = (data ?? {}) as { gold_delta?: number; exp_delta?: number };
            const goldText = r.gold_delta ? `+${r.gold_delta}G` : "";
            const expText = r.exp_delta ? ` · +${r.exp_delta} exp` : "";
            if (goldText) toast.success(t("pvp.rewardSuccess", { gold: goldText, exp: expText }));
          })();
          const delta =
            outcome === "win" ? RP_WIN_DELTA : outcome === "lose" ? RP_LOSS_DELTA : 0;
          const before = rp;
          const after = Math.max(0, before + delta);
          setRp(after);
          setLastResult({
            outcome,
            delta,
            rpBefore: before,
            rpAfter: after,
            trainer: matchedTrainer.trainer,
          });
        }}
        onExit={() => {
          setPhase(lastResult ? "result" : "idle");
        }}
      />
    );
  }

  // ---------------- Result ----------------
  if (phase === "result" && lastResult) {
    const r = lastResult;
    const tone =
      r.outcome === "win"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
        : r.outcome === "lose"
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
          : "border-slate-500/40 bg-slate-500/10 text-slate-200";
    const Icon = r.outcome === "win" ? Trophy : r.outcome === "lose" ? Skull : Minus;
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl border p-6 text-center ${tone}`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/40">
            <Icon className="h-8 w-8" />
          </div>
          <h3 className="mt-3 text-xl font-bold">
            {r.outcome === "win" ? t("pvp.winLabel") : r.outcome === "lose" ? t("pvp.loseLabel") : t("pvp.drawLabel")}
          </h3>
          <p className="mt-1 text-xs opacity-80">vs {r.trainer}</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <span className="font-mono text-slate-300">{r.rpBefore} RP</span>
            <ChevronRight className="h-4 w-4 opacity-60" />
            <span className="font-mono font-bold">{r.rpAfter} RP</span>
            <span
              className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-bold ${
                r.delta > 0
                  ? "bg-emerald-500/20 text-emerald-300"
                  : r.delta < 0
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-slate-500/20 text-slate-300"
              }`}
            >
              {r.delta > 0 ? <TrendingUp className="h-3 w-3" /> : r.delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              {r.delta > 0 ? `+${r.delta}` : r.delta}
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            setLastResult(null);
            setMatchedTrainer(null);
            setEnemyDeckStore([]);
            setPhase("idle");
          }}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          {t("common.confirm")}
        </button>
        <button
          onClick={() => {
            setLastResult(null);
            startMatchmaking();
          }}
          disabled={!deckReady}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600"
        >
          {t("pvp.rematch")}
        </button>
      </div>
    );
  }

  // ---------------- Idle / Searching ----------------
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-rose-400" />
        <h2 className="text-xl font-bold text-slate-100">{t("pvp.title")}</h2>
      </div>

      <div className={`rounded-2xl border p-4 ${tier.tone}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-70">{t("pvp.rank")}</p>
              <p className="text-sm font-bold">{tier.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest opacity-70">{t("pvp.rankScore")}</p>
            <p className="text-2xl font-bold tabular-nums">
              {rp} <span className="text-xs opacity-70">RP</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
          <p className="text-[10px] uppercase text-emerald-400">{t("pvp.win")}</p>
          <p className="text-lg font-bold text-emerald-300">{pvpWins}</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center">
          <p className="text-[10px] uppercase text-rose-400">{t("pvp.lose")}</p>
          <p className="text-lg font-bold text-rose-300">{pvpLosses}</p>
        </div>
        <div className="rounded-xl border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-center">
          <p className="text-[10px] uppercase text-slate-400">{t("pvp.draw")}</p>
          <p className="text-lg font-bold text-slate-300">{pvpDraws}</p>
        </div>
      </div>

      {/* 출전 덱 요약 */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t("pvp.deckLabel", { count: playerDeck.length })}
          </p>
          <button
            onClick={() => setView("vault")}
            className="flex items-center gap-1 text-[10px] text-amber-300 underline-offset-2 hover:underline"
          >
            <Library className="h-3 w-3" /> {t("pvp.vaultEdit")}
          </button>
        </div>
        <div className="-mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[0, 1, 2].map((i) => {
            const d = playerDeck[i];
            return d ? <DeckDragonCard key={d.id} dragon={d} /> : <EmptyDeckSlot key={i} index={i} />;
          })}
        </div>
      </div>

      {/* 매칭 */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center">
        {phase === "searching" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
            <p className="text-sm font-bold text-slate-100">{t("pvp.searching")}</p>
            <p className="text-[11px] text-slate-400">
              {t("pvp.searchingDesc")}
            </p>
            <button
              onClick={cancelMatchmaking}
              className="mt-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
              <Shield className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-400">
              {t("pvp.winLossInfo", { win: RP_WIN_DELTA, lose: RP_LOSS_DELTA })}
            </p>
            <button
              onClick={startMatchmaking}
              disabled={!deckReady}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
            >
              <Search className="h-4 w-4" /> {t("pvp.enterArena")}
            </button>
            {!deckReady && (
              <p className="text-[10px] text-amber-300/90">
                {t("pvp.needDeckHint")}
              </p>
            )}
          </div>
        )}
      </div>

      {pvpRecords.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t("pvp.recentTitle")}</p>
          <div className="space-y-1.5">
            {pvpRecords.slice(0, 5).map((r) => {
              const Icon = r.outcome === "win" ? Trophy : r.outcome === "lose" ? Skull : Minus;
              const tone =
                r.outcome === "win"
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                  : r.outcome === "lose"
                    ? "text-rose-400 border-rose-500/30 bg-rose-500/5"
                    : "text-slate-400 border-slate-500/30 bg-slate-500/5";
              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${tone}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-semibold text-slate-200">
                      {r.playerName} vs {r.enemyName}
                    </span>
                  </span>
                  <span className="font-bold uppercase">
                    {r.outcome === "win" ? t("pvp.shortWin") : r.outcome === "lose" ? t("pvp.shortLose") : t("pvp.shortDraw")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DeckDragonCard({ dragon }: { dragon: Dragon }) {
  const maxStat = Math.max(dragon.maxHp, dragon.mp, dragon.atk, dragon.def, 1);
  const bars = [
    { label: "ATK", value: dragon.atk, icon: Sword, color: "bg-rose-500" },
    { label: "DEF", value: dragon.def, icon: Shield, color: "bg-amber-500" },
    { label: "HP", value: dragon.maxHp, icon: Heart, color: "bg-emerald-500" },
    { label: "MP", value: dragon.mp, icon: Droplet, color: "bg-sky-500" },
  ];
  return (
    <div className="w-40 shrink-0 snap-start rounded-2xl border border-slate-700/60 bg-slate-900/60 p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="truncate text-xs font-bold text-slate-100">{dragon.name}</span>
        <span className="shrink-0 rounded-full border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-300">
          {dragon.element}
        </span>
      </div>
      <div className="mb-2 flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-700 text-center text-xs font-bold text-slate-300">
        {dragon.name}
      </div>
      <div className="space-y-1.5">
        {bars.map(({ label, value, icon: Icon, color }) => (
          <div key={label}>
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="flex items-center gap-1">
                <Icon className="h-2.5 w-2.5" /> {label}
              </span>
              <span className="font-mono text-slate-200">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
              <div className={`h-full ${color}`} style={{ width: `${Math.min(100, (value / maxStat) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyDeckSlot({ index }: { index: number }) {
  return (
    <div className="flex w-40 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600/60 bg-slate-900/40 p-2.5 text-slate-500">
      <span className="text-lg font-bold">{index + 1}</span>
      <span className="text-[9px] uppercase tracking-wider">Empty</span>
    </div>
  );
}