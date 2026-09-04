import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Droplet, Sword, Shield, Zap, BatteryWarning, Flag, Sparkles, Skull, Flame } from "lucide-react";
import type { Dragon } from "@/store/dragons";
import {
  type Combatant,
  type LogEntry,
  endTurnDrain,
  effectiveStats,
  hpPercent,
  makeCombatant,
  onTurnStart,
  performAttack,
} from "./battleLogic";
import { BattleItemPanel } from "./BattleItemPanel";
import {
  applyItemEffect,
  consumeShield,
  createItemBattleState,
  tickItemBuffs,
  tryRevive,
  type ItemBattleState,
  type ResolvedItemEffect,
} from "@/lib/battleItems";

interface BattleEngineProps {
  player: Dragon;
  enemy: Dragon;
  context?: "story" | "pvp";
  onExit?: () => void;
  onResolved?: (
    outcome: "win" | "lose" | "draw",
    finalState: { playerHp: number; playerMp: number; enemyHp: number; enemyMp: number },
  ) => void;
  initialPlayerHp?: number;
  initialPlayerMp?: number;
  autoExitMs?: number;
}

const elementTone: Record<string, string> = {
  Wood: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  Water: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  Fire: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  Earth: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  Soil: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  Metal: "text-slate-200 border-slate-400/40 bg-slate-400/10",
  Light: "text-yellow-200 border-yellow-400/40 bg-yellow-400/10",
  Dark: "text-purple-300 border-purple-500/40 bg-purple-500/10",
};

/** UI HP는 0..base.maxHp 범위로 매핑하기 위해 엔진 비율로 환산. */
function uiHp(c: Combatant): number {
  return Math.round((c.engineHp / Math.max(1, c.engineMaxHp)) * c.base.maxHp);
}

