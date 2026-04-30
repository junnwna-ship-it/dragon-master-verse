import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapIcon, Swords, Flower2, Crown, Heart, Droplet, ChevronRight, Skull, RotateCcw, Sparkles, Lock, Trophy, Handshake } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { BattleEngine } from "../battle/BattleEngine";

type NodeKind = "battle" | "event" | "boss";
interface MapNode {
  id: number;
  title: string;
  subtitle: string;
  kind: NodeKind;
  enemyName?: string;
  enemy?: Dragon;
  /** rough position inside the SVG viewBox (0-100 horizontal, 0-100 vertical) */
  x: number;
  y: number;
}

const NODES: MapNode[] = [
  {
    id: 3,
    title: "정령의 숲 보스",
    subtitle: "최종 보스 · Puri",
    kind: "boss",
    enemyName: "Puri",
    enemy: { id: 9003, name: "Puri", element: "Wood", hp: 90, maxHp: 90, mp: 60, atk: 60, def: 55 },
    x: 50,
    y: 12,
  },
  {
    id: 2,
    title: "꽃의 휴식처",
    subtitle: "이벤트 · HP +30",
    kind: "event",
    x: 28,
    y: 50,
  },
  {
    id: 1,
    title: "하늘의 무법자",
    subtitle: "전투 · Spike",
    kind: "battle",
    enemyName: "Spike",
    enemy: { id: 9001, name: "Spike", element: "Water", hp: 70, maxHp: 70, mp: 90, atk: 80, def: 20 },
    x: 70,
    y: 88,
  },
];

// Edges connect adjacent nodes by id (ascending order: 1 → 2 → 3)
const EDGES: Array<[number, number]> = [
  [1, 2],
  [2, 3],
];

const FIRST_NODE_ID = 1;
const TOTAL_NODES = NODES.length;

interface RunState {
  currentNodeId: number; // the next node the player must clear
  playerHp: number;
  playerMp: number;
  visited: number[]; // already-cleared node ids in this run
}

function nodeIcon(kind: NodeKind, cleared: boolean) {
  const cls = cleared ? "h-5 w-5 text-emerald-300" : "h-5 w-5";
  if (kind === "battle") return <Swords className={cleared ? cls : `${cls} text-rose-300`} />;
  if (kind === "event") return <Flower2 className={cleared ? cls : `${cls} text-pink-300`} />;
  return <Crown className={cleared ? cls : `${cls} text-amber-300`} />;
}

