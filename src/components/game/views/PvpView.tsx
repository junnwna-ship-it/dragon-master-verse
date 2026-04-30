import { useState } from "react";
import { Swords, ChevronRight, Trophy, Skull, Minus } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { BattleEngine } from "../battle/BattleEngine";

const opponents: Dragon[] = [
  { id: 201, name: "Vortex", element: "Water", hp: 55, maxHp: 55, mp: 70, atk: 82, def: 30 },
  { id: 202, name: "Mossguard", element: "Wood", hp: 75, maxHp: 75, mp: 45, atk: 50, def: 55 },
  { id: 203, name: "Cinder", element: "Fire", hp: 60, maxHp: 60, mp: 60, atk: 76, def: 28 },
];

export function PvpView() {
  const dragons = useGameStore((s) => s.dragons);
  const recordPvp = useGameStore((s) => s.recordPvp);
  const pvpRecords = useGameStore((s) => s.pvpRecords);
  const pvpWins = useGameStore((s) => s.pvpWins);
  const pvpLosses = useGameStore((s) => s.pvpLosses);
  const pvpDraws = useGameStore((s) => s.pvpDraws);
  const [enemy, setEnemy] = useState<Dragon | null>(null);
  const [player, setPlayer] = useState<Dragon | null>(null);

  if (player && enemy) {
    return (
      <BattleEngine
        player={player}
        enemy={enemy}
        context="pvp"
        onResolved={(outcome) =>
          recordPvp({ playerName: player.name, enemyName: enemy.name, outcome })
        }
        onExit={() => {
          setPlayer(null);
          setEnemy(null);
        }}
      />
    );
  }

  if (enemy) {
    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">상대: {enemy.name}</p>
        <h2 className="text-xl font-bold text-slate-100">출전할 드래곤 선택</h2>
        <div className="grid gap-2">
          {dragons.map((d) => (
            <button
              key={d.id}
              onClick={() => setPlayer(d)}
              className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-3 text-left hover:border-amber-500/50"
            >
              <div>
                <p className="text-sm font-bold text-slate-100">{d.name}</p>
                <p className="text-[11px] text-slate-400">
                  {d.element} · ATK {d.atk} · DEF {d.def}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          ))}
        </div>
        <button
          onClick={() => setEnemy(null)}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-rose-400" />
        <h2 className="text-xl font-bold text-slate-100">PvP Arena</h2>
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
      <div className="grid gap-2">
        {opponents.map((o) => (
          <button
            key={o.id}
            onClick={() => setEnemy(o)}
            className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-3 text-left hover:border-rose-500/50"
          >
            <div>
              <p className="text-sm font-bold text-slate-100">{o.name}</p>
              <p className="text-[11px] text-slate-400">
                {o.element} · ATK {o.atk} · DEF {o.def} · HP {o.maxHp}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        ))}
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