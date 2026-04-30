import { create } from "zustand";
// Optimized WebP variants (small for cards, large for the modal hero).
import elia480 from "@/assets/dragons/elia-480.webp";
import elia800 from "@/assets/dragons/elia-800.webp";
import bella480 from "@/assets/dragons/bella-480.webp";
import bella800 from "@/assets/dragons/bella-800.webp";
import comi480 from "@/assets/dragons/comi-480.webp";
import comi800 from "@/assets/dragons/comi-800.webp";
import snowy480 from "@/assets/dragons/snowy-480.webp";
import snowy800 from "@/assets/dragons/snowy-800.webp";
import caminont480 from "@/assets/dragons/caminont-480.webp";
import caminont800 from "@/assets/dragons/caminont-800.webp";
import younigon480 from "@/assets/dragons/younigon-480.webp";
import younigon800 from "@/assets/dragons/younigon-800.webp";

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
  /** ~480px wide WebP — used by the lobby card grid. */
  image?: string;
  /** ~800px wide WebP — used by the detail modal hero. */
  imageLarge?: string;
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
    // Stats taken from the hand-drawn cards, scaled down so the in-game
    // bars (max 100) stay readable: HP/MP /20, ATK/DEF /20.
    { id: 1, name: "Elia",     element: "Water", maxHp: 65,  hp: 65,  mp: 65, atk: 60,  def: 60, image: elia480,     imageLarge: elia800 },
    { id: 2, name: "Bella",    element: "Water", maxHp: 50,  hp: 50,  mp: 50, atk: 100, def: 50, image: bella480,    imageLarge: bella800 },
    { id: 3, name: "Comi",     element: "Light", maxHp: 75,  hp: 75,  mp: 50, atk: 75,  def: 50, image: comi480,     imageLarge: comi800 },
    { id: 4, name: "Snowy",    element: "Water", maxHp: 100, hp: 100, mp: 55, atk: 55,  def: 40, image: snowy480,    imageLarge: snowy800 },
    { id: 5, name: "Caminont", element: "Dark",  maxHp: 20,  hp: 20,  mp: 5,  atk: 100, def: 5,  image: caminont480, imageLarge: caminont800 },
    { id: 6, name: "Younigon", element: "Fire",  maxHp: 100, hp: 100, mp: 20, atk: 80,  def: 50, image: younigon480, imageLarge: younigon800 },
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