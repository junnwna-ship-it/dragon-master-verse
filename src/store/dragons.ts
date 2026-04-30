import { create } from "zustand";

export type Element = "Wood" | "Water" | "Fire" | "Earth" | "Light" | "Dark";

export interface Dragon {
  id: number;
  name: string;
  element: Element;
  hp: number;
  maxHp: number;
  mp: number;
  atk: number;
  def: number;
}

export type View = "lobby" | "story" | "pvp";

export type BattleOutcome = "win" | "lose" | "draw";

export interface PvpRecord {
  id: string;
  playerName: string;
  enemyName: string;
  outcome: BattleOutcome;
  timestamp: number;
}

interface GameState {
  dragons: Dragon[];
  view: View;
  setView: (v: View) => void;
  storyProgress: number; // highest cleared stage id (0 = none)
  clearStage: (stageId: number) => void;
  pvpRecords: PvpRecord[];
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
  recordPvp: (r: Omit<PvpRecord, "id" | "timestamp">) => void;
}

export const useGameStore = create<GameState>((set) => ({
  dragons: [
    { id: 1, name: "Puri", element: "Wood", hp: 60, maxHp: 60, mp: 50, atk: 40, def: 50 },
    { id: 2, name: "Spike", element: "Water", hp: 50, maxHp: 50, mp: 90, atk: 80, def: 20 },
    { id: 3, name: "Bella", element: "Water", hp: 40, maxHp: 40, mp: 80, atk: 75, def: 35 },
  ],
  view: "lobby",
  setView: (view) => set({ view }),
  storyProgress: 0,
  clearStage: (stageId) =>
    set((state) => ({
      storyProgress: Math.max(state.storyProgress, stageId),
    })),
  pvpRecords: [],
  pvpWins: 0,
  pvpLosses: 0,
  pvpDraws: 0,
  recordPvp: (r) =>
    set((state) => {
      const entry: PvpRecord = {
        ...r,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      return {
        pvpRecords: [entry, ...state.pvpRecords].slice(0, 20),
        pvpWins: state.pvpWins + (r.outcome === "win" ? 1 : 0),
        pvpLosses: state.pvpLosses + (r.outcome === "lose" ? 1 : 0),
        pvpDraws: state.pvpDraws + (r.outcome === "draw" ? 1 : 0),
      };
    }),
}));