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
  /**
   * 사용자 업로드 이미지(절대경로, 예: "/Ain.jpg"). 지정 시 모든 곳에서
   * 우선적으로 사용된다. 누락/로드 실패 시 기존 webp/그라디언트 폴백.
   */
  imageUrl?: string;
}

export type View = "lobby" | "story" | "pvp" | "vault" | "admin";

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
  // ===== My Vault & 3:3 Tag Battle =====
  /** 보유/스캔한 모든 드래곤 ID 풀. 기본은 시드 드래곤 전체. */
  ownedDragonIds: number[];
  /** 출전 덱 — 정확히 3마리일 때만 PvP 진입 가능. 순서 = 출전 순서. */
  selectedDeck: number[];
  /** 매칭 시 생성된 적 AI 덱 (3마리). */
  enemyDeck: number[];
  /** Vault에서 카드 토글 (선택/해제). 3마리 초과 선택은 무시. */
  toggleDeckMember: (id: number) => void;
  clearDeck: () => void;
  setEnemyDeck: (ids: number[]) => void;
  // ===== Admin / Custom Dragons =====
  /** localStorage에 저장되는 사용자 정의 드래곤 (lore 포함). */
  customDragons: (Dragon & { lore?: string; isCustom: true })[];
  addCustomDragon: (d: Omit<Dragon, "id"> & { lore?: string }) => void;
  removeCustomDragon: (id: number) => void;
  updateCustomDragon: (id: number, patch: Partial<Omit<Dragon, "id">> & { lore?: string }) => void;
}

const CUSTOM_KEY = "customDragons";

function loadCustomDragons(): (Dragon & { lore?: string; isCustom: true })[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((d) => ({ ...d, isCustom: true as const }));
  } catch {
    return [];
  }
}

function persistCustomDragons(list: (Dragon & { lore?: string; isCustom: true })[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

const BASE_DRAGONS: Dragon[] = [
  { id: 1, name: "Elia",     element: "Water", maxHp: 1300, hp: 1300, mp: 1300, atk: 1200, def: 1200, image: elia480,     imageLarge: elia800,     imageUrl: "/Ain.jpg" },
  { id: 2, name: "Bella",    element: "Water", maxHp: 1000, hp: 1000, mp: 1000, atk: 2000, def: 1000, image: bella480,    imageLarge: bella800,    imageUrl: "/Ajin.jpg" },
  { id: 3, name: "Comi",     element: "Light", maxHp: 1500, hp: 1500, mp: 1000, atk: 1500, def: 1000, image: comi480,     imageLarge: comi800,     imageUrl: "/Comi.jpg" },
  { id: 4, name: "Snowy",    element: "Water", maxHp: 2000, hp: 2000, mp: 1100, atk: 1100, def: 800,  image: snowy480,    imageLarge: snowy800,    imageUrl: "/Sua.jpg" },
  { id: 5, name: "Caminont", element: "Dark",  maxHp: 770,  hp: 770,  mp: 190,  atk: 3850, def: 190,  image: caminont480, imageLarge: caminont800, imageUrl: "/Yisul.jpg" },
  { id: 6, name: "Younigon", element: "Fire",  maxHp: 2000, hp: 2000, mp: 400,  atk: 1600, def: 1000, image: younigon480, imageLarge: younigon800, imageUrl: "/Younigon.jpg" },
  { id: 7, name: "Puri",     element: "Wood",  maxHp: 1500, hp: 1500, mp: 1000, atk: 1300, def: 1200, imageUrl: "/image_9b1c9b.png" },
  { id: 8, name: "Spike",    element: "Water", maxHp: 1400, hp: 1400, mp: 900,  atk: 1500, def: 1200, imageUrl: "/image_9b19b0.png" },
];

const INITIAL_CUSTOM = loadCustomDragons();
const INITIAL_DRAGONS: Dragon[] = [...BASE_DRAGONS, ...INITIAL_CUSTOM];
const INITIAL_OWNED = INITIAL_DRAGONS.map((d) => d.id);

export const useGameStore = create<GameState>((set) => ({
  dragons: INITIAL_DRAGONS,
  customDragons: INITIAL_CUSTOM,
  addCustomDragon: (d) =>
    set((state) => {
      const nextId = state.dragons.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      const created = { ...d, id: nextId, isCustom: true as const };
      const customs = [...state.customDragons, created];
      persistCustomDragons(customs);
      return {
        customDragons: customs,
        dragons: [...state.dragons, created],
        ownedDragonIds: [...state.ownedDragonIds, nextId],
      };
    }),
  removeCustomDragon: (id) =>
    set((state) => {
      const customs = state.customDragons.filter((d) => d.id !== id);
      persistCustomDragons(customs);
      return {
        customDragons: customs,
        dragons: state.dragons.filter((d) => d.id !== id),
        ownedDragonIds: state.ownedDragonIds.filter((x) => x !== id),
        selectedDeck: state.selectedDeck.filter((x) => x !== id),
      };
    }),
  updateCustomDragon: (id, patch) =>
    set((state) => {
      if (!state.customDragons.some((d) => d.id === id)) return {};
      const customs = state.customDragons.map((d) =>
        d.id === id ? { ...d, ...patch, id: d.id, isCustom: true as const } : d,
      );
      persistCustomDragons(customs);
      const dragons = state.dragons.map((d) =>
        d.id === id ? { ...d, ...patch, id: d.id } : d,
      );
      return { customDragons: customs, dragons };
    }),
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
  ownedDragonIds: INITIAL_OWNED,
  selectedDeck: [],
  enemyDeck: [],
  toggleDeckMember: (id) =>
    set((state) => {
      if (state.selectedDeck.includes(id)) {
        return { selectedDeck: state.selectedDeck.filter((x) => x !== id) };
      }
      if (state.selectedDeck.length >= 3) return {};
      return { selectedDeck: [...state.selectedDeck, id] };
    }),
  clearDeck: () => set({ selectedDeck: [] }),
  setEnemyDeck: (ids) => set({ enemyDeck: ids }),
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