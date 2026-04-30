import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Droplet, Sword, Shield, Zap, BatteryWarning, Flag } from "lucide-react";
import type { Dragon } from "@/store/dragons";
import {
  type Combatant,
  type LogEntry,
  endTurnDrain,
  effectiveStats,
  makeCombatant,
  performAttack,
} from "./battleLogic";

interface BattleEngineProps {
  player: Dragon;
  enemy: Dragon;
  context?: "story" | "pvp";
  onExit?: () => void;
  onResolved?: (
    outcome: "win" | "lose" | "draw",
    finalState: { playerHp: number; playerMp: number; enemyHp: number; enemyMp: number },
  ) => void;
  /** Optional starting HP/MP overrides so multi-battle runs preserve damage. */
  initialPlayerHp?: number;
  initialPlayerMp?: number;
}

const elementTone: Record<string, string> = {
  Wood: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  Water: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  Fire: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  Earth: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  Metal: "text-slate-200 border-slate-400/40 bg-slate-400/10",
};

function CombatantPanel({ c, side }: { c: Combatant; side: "player" | "enemy" }) {
  const stats = effectiveStats(c);
  const hpPct = (c.hp / c.base.maxHp) * 100;
  const mpPct = Math.max(0, Math.min(100, (c.mp / Math.max(1, c.base.mp)) * 100));
  const tone = elementTone[c.base.element] ?? elementTone.Wood;
  return (
    <div
      className={`flex-1 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 ${
        side === "enemy" ? "text-right" : ""
      }`}
    >
      <div className={`flex items-center gap-2 ${side === "enemy" ? "flex-row-reverse" : ""}`}>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
          {c.base.element}
        </span>
        <h3 className="text-sm font-bold text-slate-100">{c.base.name}</h3>
        {c.exhausted && (
          <span className="flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
            <BatteryWarning className="h-3 w-3" /> 탈진
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-emerald-400" /> HP</span>
            <span className="font-mono text-slate-200">{c.hp}/{c.base.maxHp}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Droplet className="h-3 w-3 text-sky-400" /> MP</span>
            <span className="font-mono text-slate-200">{Math.max(0, c.mp)}/{c.base.mp}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${mpPct}%` }} />
          </div>
        </div>
      </div>
      <div className={`mt-2 flex gap-2 text-[11px] text-slate-300 ${side === "enemy" ? "justify-end" : ""}`}>
        <span className={`flex items-center gap-1 ${c.exhausted ? "text-rose-400" : ""}`}>
          <Sword className="h-3 w-3" /> {stats.atk}
        </span>
        <span className={`flex items-center gap-1 ${c.exhausted ? "text-rose-400" : ""}`}>
          <Shield className="h-3 w-3" /> {stats.def}
        </span>
      </div>
    </div>
  );
}

export function BattleEngine({
  player,
  enemy,
  context = "story",
  onExit,
  onResolved,
  initialPlayerHp,
  initialPlayerMp,
}: BattleEngineProps) {
  const [pState, setPState] = useState<Combatant>(() => {
    const c = makeCombatant(player);
    return {
      ...c,
      hp: initialPlayerHp ?? c.hp,
      mp: initialPlayerMp ?? c.mp,
      exhausted: (initialPlayerMp ?? c.mp) <= 0,
    };
  });
  const [eState, setEState] = useState<Combatant>(() => makeCombatant(enemy));
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 0, text: `${context === "pvp" ? "PvP" : "Story"} 전투 개시!`, tone: "system" },
  ]);
  const logIdRef = useRef(1);
  const reportedRef = useRef(false);

  const winner = useMemo(() => {
    if (pState.hp <= 0 && eState.hp <= 0) return "draw" as const;
    if (eState.hp <= 0) return "player" as const;
    if (pState.hp <= 0) return "enemy" as const;
    return null;
  }, [pState.hp, eState.hp]);

  useEffect(() => {
    if (!winner || reportedRef.current) return;
    reportedRef.current = true;
    const outcome = winner === "draw" ? "draw" : winner === "player" ? "win" : "lose";
    onResolved?.(outcome, {
      playerHp: pState.hp,
      playerMp: pState.mp,
      enemyHp: eState.hp,
      enemyMp: eState.mp,
    });
  }, [winner, onResolved, pState.hp, pState.mp, eState.hp, eState.mp]);

  const pushLogs = (entries: Omit<LogEntry, "id">[]) => {
    setLogs((prev) => {
      const next = [...prev];
      for (const e of entries) {
        next.push({ ...e, id: logIdRef.current++ });
      }
      return next.slice(-30);
    });
  };

  const handleAttack = () => {
    if (winner || turn !== "player") return;
    const result = performAttack(pState, eState);
    setPState(result.attacker);
    setEState(result.defender);
    pushLogs(result.logs);
  };

  const handleEndTurn = () => {
    if (winner) return;
    if (turn === "player") {
      const { next, logs: dl } = endTurnDrain(pState);
      setPState(next);
      pushLogs(dl);
      setTurn("enemy");
      // Enemy auto-acts
      setTimeout(() => {
        setEState((curEnemy) => {
          setPState((curPlayer) => {
            if (curEnemy.hp <= 0 || curPlayer.hp <= 0) return curPlayer;
            const r = performAttack(curEnemy, curPlayer);
            pushLogs(r.logs);
            // r.attacker is enemy, r.defender is player
            queueMicrotask(() => setEState(r.attacker));
            return r.defender;
          });
          return curEnemy;
        });
        // Drain enemy MP at end of its turn
        setTimeout(() => {
          setEState((cur) => {
            const { next: en, logs: el } = endTurnDrain(cur);
            pushLogs(el);
            return en;
          });
          setTurn("player");
        }, 600);
      }, 500);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">
          {context === "pvp" ? "PvP Arena" : "Story Battle"}
        </h2>
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            <Flag className="h-3 w-3" /> 종료
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <CombatantPanel c={pState} side="player" />
        <div className="flex items-center text-xs font-bold text-slate-500">VS</div>
        <CombatantPanel c={eState} side="enemy" />
      </div>

      <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
          <span>Battle Log</span>
          <span className={turn === "player" ? "text-emerald-400" : "text-rose-400"}>
            {winner ? "전투 종료" : turn === "player" ? "내 턴" : "상대 턴"}
          </span>
        </div>
        <div className="h-40 space-y-1 overflow-y-auto pr-1 text-xs">
          {logs.map((l) => (
            <p
              key={l.id}
              className={
                l.tone === "penalty"
                  ? "text-rose-400 font-semibold"
                  : l.tone === "damage"
                    ? "text-amber-300"
                    : l.tone === "system"
                      ? "text-slate-500"
                      : "text-slate-300"
              }
            >
              {l.text}
            </p>
          ))}
        </div>
      </div>

      {winner ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-center">
          <p className="text-sm font-bold text-amber-300">
            {winner === "draw" ? "무승부" : winner === "player" ? "승리!" : "패배..."}
          </p>
          {onExit && (
            <button
              onClick={onExit}
              className="mt-2 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950"
            >
              돌아가기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAttack}
            disabled={turn !== "player"}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
          >
            <Sword className="h-4 w-4" /> 공격
          </button>
          <button
            onClick={handleEndTurn}
            disabled={turn !== "player"}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Zap className="h-4 w-4" /> 턴 종료
          </button>
        </div>
      )}
    </div>
  );
}