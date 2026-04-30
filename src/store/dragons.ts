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

export type ItemKind = "equipment" | "consumable";
export interface InventoryItem {
  id: string;
  name: string;
  kind: ItemKind;
  quantity: number;
}

export interface RewardDrop {
  gold: number;
  items: { name: string; kind: ItemKind; quantity: number }[];
}

interface GameState {
  dragons: Dragon[];
  addDragon: (d: Omit<Dragon, "id">) => void;
  setDragons: (dragons: Dragon[]) => void;
  view: View;
  setView: (v: View) => void;
  storyProgress: number; // highest cleared stage id (0 = none)
  clearedStages: number[];
  stageRewards: Record<number, RewardDrop>; // first-clear rewards by stage id
  clearStage: (stageId: number, reward?: RewardDrop) => void;
  gold: number;
  inventory: InventoryItem[];
  addReward: (reward: RewardDrop) => void;
  pvpRecords: PvpRecord[];
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
  recordPvp: (r: Omit<PvpRecord, "id" | "timestamp">) => void;
  // Globally selected dragon for PvP. Single source of truth shared by
  // LobbyView (tap-to-highlight), PvpView matchmaking/picker (currently
  // chosen entrant), and the post-battle handoff. `null` means no dragon
  // is currently picked for PvP.
  pvpSelectedDragonId: number | null;
  setPvpSelectedDragonId: (id: number | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  dragons: [
    { id: 1, name: "Puri", element: "Wood", hp: 60, maxHp: 60, mp: 50, atk: 40, def: 50 },
    { id: 2, name: "Spike", element: "Water", hp: 50, maxHp: 50, mp: 90, atk: 80, def: 20 },
    { id: 3, name: "Bella", element: "Water", hp: 40, maxHp: 40, mp: 80, atk: 75, def: 35 },
  ],
  addDragon: (d) =>
    set((state) => {
      const id = state.dragons.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      return { dragons: [...state.dragons, { ...d, id }] };
    }),
  setDragons: (dragons) => set({ dragons }),
  view: "lobby",
  setView: (view) => set({ view }),
  storyProgress: 0,
  clearedStages: [],
  stageRewards: {},
  gold: 1250,
  inventory: [],
  clearStage: (stageId, reward) =>
    set((state) => {
      const alreadyCleared = state.clearedStages.includes(stageId);
      const cleared = alreadyCleared ? state.clearedStages : [...state.clearedStages, stageId];
      const stageRewards =
        reward && !alreadyCleared
          ? { ...state.stageRewards, [stageId]: reward }
          : state.stageRewards;
      return {
        storyProgress: Math.max(state.storyProgress, stageId),
        clearedStages: cleared,
        stageRewards,
      };
    }),
  addReward: (reward) =>
    set((state) => {
      const inventory = [...state.inventory];
      for (const drop of reward.items) {
        const idx = inventory.findIndex((i) => i.name === drop.name);
        if (idx >= 0) {
          inventory[idx] = { ...inventory[idx], quantity: inventory[idx].quantity + drop.quantity };
        } else {
          inventory.push({
            id: `${drop.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: drop.name,
            kind: drop.kind,
            quantity: drop.quantity,
          });
        }
      }
      return { gold: state.gold + reward.gold, inventory };
    }),
  pvpRecords: [],
  pvpWins: 0,
  pvpLosses: 0,
  pvpDraws: 0,
  pvpSelectedDragonId: null,
  setPvpSelectedDragonId: (id) => set({ pvpSelectedDragonId: id }),
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