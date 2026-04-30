import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  Droplet,
  Sword,
  Shield,
  Zap,
  BatteryWarning,
  Flag,
  Sparkles,
  Skull,
  Flame,
  Repeat,
  Trophy,
  Wand2,
} from "lucide-react";
import type { Dragon } from "@/store/dragons";
import { DragonImage } from "../DragonImage";
import {
  type Combatant,
  type LogEntry,
  endTurnDrain,
  effectiveStats,
  hpPercent,
  makeCombatant,
  onTurnStart,
  performAttack,
  recoverBenchMp,
  MP_BENCH_RECOVER_PCT,
  MP_SKILL_COST_PCT,
  MP_SKILL_THRESHOLD_PCT,
} from "./battleLogic";

/** UI HP는 0..base.maxHp 범위로 매핑하기 위해 엔진 비율로 환산. */
function uiHp(c: Combatant): number {
  return Math.round((c.engineHp / Math.max(1, c.engineMaxHp)) * c.base.maxHp);
}

const elementTone: Record<string, string> = {
  Wood: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  Water: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  Fire: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  Earth: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  Light: "text-yellow-200 border-yellow-400/40 bg-yellow-400/10",
  Dark: "text-purple-300 border-purple-500/40 bg-purple-500/10",
};

/** 한 진영의 3:3 상태. activeIdx는 현재 필드에 나와 있는 드래곤 인덱스. */
interface Team {
  members: Combatant[];      // 항상 길이 3 (KO된 드래곤도 포함; engineHp=0)
  activeIdx: number;         // 현재 필드 인덱스 (members[i].engineHp>0 보장)
}

function buildTeam(deck: Dragon[]): Team {
  return { members: deck.map(makeCombatant), activeIdx: 0 };
}

function isTeamWiped(t: Team): boolean {
  return t.members.every((m) => m.engineHp <= 0);
}

/** KO된 필드 드래곤이 있으면 다음 생존자에게 자동 출전. 변경 여부와 새 인덱스를 함께 반환. */
function autoAdvance(t: Team): { team: Team; advancedTo: number | null } {
  if (t.members[t.activeIdx]?.engineHp > 0) return { team: t, advancedTo: null };
  const nextIdx = t.members.findIndex((m) => m.engineHp > 0);
  if (nextIdx === -1) return { team: t, advancedTo: null };
  return { team: { ...t, activeIdx: nextIdx }, advancedTo: nextIdx };
}

/**
 * 진영의 벤치(=필드 외) MP를 MaxMp의 15%씩 회복.
 * 회복 발생 시 로그 항목도 함께 반환한다.
 */
function tickBenchMp(t: Team): { team: Team; logs: Omit<LogEntry, "id">[] } {
  const logs: Omit<LogEntry, "id">[] = [];
  const members = t.members.map((m, i) => {
    if (i === t.activeIdx) return m;
    const { next, recovered } = recoverBenchMp(m);
    if (recovered > 0) {
      logs.push({
        text: `[벤치 회복] ${m.base.name} MP +${recovered} (MaxMp ${Math.round(MP_BENCH_RECOVER_PCT * 100)}%)`,
        tone: "system",
      });
    }
    return next;
  });
  return { team: { ...t, members }, logs };
}

function setActive(t: Team, idx: number, value: Combatant): Team {
  if (idx < 0 || idx >= t.members.length) return t;
  const next = t.members.slice();
  next[idx] = value;
  return { ...t, members: next };
}

interface TagBattleEngineProps {
  playerDeck: Dragon[];   // 정확히 3
  enemyDeck: Dragon[];    // 정확히 3
  context?: "story" | "pvp";
  onExit?: () => void;
  onResolved?: (outcome: "win" | "lose" | "draw") => void;
  autoExitMs?: number;
}