export function StoryView() {
  const dragons = useGameStore((s) => s.dragons);

  const [run, setRun] = useState<RunState | null>(null);
  const [picker, setPicker] = useState(false);
  const [selectedDragon, setSelectedDragon] = useState<Dragon | null>(null);
  const [activeBattleNode, setActiveBattleNode] = useState<MapNode | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<
    | { outcome: "win" | "draw" | "lose"; nodeTitle: string; enemyName?: string }
    | null
  >(null);
  const [defeated, setDefeated] = useState(false);
  const [defeatStats, setDefeatStats] = useState<{ hp: number; mp: number } | null>(null);
  // Pulse the HP/MP gauges briefly when state changes after a battle/event.
  const [gaugePulseKey, setGaugePulseKey] = useState(0);
  const prevStateRef = useRef<{ hp: number; mp: number } | null>(null);
  useEffect(() => {
    if (!run) {
      prevStateRef.current = null;
      return;
    }
    const prev = prevStateRef.current;
    if (prev && (prev.hp !== run.playerHp || prev.mp !== run.playerMp)) {
      setGaugePulseKey((k) => k + 1);
    }
    prevStateRef.current = { hp: run.playerHp, mp: run.playerMp };
  }, [run]);

  // Auto-dismiss the post-battle banner after a few seconds.
  useEffect(() => {
    if (!battleResult) return;
    const t = setTimeout(() => setBattleResult(null), 3500);
    return () => clearTimeout(t);
  }, [battleResult]);

  // Sorted by id so node 1 is the bottom (start), node 3 is top (boss).
  const orderedNodes = useMemo(() => [...NODES].sort((a, b) => a.id - b.id), []);

  // Helper: which node id is the player currently allowed to enter?
  const activeNodeId = run?.currentNodeId ?? FIRST_NODE_ID;

  /**
   * Single state-update pipeline used by BOTH battle resolution and event nodes.
   * Always uses the functional updater form so the preserved HP/MP merges into
   * the latest run (avoids stale-closure bugs and guarantees the map gauges
   * reflect the freshest values regardless of which node type triggered it).
   */
  const applyRunUpdate = (update: {
    hp?: number;
    mp?: number;
    clearNodeId?: number;
  }) => {
    setRun((prev) => {
      if (!prev) return prev;
      const nextHp = update.hp ?? prev.playerHp;
      const nextMp = update.mp ?? prev.playerMp;
      if (update.clearNodeId == null) {
        return { ...prev, playerHp: nextHp, playerMp: nextMp };
      }
      const cleared = update.clearNodeId;
      const isLast = cleared >= TOTAL_NODES;
      return {
        currentNodeId: isLast ? cleared : cleared + 1,
        playerHp: nextHp,
        playerMp: nextMp,
        visited: prev.visited.includes(cleared) ? prev.visited : [...prev.visited, cleared],
      };
    });
  };

  // ----- Battle screen -----
  if (run && selectedDragon && activeBattleNode && activeBattleNode.enemy) {
    return (
      <BattleEngine
        player={selectedDragon}
        enemy={activeBattleNode.enemy}
        context="story"
        initialPlayerHp={run.playerHp}
        initialPlayerMp={run.playerMp}
        onResolved={(outcome, finalState) => {
          setBattleResult({
            outcome,
            nodeTitle: activeBattleNode.title,
            enemyName: activeBattleNode.enemyName,
          });
          if (outcome === "lose") {
            setDefeatStats({ hp: finalState.playerHp, mp: finalState.playerMp });
            setDefeated(true);
            return;
          }
          if (outcome === "win") {
            applyRunUpdate({
              hp: finalState.playerHp,
              mp: finalState.playerMp,
              clearNodeId: activeBattleNode.id,
            });
          } else {
            // draw: keep position, persist HP/MP for retry
            applyRunUpdate({ hp: finalState.playerHp, mp: finalState.playerMp });
          }
        }}
        onExit={() => {
          setActiveBattleNode(null);
        }}
      />
    );
  }

  // ----- Defeat modal -----
  if (defeated && selectedDragon) {
    const finalHp = Math.max(0, defeatStats?.hp ?? 0);
    const finalMp = Math.max(0, defeatStats?.mp ?? run?.playerMp ?? 0);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-b from-rose-500/15 to-rose-500/5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
            <Skull className="h-8 w-8" />
          </div>
          <h3 className="mt-3 text-xl font-bold text-rose-200">여정 실패</h3>
          <p className="mt-1 text-xs text-slate-400">
            {selectedDragon.name}이(가) 쓰러졌습니다. 처음부터 다시 도전하세요.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
                <Heart className="h-3 w-3 text-emerald-400" /> HP
              </div>
              <p className="mt-0.5 font-mono text-sm text-slate-100">
                {finalHp}<span className="text-slate-500">/{selectedDragon.maxHp}</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
                <Droplet className="h-3 w-3 text-sky-400" /> MP
              </div>
              <p className="mt-0.5 font-mono text-sm text-slate-100">
                {finalMp}<span className="text-slate-500">/{selectedDragon.mp}</span>
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setDefeated(false);
            setDefeatStats(null);
            setActiveBattleNode(null);
            setRun({
              currentNodeId: FIRST_NODE_ID,
              playerHp: selectedDragon.maxHp,
              playerMp: selectedDragon.mp,
              visited: [],
            });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-rose-400"
        >
          <RotateCcw className="h-4 w-4" /> 1단계부터 다시 시작
        </button>
      </div>
    );
  }

  // ----- Dragon picker (run not started yet) -----
  if (picker) {
    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">정령의 숲 여정</p>
        <h2 className="text-xl font-bold text-slate-100">출전할 드래곤 선택</h2>
        <div className="grid gap-2">
          {dragons.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDragon(d);
                setRun({
                  currentNodeId: FIRST_NODE_ID,
                  playerHp: d.maxHp,
                  playerMp: d.mp,
                  visited: [],
                });
                setPicker(false);
              }}
              className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-3 text-left hover:border-amber-500/50"
            >
              <div>
                <p className="text-sm font-bold text-slate-100">{d.name}</p>
                <p className="text-[11px] text-slate-400">
                  {d.element} · ATK {d.atk} · DEF {d.def} · HP {d.maxHp} · MP {d.mp}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          ))}
        </div>
        <button
          onClick={() => setPicker(false)}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
        >
          취소
        </button>
      </div>
    );
  }

  // ----- Map view -----
  const allCleared = run && run.visited.length >= TOTAL_NODES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold text-slate-100">Story · 여정의 맵</h2>
        </div>
        {run && selectedDragon && (
          <button
            onClick={() => {
              setRun(null);
              setSelectedDragon(null);
            }}
            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800"
          >
            여정 포기
          </button>
        )}
      </div>

      {/* Player status (only during a run) */}
      {run && selectedDragon && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-100">{selectedDragon.name}</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              진행 {Math.min(run.visited.length, TOTAL_NODES)} / {TOTAL_NODES}
            </span>
          </div>
          <div key={gaugePulseKey} className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-emerald-400" /> HP</span>
                <span className="font-mono text-slate-200 transition-colors animate-in fade-in duration-300">
                  {run.playerHp}/{selectedDragon.maxHp}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${(run.playerHp / selectedDragon.maxHp) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1"><Droplet className="h-3 w-3 text-sky-400" /> MP</span>
                <span className="font-mono text-slate-200 transition-colors animate-in fade-in duration-300">
                  {Math.max(0, run.playerMp)}/{selectedDragon.mp}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full bg-sky-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, (run.playerMp / Math.max(1, selectedDragon.mp)) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event message banner */}
      {eventMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-xs text-pink-200">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
          <p>{eventMessage}</p>
          <button
            onClick={() => setEventMessage(null)}
            className="ml-auto rounded px-2 text-[10px] text-pink-300/70 hover:text-pink-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* All-cleared banner */}
      {allCleared && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
          <Crown className="h-4 w-4" /> 모든 노드를 클리어했습니다!
        </div>
      )}

      {/* Start CTA when no run is active */}
      {!run && (
        <button
          onClick={() => setPicker(true)}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          여정 시작하기
        </button>
      )}

      {/* Vertical scroll node map */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900 via-slate-900/80 to-slate-950 p-2">
        <div className="relative mx-auto h-[520px] w-full max-w-md">
          {/* Background SVG: connectors */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              {/* Animated dash for the "next" connector */}
              <style>{`
                @keyframes story-connector-flow {
                  to { stroke-dashoffset: -6; }
                }
                .story-connector-next {
                  animation: story-connector-flow 1.2s linear infinite;
                }
              `}</style>
            </defs>
            {EDGES.map(([fromId, toId]) => {
              const from = NODES.find((n) => n.id === fromId)!;
              const to = NODES.find((n) => n.id === toId)!;
              const fromCleared = run?.visited.includes(fromId);
              const reachable = run ? activeNodeId >= toId : false;
              // Edge that leads INTO the player's current next node — highlight + animate.
              const isNextEdge = run ? toId === activeNodeId && fromCleared === true : false;
              const stroke = isNextEdge
                ? "rgb(252 211 77)"
                : fromCleared && reachable
                  ? "rgb(252 211 77)"
                  : fromCleared
                    ? "rgb(148 163 184)"
                    : "rgb(71 85 105)";
              return (
                <line
                  key={`${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={stroke}
                  strokeWidth={isNextEdge ? 1 : 0.6}
                  strokeDasharray={isNextEdge ? "2 1.5" : fromCleared ? undefined : "1.5 1.5"}
                  className={isNextEdge ? "story-connector-next" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Nodes (positioned absolutely over the SVG) */}
          {orderedNodes.map((node) => {
            const cleared = run?.visited.includes(node.id) ?? false;
            const isActive = run ? activeNodeId === node.id : node.id === FIRST_NODE_ID;
            const locked = run ? node.id > activeNodeId : node.id !== FIRST_NODE_ID;
            const lockReason = locked
              ? !run
                ? "여정을 시작하면 잠금이 해제됩니다"
                : `이전 노드를 먼저 클리어하세요 (현재: ${activeNodeId}단계)`
              : cleared
                ? "이미 클리어한 노드입니다"
                : "";

            const ring =
              node.kind === "boss"
                ? "border-amber-400/70 bg-amber-500/15"
                : node.kind === "event"
                  ? "border-pink-400/60 bg-pink-500/10"
                  : "border-rose-400/60 bg-rose-500/10";
            const stateRing = cleared
              ? "border-emerald-400/70 bg-emerald-500/15 ring-2 ring-emerald-400/40"
              : isActive
                ? "ring-2 ring-amber-300/60 shadow-lg shadow-amber-500/30"
                : locked
                  ? "opacity-50 grayscale"
                  : "";

            const handleClick = () => {
              if (!run || !selectedDragon) {
                setPicker(true);
                return;
              }
              if (locked || cleared) return;
              if (node.kind === "event") {
                // Heal +30 HP, no battle
                const healed = Math.min(selectedDragon.maxHp, run.playerHp + 30);
                applyRunUpdate({ hp: healed, clearNodeId: node.id });
                setEventMessage(`Bella의 장미꽃 향기로 HP 30 회복! (${run.playerHp} → ${healed})`);
                return;
              }
              // battle / boss → open battle
              setActiveBattleNode(node);
            };

            return (
              <button
                key={node.id}
                onClick={handleClick}
                disabled={locked && !cleared}
                title={locked ? lockReason : cleared ? lockReason : node.title}
                className={`group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 ${
                  locked && !cleared ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                aria-label={
                  locked
                    ? `${node.title} — 잠김. ${lockReason}`
                    : cleared
                      ? `${node.title} — 클리어됨`
                      : node.title
                }
                aria-disabled={locked && !cleared}
              >
                <span
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 backdrop-blur transition ${ring} ${stateRing} ${
                    !locked && !cleared ? "group-hover:scale-105" : ""
                  }`}
                >
                  {nodeIcon(node.kind, cleared)}
                  {/* Lock badge for locked nodes */}
                  {locked && !cleared && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 shadow">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </span>
                <div
                  className={`rounded-md px-2 py-0.5 text-center ${
                    locked && !cleared
                      ? "border border-slate-700/60 bg-slate-950/80"
                      : "bg-slate-950/80"
                  }`}
                >
                  <p className="text-[11px] font-bold text-slate-100">{node.title}</p>
                  <p
                    className={`text-[9px] uppercase tracking-widest ${
                      locked && !cleared ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {cleared ? "Cleared" : locked ? "Locked" : node.subtitle}
                  </p>
                </div>

                {/* Hover tooltip for locked nodes — visible on hover/focus */}
                {locked && !cleared && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-44 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-950/95 px-2 py-1 text-center text-[10px] font-medium text-slate-200 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    <span className="flex items-center justify-center gap-1 text-slate-300">
                      <Lock className="h-3 w-3" /> 잠긴 노드
                    </span>
                    <span className="mt-0.5 block text-slate-400">{lockReason}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-500">
        노드를 따라 위로 진행하세요 · 전투 종료 시 HP/MP는 그대로 유지됩니다
      </p>
    </div>
  );
}