function CombatantPanel({ c, side }: { c: Combatant; side: "player" | "enemy" }) {
  const { t } = useTranslation();
  const stats = effectiveStats(c);
  const hpPct = hpPercent(c);
  const mpPct = Math.max(0, Math.min(100, (c.mp / Math.max(1, c.maxMp)) * 100));
  const tone = elementTone[c.base.element] ?? elementTone.Wood;
  return (
    <div
      className={`flex-1 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 ${
        side === "enemy" ? "text-right" : ""
      }`}
    >
      <div className={`flex flex-wrap items-center gap-1.5 ${side === "enemy" ? "flex-row-reverse" : ""}`}>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
          {c.base.element}
        </span>
        <h3 className="text-sm font-bold text-slate-100">{c.base.name}</h3>
        {c.exhausted && (
          <span className="flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
            <BatteryWarning className="h-3 w-3" /> {t("battle.tag.exhausted")}
          </span>
        )}
        {c.poisoned && (
          <span className="flex items-center gap-1 rounded-full border border-purple-500/50 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-300">
            <Skull className="h-3 w-3" /> {t("battle.tag.poison")}
          </span>
        )}
        {c.rageUsed && c.base.name === "Younigon" && (
          <span className="flex items-center gap-1 rounded-full border border-orange-500/60 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
            <Flame className="h-3 w-3" /> {t("battle.tag.rage")}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-emerald-400" /> HP</span>
            <span className="font-mono text-slate-200">{uiHp(c)}/{c.base.maxHp}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Droplet className="h-3 w-3 text-sky-400" /> MP</span>
            <span className="font-mono text-slate-200">{Math.max(0, c.mp)}/{c.maxMp}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${mpPct}%` }} />
          </div>
        </div>
      </div>
      <div className={`mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300 ${side === "enemy" ? "justify-end" : ""}`}>
        <span className={`flex items-center gap-1 ${c.exhausted ? "text-rose-400" : ""}`}>
          <Sword className="h-3 w-3" /> {stats.atk}
        </span>
        <span className={`flex items-center gap-1 ${c.exhausted ? "text-rose-400" : ""}`}>
          <Shield className="h-3 w-3" /> {stats.def}
        </span>
        {c.atkBuffStacks > 0 && (
          <span className="flex items-center gap-1 text-emerald-300">
            <Sparkles className="h-3 w-3" /> ATK x{c.atkBuffStacks}
          </span>
        )}
        {c.defDebuffStacks > 0 && (
          <span className="flex items-center gap-1 text-rose-300">
            <Sparkles className="h-3 w-3" /> DEF -{c.defDebuffStacks}
          </span>
        )}
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
  autoExitMs = 1000,
}: BattleEngineProps) {
  const { t } = useTranslation();
  const [pState, setPState] = useState<Combatant>(() => {
    const c = makeCombatant(player);
    // initialPlayerHp/Mp는 UI 단위. 엔진으로 변환.
    const eng = initialPlayerHp != null
      ? 5000 + Math.max(0, initialPlayerHp) * 5
      : c.engineHp;
    const mp = initialPlayerMp ?? c.mp;
    return {
      ...c,
      engineHp: Math.min(c.engineMaxHp, eng),
      mp,
      exhausted: mp <= 0,
    };
  });
  const [eState, setEState] = useState<Combatant>(() => makeCombatant(enemy));
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [turnNumber, setTurnNumber] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 0,
      text: t("battle.openLog", { context: context === "pvp" ? t("battle.openLogPvp") : t("battle.openLogStory") }),
      tone: "system",
    },
  ]);
  const logIdRef = useRef(1);
  const reportedRef = useRef(false);
  const [autoExitEnabled, setAutoExitEnabled] = useState(autoExitMs > 0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [drawByTimeout, setDrawByTimeout] = useState(false);
  const [itemState, setItemState] = useState<ItemBattleState>(() => createItemBattleState());

  const winner = useMemo(() => {
    if (drawByTimeout) return "draw" as const;
    // A pending revive charge keeps the run alive for one more beat.
    const reviveHolds = pState.engineHp <= 0 && itemState.revive.charges > 0;
    if (pState.engineHp <= 0 && eState.engineHp <= 0) return reviveHolds ? null : ("draw" as const);
    if (eState.engineHp <= 0) return "player" as const;
    if (pState.engineHp <= 0) return reviveHolds ? null : ("enemy" as const);
    return null;
  }, [pState.engineHp, eState.engineHp, drawByTimeout, itemState.revive.charges]);

  const pushLogs = (entries: Omit<LogEntry, "id">[]) => {
    setLogs((prev) => {
      const next = [...prev];
      for (const e of entries) {
        next.push({ ...e, id: logIdRef.current++ });
      }
      return next.slice(-40);
    });
  };

  /** Immortal Feather: bring the player back before the loss is reported. */
  useEffect(() => {
    if (pState.engineHp > 0 || itemState.revive.charges <= 0) return;
    const rev = tryRevive(itemState, pState);
    if (!rev.revived) return;
    setItemState(rev.state);
    setPState(rev.self);
    pushLogs([{ text: t("items.revived", { name: pState.base.name }), tone: "system" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pState.engineHp, itemState.revive.charges]);

  /** Applies a server-resolved item effect; using an item ends the player turn. */
  const handleUseItem = (effect: ResolvedItemEffect) => {
    if (winner || turn !== "player") return;
    const r = applyItemEffect(itemState, pState, eState, effect);
    if (!r.applied) {
      pushLogs([{ text: t("items.noUsesLeft"), tone: "system" }]);
      return;
    }
    setItemState(r.state);
    pushLogs([
      { text: t("items.used", { name: pState.base.name, item: effect.name }), tone: "info" },
      ...r.logs,
    ]);
    if (r.enemy.engineHp <= 0) {
      setPState(r.self);
      setEState(r.enemy);
      return;
    }
    const drained = endTurnDrain(r.self, r.enemy, { turnNumber });
    const ticked = tickItemBuffs(r.state, drained.self, drained.opponent);
    setItemState(ticked.state);
    setPState(ticked.self);
    setEState(ticked.enemy);
    pushLogs([...drained.logs, ...ticked.logs]);
    setTurn("enemy");
  };



  useEffect(() => {
    if (!winner || reportedRef.current) return;
    reportedRef.current = true;
    const outcome = winner === "draw" ? "draw" : winner === "player" ? "win" : "lose";
    onResolved?.(outcome, {
      playerHp: uiHp(pState),
      playerMp: pState.mp,
      enemyHp: uiHp(eState),
      enemyMp: eState.mp,
    });
  }, [winner, onResolved, pState, eState]);

  useEffect(() => {
    if (!winner || !onExit || !autoExitEnabled || autoExitMs <= 0) return;
    setCountdown(Math.ceil(autoExitMs / 1000));
    const tickIv = setInterval(() => {
      setCountdown((c) => (c == null || c <= 1 ? c : c - 1));
    }, 1000);
    const exitT = setTimeout(() => onExit(), autoExitMs);
    return () => {
      clearInterval(tickIv);
      clearTimeout(exitT);
    };
  }, [winner, onExit, autoExitEnabled, autoExitMs]);

  // ---------------- Player turn start hooks (Bella heal) ----------------
  const playerStartRanRef = useRef<number>(0);
  useEffect(() => {
    if (winner) return;
    if (turn !== "player") return;
    if (playerStartRanRef.current === turnNumber) return;
    playerStartRanRef.current = turnNumber;
    setPState((cur) => {
      const { next, logs: l } = onTurnStart(cur);
      if (l.length) pushLogs(l);
      return next;
    });
  }, [turn, turnNumber, winner]);

  const handleAttack = () => {
    if (winner || turn !== "player") return;
    const result = performAttack(pState, eState, { turnNumber });
    setPState(result.attacker);
    setEState(result.defender);
    pushLogs(result.logs);
    // 종료 처리: MP 소모 + 패시브(턴 종료)
    const drained = endTurnDrain(result.attacker, result.defender, { turnNumber });
    setPState(drained.self);
    setEState(drained.opponent);
    pushLogs(drained.logs);
    setTurn("enemy");
  };

  const handlePassTurn = () => {
    if (winner || turn !== "player") return;
    const drained = endTurnDrain(pState, eState, { turnNumber });
    setPState(drained.self);
    setEState(drained.opponent);
    pushLogs(drained.logs);
    setTurn("enemy");
  };

  const enemyAttackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyDrainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyTurnRanRef = useRef<number | null>(null);

  useEffect(() => {
    if (turn !== "enemy" || winner) return;
    if (enemyTurnRanRef.current === turnNumber) return;
    enemyTurnRanRef.current = turnNumber;

    // Bella heal at enemy turn start
    setEState((cur) => {
      const { next, logs: l } = onTurnStart(cur);
      if (l.length) pushLogs(l);
      return next;
    });

    const attackTimer = setTimeout(() => {
      // 함수형 업데이트로 stale state 방지. 상호 의존이 있어 한쪽에서
      // 양쪽 다 갱신.
      let nextEnemy: Combatant | null = null;
      let nextPlayer: Combatant | null = null;
      // Sanctuary Shield fully nullifies the incoming hit.
      const shield = consumeShield(itemState);
      if (shield.blocked) {
        setItemState(shield.state);
        pushLogs([{ text: t("items.shieldBlocked", { name: pState.base.name }), tone: "system" }]);
        nextEnemy = eState;
        nextPlayer = pState;
      } else
      setEState((curEnemy) => {
        if (curEnemy.engineHp <= 0) {
          nextEnemy = curEnemy;
          return curEnemy;
        }
        setPState((curPlayer) => {
          if (curPlayer.engineHp <= 0) {
            nextPlayer = curPlayer;
            nextEnemy = curEnemy;
            return curPlayer;
          }
          const r = performAttack(curEnemy, curPlayer, { turnNumber });
          pushLogs(r.logs);
          nextEnemy = r.attacker;
          nextPlayer = r.defender;
          return r.defender;
        });
        return nextEnemy ?? curEnemy;
      });

      const drainTimer = setTimeout(() => {
        if (!nextEnemy || !nextPlayer) {
          setTurn("player");
          return;
        }
        const d = endTurnDrain(nextEnemy, nextPlayer, { turnNumber });
        // Expire timed item buffs at the end of the full turn.
        setItemState((cur) => {
          const ticked = tickItemBuffs(cur, d.opponent, d.self);
          setPState(ticked.self);
          setEState(ticked.enemy);
          if (ticked.logs.length) pushLogs(ticked.logs);
          return ticked.state;
        });
        pushLogs(d.logs);

        // 15턴 룰 검사
        if (turnNumber >= 15) {
          pushLogs([{ text: t("battle.fifteenTurnDraw"), tone: "system" }]);
          setDrawByTimeout(true);
          return;
        }
        setTurn("player");
        setTurnNumber((n) => n + 1);
      }, 500);
      enemyDrainTimerRef.current = drainTimer;
    }, 500);

    enemyAttackTimerRef.current = attackTimer;
    return () => {
      clearTimeout(attackTimer);
      if (enemyDrainTimerRef.current) clearTimeout(enemyDrainTimerRef.current);
    };
  }, [turn, turnNumber, winner]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">
          {context === "pvp" ? t("battle.header1v1Pvp") : t("battle.header1v1Story")}
          <span className="ml-2 text-xs font-normal text-slate-400">{t("battle.turnOfMax", { n: turnNumber, max: 15 })}</span>
        </h2>
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            <Flag className="h-3 w-3" /> {t("battle.end")}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <CombatantPanel c={pState} side="player" />
        <div className="flex items-center text-xs font-bold text-slate-500">VS</div>
        <CombatantPanel c={eState} side="enemy" />
      </div>

      {winner ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-center">
          <p className="text-sm font-bold text-amber-300">
            {winner === "draw" ? t("battle.draw") : winner === "player" ? t("battle.win") : t("battle.lose")}
          </p>
          {onExit && (
            <div className="mt-2 flex flex-col items-center gap-1.5">
              <button
                onClick={onExit}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                {autoExitEnabled && countdown != null
                  ? t("battle.backCountdown", { n: countdown })
                  : t("battle.back")}
              </button>
              {autoExitMs > 0 && (
                <button
                  onClick={() => setAutoExitEnabled((v) => !v)}
                  className="text-[10px] text-amber-300/80 underline-offset-2 hover:underline"
                >
                  {autoExitEnabled ? t("battle.autoBackOff") : t("battle.autoBackOn")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="sticky bottom-0 z-20 -mx-4 grid grid-cols-2 gap-2 border-t border-slate-700 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <button
            onClick={handleAttack}
            disabled={turn !== "player"}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-4 text-base font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
          >
            <Sword className="h-5 w-5" /> {t("battle.btnAttack")}
          </button>
          <button
            onClick={handlePassTurn}
            disabled={turn !== "player"}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-4 text-base font-bold text-slate-100 transition hover:bg-slate-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Zap className="h-5 w-5" /> {t("battle.btnPass")}
          </button>
          <div className="col-span-2">
            <div className="grid grid-cols-1">
              <BattleItemPanel
                disabled={turn !== "player"}
                usesLeft={itemState.usesLeft}
                onUsed={handleUseItem}
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-2 opacity-80">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
          <span>{t("battle.battleLog")}</span>
          <span className={turn === "player" ? "text-emerald-400" : "text-rose-400"}>
            {winner ? t("battle.battleEnded") : turn === "player" ? t("battle.myTurn") : t("battle.enemyTurn")}
          </span>
        </div>
        <div className="max-h-32 space-y-0.5 overflow-y-auto pr-1 text-xs leading-snug">
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
    </div>
  );
}