function MiniBenchCard({
  c,
  onClick,
  selectable,
}: {
  c: Combatant;
  onClick?: () => void;
  selectable?: boolean;
}) {
  const dead = c.engineHp <= 0;
  const pct = hpPercent(c);
  return (
    <button
      type="button"
      disabled={!selectable || dead}
      onClick={onClick}
      className={`group relative flex flex-1 items-center gap-2 rounded-xl border p-1.5 text-left transition ${
        dead
          ? "border-slate-800 bg-slate-900/40 opacity-40"
          : selectable
            ? "border-amber-500/60 bg-slate-800/80 hover:border-amber-400 hover:bg-slate-700/80"
            : "border-slate-700/60 bg-slate-800/60"
      }`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
        <DragonImage dragon={c.base} className="h-full w-full" />
        {dead && (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
            <Skull className="h-4 w-4 text-rose-400" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-slate-100">{c.base.name}</p>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-0.5 font-mono text-[9px] text-slate-400">
          HP {uiHp(c)} · MP {Math.max(0, c.mp)}
        </p>
      </div>
    </button>
  );
}

function ActivePanel({ c, side }: { c: Combatant; side: "player" | "enemy" }) {
  const stats = effectiveStats(c);
  const hpPct = hpPercent(c);
  const mpPct = Math.max(0, Math.min(100, (c.mp / Math.max(1, c.maxMp)) * 100));
  const tone = elementTone[c.base.element] ?? elementTone.Wood;
  return (
    <div
      className={`flex-1 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-2.5 ${
        side === "enemy" ? "text-right" : ""
      }`}
    >
      <div className={`flex flex-wrap items-center gap-1 ${side === "enemy" ? "flex-row-reverse" : ""}`}>
        <span className={`rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase ${tone}`}>
          {c.base.element}
        </span>
        <h3 className="text-xs font-bold text-slate-100">{c.base.name}</h3>
        {c.exhausted && (
          <span className="flex items-center gap-0.5 rounded-full border border-rose-500/50 bg-rose-500/15 px-1 py-0 text-[9px] font-bold text-rose-300">
            <BatteryWarning className="h-2.5 w-2.5" /> 탈진
          </span>
        )}
        {c.poisoned && (
          <span className="flex items-center gap-0.5 rounded-full border border-purple-500/50 bg-purple-500/15 px-1 py-0 text-[9px] font-bold text-purple-300">
            <Skull className="h-2.5 w-2.5" /> 독
          </span>
        )}
        {c.rageUsed && c.base.name === "Younigon" && (
          <span className="flex items-center gap-0.5 rounded-full border border-orange-500/60 bg-orange-500/15 px-1 py-0 text-[9px] font-bold text-orange-300">
            <Flame className="h-2.5 w-2.5" /> 격노
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
      <div className={`mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-300 ${side === "enemy" ? "justify-end" : ""}`}>
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

/**
 * 3:3 태그 배틀 엔진.
 * - 필드(active) 1마리 vs 1마리. 벤치 2마리는 미니 카드로 표시.
 * - 플레이어 액션: 공격 / 턴 넘기기 / 교체(턴 소모).
 * - 매 턴 종료 시 양측 벤치 MP +5 회복.
 * - 필드 드래곤 KO 시 다음 생존자가 자동 출전.
 * - 한쪽 3마리 전멸 시 즉시 승패 결정.
 * - 1:1 엔진 룰(하드캡 22%, 5행 상성, 패시브 등)은 active 기준으로 그대로 적용.
 */
export function TagBattleEngine({
  playerDeck,
  enemyDeck,
  context = "pvp",
  onExit,
  onResolved,
  autoExitMs = 1500,
}: TagBattleEngineProps) {
  const [pTeam, setPTeam] = useState<Team>(() => buildTeam(playerDeck));
  const [eTeam, setETeam] = useState<Team>(() => buildTeam(enemyDeck));
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [turnNumber, setTurnNumber] = useState(1);
  const [pickingSwap, setPickingSwap] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 0,
      text: `${context === "pvp" ? "PvP" : "Story"} 3:3 태그 배틀 개시!`,
      tone: "system",
    },
  ]);
  const logIdRef = useRef(1);
  const reportedRef = useRef(false);
  const [autoExitEnabled, setAutoExitEnabled] = useState(autoExitMs > 0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Always-fresh refs so synchronous handlers can read/write the latest team
  // state without nesting setState callbacks (which made the previous draft
  // unreliable). All mutations go through `commit(...)` below.
  const pTeamRef = useRef(pTeam);
  const eTeamRef = useRef(eTeam);
  pTeamRef.current = pTeam;
  eTeamRef.current = eTeam;

  const commit = (nextP: Team, nextE: Team) => {
    pTeamRef.current = nextP;
    eTeamRef.current = nextE;
    setPTeam(nextP);
    setETeam(nextE);
  };

  const pushLogs = (entries: Omit<LogEntry, "id">[]) => {
    if (!entries.length) return;
    setLogs((prev) => {
      const next = [...prev];
      for (const e of entries) next.push({ ...e, id: logIdRef.current++ });
      return next.slice(-60);
    });
  };

  const winner = useMemo<"player" | "enemy" | null>(() => {
    const pDead = isTeamWiped(pTeam);
    const eDead = isTeamWiped(eTeam);
    if (pDead && eDead) return "player"; // 동시 전멸은 매우 드뭄 — 플레이어 우대 처리
    if (eDead) return "player";
    if (pDead) return "enemy";
    return null;
  }, [pTeam, eTeam]);

  // 결과 보고
  useEffect(() => {
    if (!winner || reportedRef.current) return;
    reportedRef.current = true;
    onResolved?.(winner === "player" ? "win" : "lose");
  }, [winner, onResolved]);

  // 자동 종료
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

  // ----- 플레이어 턴 시작: Bella 자가회복 등 -----
  const playerStartRanRef = useRef<number>(0);
  useEffect(() => {
    if (winner) return;
    if (turn !== "player") return;
    if (playerStartRanRef.current === turnNumber) return;
    playerStartRanRef.current = turnNumber;
    const t = pTeamRef.current;
    const cur = t.members[t.activeIdx];
    if (!cur || cur.engineHp <= 0) return;
    const { next, logs: l } = onTurnStart(cur);
    pushLogs(l);
    commit(setActive(t, t.activeIdx, next), eTeamRef.current);
  }, [turn, turnNumber, winner]);

  /** 공통: 한쪽 active가 KO되면 자동 출전 처리 + 로그. */
  const advanceIfDead = (team: Team, label: string): Team => {
    const prevActive = team.members[team.activeIdx];
    const wasAlive = prevActive && prevActive.engineHp > 0;
    const { team: next, advancedTo } = autoAdvance(team);
    if (advancedTo !== null) {
      if (prevActive && !wasAlive) {
        pushLogs([
          {
            text: `💀 [KO] ${label} 진영의 ${prevActive.base.name}이(가) 쓰러졌습니다!`,
            tone: "penalty",
          },
        ]);
      }
      const incoming = next.members[advancedTo];
      const remaining = next.members.filter((m) => m.engineHp > 0).length;
      pushLogs([
        {
          text: `🔁 [자동 출전] ${label} 진영 - ${incoming.base.name} 등장! (남은 생존자 ${remaining}/3)`,
          tone: "system",
        },
      ]);
    } else if (prevActive && !wasAlive) {
      // 더 이상 출전할 드래곤이 없음 = 진영 전멸
      pushLogs([
        {
          text: `💀 [KO] ${label} 진영의 ${prevActive.base.name}이(가) 쓰러졌습니다! ${label} 진영 전멸!`,
          tone: "penalty",
        },
      ]);
    }
    return next;
  };

  /** 턴 종료 처리: drain → 사망 자동출전 → 벤치 회복 → 턴 전환. 동기적으로 ref+setState 갱신. */
  const finishTurn = (actor: "player" | "enemy", overrideP?: Team, overrideE?: Team) => {
    const startP = overrideP ?? pTeamRef.current;
    const startE = overrideE ?? eTeamRef.current;

    const selfTeam = actor === "player" ? startP : startE;
    const oppTeam = actor === "player" ? startE : startP;

    const selfActive = selfTeam.members[selfTeam.activeIdx];
    const oppActive = oppTeam.members[oppTeam.activeIdx];
    if (!selfActive || !oppActive) {
      commit(startP, startE);
      return;
    }

    const drained = endTurnDrain(selfActive, oppActive, { turnNumber });
    pushLogs(drained.logs);

    let nextSelfTeam = setActive(selfTeam, selfTeam.activeIdx, drained.self);
    let nextOppTeam = setActive(oppTeam, oppTeam.activeIdx, drained.opponent);

    nextSelfTeam = advanceIfDead(nextSelfTeam, actor === "player" ? "내" : "적");
    nextOppTeam = advanceIfDead(nextOppTeam, actor === "player" ? "적" : "내");

    {
      const r1 = tickBenchMp(nextSelfTeam);
      nextSelfTeam = r1.team;
      pushLogs(r1.logs);
      const r2 = tickBenchMp(nextOppTeam);
      nextOppTeam = r2.team;
      pushLogs(r2.logs);
    }

    const finalP = actor === "player" ? nextSelfTeam : nextOppTeam;
    const finalE = actor === "player" ? nextOppTeam : nextSelfTeam;

    commit(finalP, finalE);

    // 이미 한쪽이 전멸했다면 턴 진행 멈춤 (winner effect가 처리)
    if (isTeamWiped(finalP) || isTeamWiped(finalE)) return;

    setTurn(actor === "player" ? "enemy" : "player");
    setTurnNumber((n) => n + 1);
  };

  // ----- 플레이어 액션 -----
  const handleAttack = () => {
    if (winner || turn !== "player" || pickingSwap) return;
    const curP = pTeamRef.current;
    const curE = eTeamRef.current;
    const a = curP.members[curP.activeIdx];
    const d = curE.members[curE.activeIdx];
    if (!a || !d || a.engineHp <= 0 || d.engineHp <= 0) return;
    const r = performAttack(a, d, { turnNumber });
    pushLogs(r.logs);
    const nextP = setActive(curP, curP.activeIdx, r.attacker);
    const nextE = setActive(curE, curE.activeIdx, r.defender);
    finishTurn("player", nextP, nextE);
  };

  const handlePass = () => {
    if (winner || turn !== "player" || pickingSwap) return;
    finishTurn("player");
  };

  const handleSkill = () => {
    if (winner || turn !== "player" || pickingSwap) return;
    const curP = pTeamRef.current;
    const curE = eTeamRef.current;
    const a = curP.members[curP.activeIdx];
    const d = curE.members[curE.activeIdx];
    if (!a || !d || a.engineHp <= 0 || d.engineHp <= 0) return;
    if (a.mp < a.maxMp * MP_SKILL_THRESHOLD_PCT) return;
    const r = performAttack(a, d, { turnNumber, skill: true });
    pushLogs(r.logs);
    const nextP = setActive(curP, curP.activeIdx, r.attacker);
    const nextE = setActive(curE, curE.activeIdx, r.defender);
    finishTurn("player", nextP, nextE);
  };

  const handleSwapTo = (idx: number) => {
    if (winner || turn !== "player") return;
    const curP = pTeamRef.current;
    if (idx === curP.activeIdx) return;
    const target = curP.members[idx];
    if (!target || target.engineHp <= 0) return;
    pushLogs([
      { text: `[교체] ${curP.members[curP.activeIdx].base.name} → ${target.base.name}`, tone: "system" },
    ]);
    setPickingSwap(false);
    const swapped: Team = { ...curP, activeIdx: idx };
    finishTurn("player", swapped, eTeamRef.current);
  };

  // ----- 적 턴 -----
  const enemyTurnRanRef = useRef<number | null>(null);
  useEffect(() => {
    if (turn !== "enemy" || winner) return;
    if (enemyTurnRanRef.current === turnNumber) return;
    enemyTurnRanRef.current = turnNumber;

    // 적 턴 시작 훅 (Bella 등)
    {
      const t = eTeamRef.current;
      const cur = t.members[t.activeIdx];
      if (cur && cur.engineHp > 0) {
        const { next, logs: l } = onTurnStart(cur);
        if (l.length) pushLogs(l);
        if (next !== cur) commit(pTeamRef.current, setActive(t, t.activeIdx, next));
      }
    }

    const attackTimer = setTimeout(() => {
      const curP = pTeamRef.current;
      const curE = eTeamRef.current;
      const a = curE.members[curE.activeIdx];
      const d = curP.members[curP.activeIdx];
      if (!a || !d || a.engineHp <= 0 || d.engineHp <= 0) {
        // 둘 중 하나가 이미 KO면 턴만 넘김
        finishTurn("enemy");
        return;
      }
      const r = performAttack(a, d, { turnNumber });
      pushLogs(r.logs);
      const nextE = setActive(curE, curE.activeIdx, r.attacker);
      const nextP = setActive(curP, curP.activeIdx, r.defender);
      finishTurn("enemy", nextP, nextE);
    }, 600);
    return () => clearTimeout(attackTimer);
  }, [turn, turnNumber, winner]);

  const pActive = pTeam.members[pTeam.activeIdx];
  const eActive = eTeam.members[eTeam.activeIdx];
  const playerBench = pTeam.members
    .map((m, i) => ({ m, i }))
    .filter(({ i }) => i !== pTeam.activeIdx);
  const enemyBench = eTeam.members
    .map((m, i) => ({ m, i }))
    .filter(({ i }) => i !== eTeam.activeIdx);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">
          3:3 Tag Battle
          <span className="ml-2 text-xs font-normal text-slate-400">턴 {turnNumber}</span>
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

      {/* 적 벤치 */}
      <div className="flex gap-1.5">
        {enemyBench.map(({ m, i }) => (
          <MiniBenchCard key={i} c={m} />
        ))}
      </div>

      {/* 필드 */}
      <div className="flex gap-2">
        {pActive ? <ActivePanel c={pActive} side="player" /> : <div className="flex-1" />}
        <div className="flex items-center text-xs font-bold text-slate-500">VS</div>
        {eActive ? <ActivePanel c={eActive} side="enemy" /> : <div className="flex-1" />}
      </div>

      {/* 내 벤치 */}
      <div
        className={`flex gap-1.5 rounded-xl p-1 transition ${
          pickingSwap ? "ring-2 ring-amber-400/60 bg-amber-500/5 animate-pulse" : ""
        }`}
      >
        {playerBench.map(({ m, i }) => (
          <MiniBenchCard
            key={i}
            c={m}
            onClick={() => handleSwapTo(i)}
            selectable={pickingSwap && m.engineHp > 0}
          />
        ))}
      </div>

      {pickingSwap && (
        <p className="text-center text-[11px] text-amber-300">
          교체할 대기석 드래곤을 선택하세요 (턴 소모) ·{" "}
          <button
            onClick={() => setPickingSwap(false)}
            className="underline-offset-2 hover:underline"
          >
            취소
          </button>
        </p>
      )}

      <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
          <span>Battle Log</span>
          <span className={turn === "player" ? "text-emerald-400" : "text-rose-400"}>
            {winner ? "전투 종료" : turn === "player" ? "내 턴" : "상대 턴"}
          </span>
        </div>
        <div className="h-32 space-y-1 overflow-y-auto pr-1 text-xs">
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

      {!winner && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleAttack}
            disabled={turn !== "player" || pickingSwap}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
          >
            <Sword className="h-4 w-4" /> 공격
          </button>
          <button
            onClick={() => setPickingSwap((v) => !v)}
            disabled={turn !== "player" || playerBench.every(({ m }) => m.engineHp <= 0)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${
              pickingSwap
                ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                : "bg-sky-600 text-white shadow-lg shadow-sky-900/40 hover:bg-sky-500"
            }`}
          >
            <Repeat className="h-4 w-4" /> 교체
          </button>
          <button
            onClick={handlePass}
            disabled={turn !== "player" || pickingSwap}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-3 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Zap className="h-4 w-4" /> 턴 넘기기
          </button>
        </div>
      )}

      {winner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-300"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ${
              winner === "player"
                ? "border-amber-500/50 bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 shadow-amber-900/40"
                : "border-rose-500/50 bg-gradient-to-b from-rose-500/15 via-slate-900 to-slate-950 shadow-rose-900/40"
            }`}
          >
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                winner === "player"
                  ? "bg-amber-500/20 ring-4 ring-amber-500/30"
                  : "bg-rose-500/20 ring-4 ring-rose-500/30"
              }`}
            >
              {winner === "player" ? (
                <Trophy className="h-8 w-8 text-amber-300" />
              ) : (
                <Skull className="h-8 w-8 text-rose-300" />
              )}
            </div>
            <p
              className={`mt-4 text-2xl font-extrabold tracking-wide ${
                winner === "player" ? "text-amber-300" : "text-rose-300"
              }`}
            >
              {winner === "player" ? "VICTORY" : "DEFEAT"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {winner === "player"
                ? "적 진영을 전멸시켰습니다!"
                : "우리 진영이 전멸했습니다..."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 p-2 text-left">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">내 진영</p>
                <p className="font-mono text-sm text-emerald-300">
                  생존 {pTeam.members.filter((m) => m.engineHp > 0).length}/3
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">적 진영</p>
                <p className="font-mono text-sm text-rose-300">
                  생존 {eTeam.members.filter((m) => m.engineHp > 0).length}/3
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">진행 턴</p>
                <p className="font-mono text-sm text-slate-200">{turnNumber} 턴</p>
              </div>
            </div>

            {onExit && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <button
                  onClick={onExit}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    winner === "player"
                      ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                      : "bg-rose-500 text-slate-950 hover:bg-rose-400"
                  }`}
                >
                  {autoExitEnabled && countdown != null
                    ? `돌아가기 (${countdown}s)`
                    : "돌아가기"}
                </button>
                {autoExitMs > 0 && (
                  <button
                    onClick={() => setAutoExitEnabled((v) => !v)}
                    className="text-[10px] text-slate-400 underline-offset-2 hover:underline"
                  >
                    {autoExitEnabled ? "자동 돌아가기 취소" : "자동 돌아가기 활성화"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}