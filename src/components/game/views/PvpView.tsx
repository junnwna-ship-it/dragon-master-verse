import { useEffect, useMemo, useRef, useState } from "react";
import {
  Swords,
  ChevronRight,
  Trophy,
  Skull,
  Minus,
  Loader2,
  Shield,
  Crown,
  Search,
  TrendingUp,
  TrendingDown,
  Check,
} from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { BattleEngine } from "../battle/BattleEngine";

/**
 * Async "ghost battle" PvP arena.
 *  - MMR (RP) persisted in localStorage; +25 on win, -15 on loss, 0 on draw.
 *  - Match button shows a 2s loading spinner, then snaps the player into a
 *    BattleEngine fight against a dummy opponent (no real network call).
 *  - Post-match popup surfaces the outcome and the RP delta.
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

// Dummy "other player" decks — disguised AI opponents for ghost matchmaking.
interface GhostOpponent {
  id: number;
  trainer: string; // fake user handle
  rp: number; // shown in matchmaking card
  dragon: Dragon;
}
const GHOST_POOL: GhostOpponent[] = [
  {
    id: 201,
    trainer: "@vortex_kr",
    rp: 1024,
    dragon: { id: 201, name: "Vortex", element: "Water", hp: 55, maxHp: 55, mp: 70, atk: 82, def: 30 },
  },
  {
    id: 202,
    trainer: "@mossguard",
    rp: 988,
    dragon: { id: 202, name: "Mossguard", element: "Wood", hp: 75, maxHp: 75, mp: 45, atk: 50, def: 55 },
  },
  {
    id: 203,
    trainer: "@cinder99",
    rp: 1041,
    dragon: { id: 203, name: "Cinder", element: "Fire", hp: 60, maxHp: 60, mp: 60, atk: 76, def: 28 },
  },
  {
    id: 204,
    trainer: "@ironscale",
    rp: 1012,
    dragon: { id: 204, name: "Ironscale", element: "Earth", hp: 80, maxHp: 80, mp: 40, atk: 58, def: 62 },
  },
];

type Phase = "idle" | "searching" | "picker" | "battle" | "result";

export function PvpView() {
  const dragons = useGameStore((s) => s.dragons);
  const recordPvp = useGameStore((s) => s.recordPvp);
  const pvpRecords = useGameStore((s) => s.pvpRecords);
  const pvpWins = useGameStore((s) => s.pvpWins);
  const pvpLosses = useGameStore((s) => s.pvpLosses);
  const pvpDraws = useGameStore((s) => s.pvpDraws);
  // Globally selected PvP dragon — single source of truth shared with
  // LobbyView and any future surface (battle handoff, share cards, etc.).
  // The local `player` value below is derived from this id + `dragons`,
  // so any external mutation (e.g. another view, devtools) flows through.
  const pvpSelectedDragonId = useGameStore((s) => s.pvpSelectedDragonId);
  const setPvpSelectedDragonId = useGameStore((s) => s.setPvpSelectedDragonId);

  const [rp, setRp] = useState<number>(() => loadRp());
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RP_KEY, String(rp));
  }, [rp]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [opponent, setOpponent] = useState<GhostOpponent | null>(null);
  // Derived: the currently chosen dragon for this match. Always reflects the
  // global store, so the picker stays in lock-step with LobbyView.
  const player: Dragon | null = useMemo(
    () => dragons.find((d) => d.id === pvpSelectedDragonId) ?? null,
    [dragons, pvpSelectedDragonId],
  );
  // Defensive: if the globally selected dragon disappears from the roster
  // (deleted, replaced via re-sync), clear the global selection too. We do
  // NOT clear when `pvpSelectedDragonId` is null and dragons are simply
  // empty — that's a valid "nothing picked yet" state.
  useEffect(() => {
    if (pvpSelectedDragonId !== null && !dragons.some((d) => d.id === pvpSelectedDragonId)) {
      setPvpSelectedDragonId(null);
    }
  }, [dragons, pvpSelectedDragonId, setPvpSelectedDragonId]);
  // Confirm modal shown after the user taps "전투 시작"; cancelling closes the
  // modal but preserves the selected player so the picker state is intact.
  const [confirmStart, setConfirmStart] = useState(false);

  // ---- Selection invariant ----
  // The hard rule: while phase === "picker", the highlighted dragon (player)
  // MUST persist until ONE of these explicit user actions happens —
  //   1) user taps a different card (toggle within picker)
  //   2) user taps "취소" (leaves picker)
  //   3) user taps "진행" inside the confirm modal (consumed → battle)
  //   4) the entire match resets (new matchmaking, post-battle exit)
  //
  // Every code path that mutates `player` must declare its reason via this
  // typed enum so we can statically audit selection clears and assert the
  // invariant at runtime in development.
  type SelectionMutationReason =
    | "user-toggle-in-picker"   // (1)
    | "user-cancel-picker"      // (2)
    | "user-confirm-progress"   // (3) — consumed into battle
    | "matchmaking-reset"       // (4a) — new search starts
    | "post-battle-cleanup"     // (4b) — battle ended
    | "opponent-cleared"        // (4c) — opponent went away (defensive)
    | "user-pick-dragon";       // (1) — first pick / replace

  const setPlayerWithReason = (
    next: Dragon | null,
    reason: SelectionMutationReason,
  ) => {
    if (import.meta.env.DEV) {
      // Invariant: in picker phase, only explicit user-driven mutations or a
      // deliberate confirm-progress may change `player`. Any other reason
      // would silently strip the highlight and break the picker contract.
      const allowedInPicker: SelectionMutationReason[] = [
        "user-toggle-in-picker",
        "user-pick-dragon",
        "user-cancel-picker",
        "user-confirm-progress",
      ];
      if (phase === "picker" && !allowedInPicker.includes(reason)) {
        // eslint-disable-next-line no-console
        console.error(
          `[PvpView] selection-invariant violation: tried to mutate player ` +
            `during picker phase with reason="${reason}". Highlighted dragon ` +
            `must persist until 진행/취소/토글.`,
        );
      }
    }
    // Funnel ALL selection mutations through the global store so every view
    // and future subscriber observes a consistent value.
    setPvpSelectedDragonId(next ? next.id : null);
  };
  const [lastResult, setLastResult] = useState<{
    outcome: "win" | "lose" | "draw";
    delta: number;
    rpBefore: number;
    rpAfter: number;
    enemyName: string;
    trainer: string;
  } | null>(null);

  // Centralized reset so cancel / 다시 매칭 / 확인 always land in the same
  // clean idle state — no leftover opponent, player selection, highlight,
  // or open confirm modal.
  const resetMatchUi = (reason: SelectionMutationReason = "matchmaking-reset") => {
    setOpponent(null);
    setPlayerWithReason(null, reason);
    setConfirmStart(false);
  };

  // Async matchmaking — show spinner for EXACTLY MATCH_SEARCH_MS (2000ms).
  //
  // We deliberately do NOT key the timer to the phase effect cleanup, because
  // an effect re-run (e.g. parent re-render that triggers strict-mode double
  // invoke, or a rapid state change) would clear the timer and restart it,
  // breaking the "exactly 2 seconds" guarantee. Instead we own the timer in
  // a ref and only ever set it once per "searching" entry.
  const matchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchStartedAtRef = useRef<number | null>(null);

  const startMatchmaking = () => {
    // Ignore re-entries — a search is already running and must complete its
    // fixed 2s window unaffected by extra clicks.
    if (matchTimerRef.current !== null) return;
    if (phase === "searching") return;
    // Each new matchmaking attempt starts from a fully clean slate so the
    // resulting picker can never inherit stale selection / opponent / modal
    // state from a previous match.
    resetMatchUi("matchmaking-reset");
    setPhase("searching");
    matchStartedAtRef.current = Date.now();
    matchTimerRef.current = setTimeout(() => {
      const pick = GHOST_POOL[Math.floor(Math.random() * GHOST_POOL.length)];
      setOpponent(pick);
      setPhase("picker");
      matchTimerRef.current = null;
      matchStartedAtRef.current = null;
    }, MATCH_SEARCH_MS);
  };

  const cancelMatchmaking = () => {
    if (matchTimerRef.current !== null) {
      clearTimeout(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    matchStartedAtRef.current = null;
    resetMatchUi("user-cancel-picker");
    setPhase("idle");
  };

  // Clean up any pending timer on unmount only — not on every re-render.
  useEffect(() => {
    return () => {
      if (matchTimerRef.current !== null) {
        clearTimeout(matchTimerRef.current);
        matchTimerRef.current = null;
      }
    };
  }, []);

  // Defensive guarantee: any time the opponent identity changes (new match
  // result lands, or it's cleared on reset), wipe any leftover dragon
  // selection and close the confirm modal. This keeps the picker rule —
  // "selection persists only until 전투 시작; auto-resets after 매칭/확인" —
  // intact even if a future code path forgets to call resetMatchUi().
  const lastOpponentIdRef = useRef<number | null>(null);
  useEffect(() => {
    const id = opponent?.id ?? null;
    const prevId = lastOpponentIdRef.current;
    if (prevId === id) return;
    // Tightened rule: only clear selection on opponent IDENTITY transitions
    // that mean the picker context is gone or has been replaced —
    //   • opponent → null (reset / leaving picker)
    //   • opponent A → opponent B (re-roll; selection no longer meaningful)
    // We must NEVER clear selection on the initial null → opponent transition
    // that happens when entering picker, because that would race with the
    // user's first pick and could wipe a valid highlight.
    const enteringPickerForFirstTime = prevId === null && id !== null;
    if (!enteringPickerForFirstTime) {
      setPlayerWithReason(null, "opponent-cleared");
      setConfirmStart(false);
    }
    lastOpponentIdRef.current = id;
  }, [opponent]);

  // Runtime invariant: confirmStart can only be true while a player IS selected
  // in the picker phase. If we ever observe confirmStart=true with no player,
  // close the modal — its semantics are broken.
  useEffect(() => {
    if (confirmStart && (!player || phase !== "picker")) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(
          `[PvpView] confirmStart invariant violation: confirmStart=true but ` +
            `player=${player?.name ?? "null"}, phase="${phase}". Force-closing.`,
        );
      }
      setConfirmStart(false);
    }
  }, [confirmStart, player, phase]);

  const tier = useMemo(() => {
    if (rp >= 1500) return { rank: 5, label: "Diamond", tone: "text-sky-300 border-sky-400/40 bg-sky-500/10" };
    if (rp >= 1200) return { rank: 4, label: "Platinum", tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" };
    if (rp >= 1000) return { rank: 3, label: "Gold", tone: "text-amber-300 border-amber-400/40 bg-amber-500/10" };
    if (rp >= 800) return { rank: 2, label: "Silver", tone: "text-slate-200 border-slate-400/40 bg-slate-400/10" };
    return { rank: 1, label: "Bronze", tone: "text-orange-300 border-orange-400/40 bg-orange-500/10" };
  }, [rp]);

  // Track RP changes to animate the badge: direction (up/down/none),
  // a one-shot pulse key that re-runs the animation on every change,
  // and a special "promotion/demotion" flash when the tier itself shifts.
  const prevRpRef = useRef<number>(rp);
  const prevTierRef = useRef<number>(tier.rank);
  const [direction, setDirection] = useState<"up" | "down" | "none">("none");
  const [pulseKey, setPulseKey] = useState(0);
  const [tierShift, setTierShift] = useState<"promote" | "demote" | null>(null);
  useEffect(() => {
    const prevRp = prevRpRef.current;
    if (prevRp !== rp) {
      setDirection(rp > prevRp ? "up" : "down");
      setPulseKey((k) => k + 1);
    }
    const prevTier = prevTierRef.current;
    if (prevTier !== tier.rank) {
      setTierShift(tier.rank > prevTier ? "promote" : "demote");
      const t = setTimeout(() => setTierShift(null), 1400);
      prevTierRef.current = tier.rank;
      prevRpRef.current = rp;
      return () => clearTimeout(t);
    }
    prevRpRef.current = rp;
  }, [rp, tier.rank]);

  // ---------------- Battle ----------------
  if (phase === "battle" && player && opponent) {
    return (
      <BattleEngine
        player={player}
        enemy={opponent.dragon}
        context="pvp"
        autoExitMs={1200}
        onResolved={(outcome) => {
          recordPvp({ playerName: player.name, enemyName: opponent.dragon.name, outcome });
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
            enemyName: opponent.dragon.name,
            trainer: opponent.trainer,
          });
        }}
        onExit={() => {
          // Battle is over — selection is finalized. Always clear the player
          // selection and confirm-modal flag so re-entering the picker (via
          // 다시 매칭) starts clean. Opponent stays only while the result
          // popup needs to display its info.
          setPlayerWithReason(null, "post-battle-cleanup");
          setConfirmStart(false);
          if (lastResult) {
            setPhase("result");
          } else {
            resetMatchUi("post-battle-cleanup");
            setPhase("idle");
          }
        }}
      />
    );
  }

  // ---------------- Result popup ----------------
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="PvP 결과"
          className={`rounded-2xl border p-6 text-center ${tone}`}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/40">
            <Icon className="h-8 w-8" />
          </div>
          <h3 className="mt-3 text-xl font-bold">
            {r.outcome === "win" ? "승리!" : r.outcome === "lose" ? "패배..." : "무승부"}
          </h3>
          <p className="mt-1 text-xs opacity-80">
            {r.trainer} · {r.enemyName}
          </p>
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
            resetMatchUi();
            setPhase("idle");
          }}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          확인
        </button>
        <button
          onClick={() => {
            setLastResult(null);
            startMatchmaking();
          }}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          다시 매칭
        </button>
      </div>
    );
  }

  // ---------------- Dragon picker ----------------
  if (phase === "picker" && opponent) {
    return (
      <div
        key="pvp-picker"
        className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"
      >
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose-300">매칭 완료</p>
          <p className="mt-0.5 text-sm font-bold text-slate-100">
            {opponent.trainer} · {opponent.dragon.name}
          </p>
          <p className="text-[11px] text-slate-400">
            {opponent.dragon.element} · ATK {opponent.dragon.atk} · DEF {opponent.dragon.def} · {opponent.rp} RP
          </p>
        </div>
        <h2 className="text-xl font-bold text-slate-100">출전할 드래곤 선택</h2>
        <div className="grid gap-2">
          {dragons.map((d) => {
            const selected = player?.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() =>
                  setPlayerWithReason(
                    selected ? null : d,
                    selected ? "user-toggle-in-picker" : "user-pick-dragon",
                  )
                }
                aria-pressed={selected}
                className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20"
                    : "border-slate-700/60 bg-slate-800/70 hover:border-amber-500/50"
                }`}
              >
                <div>
                  <p
                    className={`text-sm font-bold ${
                      selected ? "text-amber-200" : "text-slate-100"
                    }`}
                  >
                    {d.name}
                    {selected && (
                      <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                        선택됨
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {d.element} · ATK {d.atk} · DEF {d.def}
                  </p>
                </div>
                {selected ? (
                  <Check className="h-4 w-4 text-amber-300" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            if (!player) return;
            setConfirmStart(true);
          }}
          disabled={!player}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
        >
          <Swords className="h-4 w-4" />
          {player ? `${player.name}(으)로 전투 시작` : "드래곤을 선택하세요"}
        </button>
        <button
          onClick={() => {
            resetMatchUi("user-cancel-picker");
            setConfirmStart(false);
            setPhase("idle");
          }}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
        >
          취소
        </button>

        {/* Confirm-start modal — cancelling does NOT clear the picker selection. */}
        {confirmStart && player && opponent && (
          <ConfirmStartModal
            playerName={player.name}
            opponentTrainer={opponent.trainer}
            opponentDragonName={opponent.dragon.name}
            onCancel={() => setConfirmStart(false)}
            onConfirm={() => {
              setConfirmStart(false);
              setPhase("battle");
              // Note: we deliberately do NOT clear `player` here — the
              // BattleEngine consumes the selection and the post-battle
              // onExit handler runs the "post-battle-cleanup" mutation.
            }}
          />
        )}
      </div>
    );
  }

  // ---------------- Idle / Searching home ----------------
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-rose-400" />
        <h2 className="text-xl font-bold text-slate-100">PvP Arena</h2>
      </div>

      {/* MMR / RP header */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 transition-colors duration-500 ease-out ${tier.tone} ${
          tierShift === "promote"
            ? "ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/30"
            : tierShift === "demote"
              ? "ring-2 ring-rose-400/60 shadow-lg shadow-rose-500/30"
              : ""
        }`}
        // Inline keyframes scoped to this card for the pulse + sweep effects.
        style={
          tierShift
            ? ({ animation: "pvp-tier-flash 1.2s ease-out 1" } as React.CSSProperties)
            : undefined
        }
      >
        <style>{`
          @keyframes pvp-tier-flash {
            0% { transform: scale(1); }
            25% { transform: scale(1.03); }
            60% { transform: scale(0.995); }
            100% { transform: scale(1); }
          }
          @keyframes pvp-rp-pulse {
            0% { transform: scale(1); }
            40% { transform: scale(1.12); }
            100% { transform: scale(1); }
          }
          .pvp-rp-pulse { animation: pvp-rp-pulse 0.45s ease-out 1; }
        `}</style>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown
              className={`h-5 w-5 transition-colors duration-500 ${
                tierShift === "promote"
                  ? "text-emerald-300"
                  : tierShift === "demote"
                    ? "text-rose-300"
                    : ""
              }`}
            />
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-70">랭크</p>
              <p className="text-sm font-bold transition-colors duration-500">{tier.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest opacity-70">랭크 점수</p>
            <p
              key={pulseKey}
              className="pvp-rp-pulse flex items-center justify-end gap-1 text-2xl font-bold tabular-nums origin-right"
            >
              {direction === "up" && (
                <TrendingUp className="h-4 w-4 text-emerald-300" aria-hidden />
              )}
              {direction === "down" && (
                <TrendingDown className="h-4 w-4 text-rose-300" aria-hidden />
              )}
              <span>{rp}</span>
              <span className="text-xs opacity-70">RP</span>
            </p>
          </div>
        </div>
        {tierShift && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-2 rounded-md px-2 py-1 text-center text-[11px] font-bold ${
              tierShift === "promote"
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-rose-500/20 text-rose-200"
            }`}
          >
            {tierShift === "promote" ? "🎉 승급! " : "⬇ 강등 "}
            <span className="font-mono">{tier.label}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
          <p className="text-[10px] uppercase text-emerald-400">Win</p>
          <p className="text-lg font-bold text-emerald-300">{pvpWins}</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center">
          <p className="text-[10px] uppercase text-rose-400">Lose</p>
          <p className="text-lg font-bold text-rose-300">{pvpLosses}</p>
        </div>
        <div className="rounded-xl border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-center">
          <p className="text-[10px] uppercase text-slate-400">Draw</p>
          <p className="text-lg font-bold text-slate-300">{pvpDraws}</p>
        </div>
      </div>

      {/* Async matchmaking */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center">
        {phase === "searching" ? (
          <div
            key="searching"
            className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-200 ease-out"
          >
            <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
            <p className="text-sm font-bold text-slate-100">상대 탐색 중...</p>
            <p className="text-[11px] text-slate-400">
              비슷한 RP의 트레이너를 찾고 있습니다
            </p>
            <button
              onClick={cancelMatchmaking}
              className="mt-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
            >
              취소
            </button>
          </div>
        ) : (
          <div
            key="idle"
            className="flex flex-col items-center gap-3 animate-in fade-in duration-200 ease-out"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
              <Shield className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-400">
              승리 <span className="font-bold text-emerald-400">+{RP_WIN_DELTA}</span> · 패배{" "}
              <span className="font-bold text-rose-400">{RP_LOSS_DELTA}</span> RP
            </p>
            <button
              onClick={() => {
                if (dragons.length === 0) return;
                startMatchmaking();
              }}
              // Note: this branch only renders when phase !== "searching", so the
              // button itself can't be clicked mid-search. The startMatchmaking()
              // helper additionally guards via matchTimerRef so any spurious
              // re-entry can't compress the fixed 2s window.
              disabled={dragons.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
            >
              <Search className="h-4 w-4" /> 상대 탐색
            </button>
            {dragons.length === 0 && (
              <p className="text-[10px] text-slate-500">먼저 드래곤을 보유해야 합니다</p>
            )}
          </div>
        )}
      </div>

      {pvpRecords.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-slate-500">최근 기록</p>
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
                    {r.outcome === "win" ? "승" : r.outcome === "lose" ? "패" : "무"}
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

// ----------------------------------------------------------------------
// ConfirmStartModal — accessible confirm dialog for the picker.
//
// A11y contract:
//  • Focus moves to the cancel button on open (least-destructive default).
//  • Tab / Shift+Tab cycle ONLY between the modal's focusable elements
//    (focus trap). Tabbing past the last element wraps to the first, and
//    vice versa.
//  • ESC closes (acts as cancel) — never confirms.
//  • Backdrop closes only when the press AND release both happen on the
//    backdrop itself. A drag that starts inside the dialog and ends on the
//    backdrop must NOT close the modal.
//  • Body scroll is locked while the modal is open.
//  • On close, focus is restored to whatever element was focused before
//    the modal opened (typically the "전투 시작" trigger).
//  • Modal body is announced via aria-describedby.
// ----------------------------------------------------------------------
function ConfirmStartModal({
  playerName,
  opponentTrainer,
  opponentDragonName,
  onCancel,
  onConfirm,
}: {
  playerName: string;
  opponentTrainer: string;
  opponentDragonName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  // Tracks where a mousedown started so a click that began inside the dialog
  // can't accidentally dismiss it when the user releases over the backdrop.
  const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);

  // Save the previously focused element so we can restore focus on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Defer focus to next frame so the dialog node is mounted + measurable.
    const raf = requestAnimationFrame(() => {
      cancelBtnRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      // Only restore if the previously focused element is still in the DOM
      // and still focusable; guards against the trigger having unmounted.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.();
      }
    };
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Keyboard handling: ESC cancels; Tab is trapped within the dialog.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      // Backdrop. role="presentation" is intentional so AT treats only the
      // inner [role=dialog] as the modal landmark.
      role="presentation"
      onMouseDown={(e) => {
        backdropMouseDownTargetRef.current = e.target;
      }}
      onMouseUp={(e) => {
        const startedOnBackdrop =
          backdropMouseDownTargetRef.current === e.currentTarget;
        const endedOnBackdrop = e.target === e.currentTarget;
        backdropMouseDownTargetRef.current = null;
        if (startedOnBackdrop && endedOnBackdrop) {
          onCancel();
        }
      }}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pvp-confirm-title"
        aria-describedby="pvp-confirm-desc"
        // Stop propagation so internal mousedown/up never count as
        // backdrop interaction even if the inner content is later changed.
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl outline-none animate-in zoom-in-95 duration-150"
        tabIndex={-1}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
          <Swords className="h-6 w-6" />
        </div>
        <h3
          id="pvp-confirm-title"
          className="mt-3 text-center text-base font-bold text-slate-100"
        >
          선택한 드래곤으로 진행할까요?
        </h3>
        <div
          id="pvp-confirm-desc"
          className="mt-3 space-y-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 p-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-400">내 드래곤</span>
            <span className="font-bold text-amber-300">{playerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">상대</span>
            <span className="font-bold text-rose-300">
              {opponentTrainer} · {opponentDragonName}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            진행
          </button>
        </div>
      </div>
    </div>
  );
}

