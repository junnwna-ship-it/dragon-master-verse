import { useState } from "react";
import { BookOpen, ChevronRight, Lock, Check, Trophy } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { BattleEngine } from "../battle/BattleEngine";

const stages: { id: number; name: string; enemy: Dragon }[] = [
  {
    id: 1,
    name: "Stage 1 — 고대의 숲",
    enemy: { id: 101, name: "Rooten", element: "Earth", hp: 70, maxHp: 70, mp: 40, atk: 55, def: 35 },
  },
  {
    id: 2,
    name: "Stage 2 — 화염 협곡",
    enemy: { id: 102, name: "Blaze", element: "Fire", hp: 60, maxHp: 60, mp: 60, atk: 78, def: 25 },
  },
  {
    id: 3,
    name: "Stage 3 — 강철 동굴",
    enemy: { id: 103, name: "Ironclaw", element: "Wood", hp: 80, maxHp: 80, mp: 50, atk: 70, def: 60 },
  },
];

export function StoryView() {
  const dragons = useGameStore((s) => s.dragons);
  const storyProgress = useGameStore((s) => s.storyProgress);
  const clearStage = useGameStore((s) => s.clearStage);
  const [stage, setStage] = useState<(typeof stages)[number] | null>(null);
  const [picker, setPicker] = useState<(typeof stages)[number] | null>(null);
  const [player, setPlayer] = useState<Dragon | null>(null);
  const [lastResult, setLastResult] = useState<"win" | "lose" | "draw" | null>(null);

  if (stage && player) {
    return (
      <BattleEngine
        player={player}
        enemy={stage.enemy}
        context="story"
        onResolved={(outcome) => {
          setLastResult(outcome);
          if (outcome === "win") clearStage(stage.id);
        }}
        onExit={() => {
          const cleared = lastResult === "win";
          const nextStage = cleared ? stages.find((s) => s.id === stage.id + 1) ?? null : null;
          setStage(null);
          setPlayer(null);
          setLastResult(null);
          if (nextStage) setPicker(nextStage);
        }}
      />
    );
  }

  if (picker) {
    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">{picker.name}</p>
        <h2 className="text-xl font-bold text-slate-100">출전할 드래곤 선택</h2>
        <div className="grid gap-2">
          {dragons.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setPlayer(d);
                setStage(picker);
                setPicker(null);
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
          onClick={() => setPicker(null)}
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
        >
          취소
        </button>
      </div>
    );
  }

  const allCleared = storyProgress >= stages[stages.length - 1].id;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-amber-400" />
        <h2 className="text-xl font-bold text-slate-100">Story Mode</h2>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs">
        <span className="text-slate-400">진행도</span>
        <span className="font-mono font-bold text-amber-300">
          {storyProgress} / {stages.length}
        </span>
      </div>
      {allCleared && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
          <Trophy className="h-4 w-4" /> 모든 스테이지를 클리어했습니다!
        </div>
      )}
      <div className="grid gap-2">
        {stages.map((s) => {
          const cleared = storyProgress >= s.id;
          const locked = s.id > storyProgress + 1;
          return (
            <button
              key={s.id}
              onClick={() => !locked && setPicker(s)}
              disabled={locked}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                locked
                  ? "cursor-not-allowed border-slate-800 bg-slate-900/40 opacity-60"
                  : "border-slate-700/60 bg-slate-800/70 hover:border-amber-500/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {cleared ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Check className="h-4 w-4" />
                  </span>
                ) : locked ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                    {s.id}
                  </span>
                )}
                <div>
                  <p className="text-sm font-bold text-slate-100">{s.name}</p>
                  <p className="text-[11px] text-slate-400">
                    vs {s.enemy.name} ({s.enemy.element})
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          );
        })}
      </div>
    </div>
  );
}