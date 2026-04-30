import { useState } from "react";
import { BookOpen, ChevronRight, Lock, Check, Trophy, Coins, Package, Sparkles, Gift } from "lucide-react";
import { useGameStore, type Dragon, type RewardDrop } from "@/store/dragons";
import { BattleEngine } from "../battle/BattleEngine";

const stages: { id: number; name: string; enemy: Dragon; reward: RewardDrop }[] = [
  {
    id: 1,
    name: "Stage 1 — 고대의 숲",
    enemy: { id: 101, name: "Rooten", element: "Earth", hp: 70, maxHp: 70, mp: 40, atk: 55, def: 35 },
    reward: {
      gold: 120,
      items: [
        { name: "체력 물약", kind: "consumable", quantity: 2 },
        { name: "나무껍질 방패", kind: "equipment", quantity: 1 },
      ],
    },
  },
  {
    id: 2,
    name: "Stage 2 — 화염 협곡",
    enemy: { id: 102, name: "Blaze", element: "Fire", hp: 60, maxHp: 60, mp: 60, atk: 78, def: 25 },
    reward: {
      gold: 220,
      items: [
        { name: "마나 결정", kind: "consumable", quantity: 3 },
        { name: "화염 룬", kind: "equipment", quantity: 1 },
      ],
    },
  },
  {
    id: 3,
    name: "Stage 3 — 강철 동굴",
    enemy: { id: 103, name: "Ironclaw", element: "Wood", hp: 80, maxHp: 80, mp: 50, atk: 70, def: 60 },
    reward: {
      gold: 380,
      items: [
        { name: "강철 비늘 갑옷", kind: "equipment", quantity: 1 },
        { name: "고급 체력 물약", kind: "consumable", quantity: 2 },
      ],
    },
  },
];

export function StoryView() {
  const dragons = useGameStore((s) => s.dragons);
  const storyProgress = useGameStore((s) => s.storyProgress);
  const clearedStages = useGameStore((s) => s.clearedStages);
  const clearStage = useGameStore((s) => s.clearStage);
  const addReward = useGameStore((s) => s.addReward);
  const [stage, setStage] = useState<(typeof stages)[number] | null>(null);
  const [picker, setPicker] = useState<(typeof stages)[number] | null>(null);
  const [player, setPlayer] = useState<Dragon | null>(null);
  const [lastResult, setLastResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [earnedReward, setEarnedReward] = useState<RewardDrop | null>(null);
  const [firstClear, setFirstClear] = useState(false);

  if (stage && player) {
    if (lastResult === "win" && earnedReward) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/15 to-amber-500/5 p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
              <Gift className="h-7 w-7" />
            </div>
            <h3 className="mt-3 text-lg font-bold text-amber-200">
              {firstClear ? "스테이지 첫 클리어!" : "전투 승리!"}
            </h3>
            <p className="text-xs text-slate-400">
              {firstClear ? "보상을 획득했습니다." : "재도전 보상을 획득했습니다."}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500">획득한 보상</p>
            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Coins className="h-4 w-4" /> 골드
              </span>
              <span className="font-mono text-sm font-bold text-amber-300">+{earnedReward.gold}</span>
            </div>
            {earnedReward.items.map((it) => (
              <div
                key={it.name}
                className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-2.5"
              >
                <span className="flex items-center gap-2 text-sm">
                  {it.kind === "equipment" ? (
                    <Sparkles className="h-4 w-4 text-sky-400" />
                  ) : (
                    <Package className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="font-semibold text-slate-100">{it.name}</span>
                  <span className="text-[10px] uppercase text-slate-500">{it.kind}</span>
                </span>
                <span className="font-mono text-sm text-slate-300">×{it.quantity}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const nextStage = stages.find((s) => s.id === stage.id + 1) ?? null;
              setStage(null);
              setPlayer(null);
              setLastResult(null);
              setEarnedReward(null);
              setFirstClear(false);
              if (nextStage) setPicker(nextStage);
            }}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
          >
            {stages.find((s) => s.id === stage.id + 1) ? "다음 스테이지로" : "확인"}
          </button>
        </div>
      );
    }
    return (
      <BattleEngine
        player={player}
        enemy={stage.enemy}
        context="story"
        onResolved={(outcome) => {
          setLastResult(outcome);
          if (outcome === "win") {
            const isFirst = !clearedStages.includes(stage.id);
            // First clear gives full reward, replays give half gold and no items
            const reward: RewardDrop = isFirst
              ? stage.reward
              : { gold: Math.floor(stage.reward.gold / 2), items: [] };
            clearStage(stage.id, isFirst ? stage.reward : undefined);
            addReward(reward);
            setEarnedReward(reward);
            setFirstClear(isFirst);
          }
        }}
        onExit={() => {
          setStage(null);
          setPlayer(null);
          setLastResult(null);
          setEarnedReward(null);
          setFirstClear(false);
        }}
      />
    );
  }

  if (picker) {
    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">{picker.name}</p>
        <h2 className="text-xl font-bold text-slate-100">출전할 드래곤 선택</h2>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-amber-400/80">예상 보상</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 font-semibold text-amber-300">
              <Coins className="h-3 w-3" /> {picker.reward.gold} G
            </span>
            {picker.reward.items.map((it) => (
              <span
                key={it.name}
                className="flex items-center gap-1 rounded-md bg-slate-800/70 px-2 py-1 text-slate-300"
              >
                {it.kind === "equipment" ? (
                  <Sparkles className="h-3 w-3 text-sky-400" />
                ) : (
                  <Package className="h-3 w-3 text-emerald-400" />
                )}
                {it.name} ×{it.quantity}
              </span>
            ))}
          </div>
          {clearedStages.includes(picker.id) && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              ※ 재도전 시 골드 50%만 획득, 아이템은 첫 클리어 한정
            </p>
          )}
        </div>
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