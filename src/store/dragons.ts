import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/i18n";

export type Element = "Wood" | "Water" | "Fire" | "Earth" | "Light" | "Dark";

export interface Dragon {
  /** Stable in-memory numeric id assigned at fetch time; used by deck/PvP/battle systems. */
  id: number;
  /** Authoritative cloud UUID (Supabase row id). Optional for transient/local-only entries. */
  uuid?: string;
  /** True for the original 8 hard-coded dragons (read-only for non-admins). */
  isSeed?: boolean;
  /** True if not a seed (= user-uploaded). */
  isCustom?: boolean;
  /** Author user id (auth.uid()). Null for seeds. */
  createdBy?: string | null;
  lore?: string;
  name: string;
  element: Element;
  hp: number;
  maxHp: number;
  mp: number;
  atk: number;
  def: number;
  /** Public Storage URL (Supabase). Optional — falls back to gradient placeholder. */
  imageUrl?: string;
  /** Training progression — server-managed via RPC. */
  level?: number;
  exp?: number;
  statPoints?: number;
  /** Shared (global) base stats before per-player `owned_dragons` bonuses. */
  base?: { maxHp: number; mp: number; atk: number; def: number };
}

export type View = "lobby" | "story" | "pvp" | "vault" | "shop" | "training" | "admin" | "debug";

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
  /** True while the initial cloud fetch is in flight. */
  loadingDragons: boolean;
  /** Last load error message (null on success). */
  loadError: string | null;
  /** Fetches the dragons list from Supabase and replaces local state. */
  fetchDragons: () => Promise<void>;
  addDragon: (d: Omit<Dragon, "id" | "uuid">) => void;
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
  // ===== Admin / Custom Dragons (cloud-backed) =====
  /** Derived view of cloud dragons authored by users (non-seed). */
  customDragons: Dragon[];
  /** Inserts a new dragon into Supabase, then re-fetches. Throws on failure. */
  addCustomDragon: (d: Omit<Dragon, "id" | "uuid"> & { lore?: string }) => Promise<void>;
  /** Bulk insert. Used by the Admin grid upload flow. */
  addCustomDragonsBulk: (dragons: (Omit<Dragon, "id" | "uuid"> & { lore?: string })[]) => Promise<void>;
  /** Admin-only delete (RLS enforces). */
  removeCustomDragon: (id: number) => Promise<void>;
  /** Admin-only update (RLS enforces). */
  updateCustomDragon: (
    id: number,
    patch: Partial<Omit<Dragon, "id" | "uuid">> & { lore?: string },
  ) => Promise<void>;
}

/**
 * Maps a Supabase row to a client Dragon. We assign a stable in-memory
 * numeric id (incrementing per fetch) so the rest of the app — battle
 * engine, deck picker, debug view — keeps using `number` ids unchanged.
 * The cloud `uuid` is kept on the object for cloud writes.
 */
type DragonRow = {
  id: string;
  name: string;
  element: string;
  max_hp: number;
  mp: number;
  atk: number;
  def: number;
  image_url: string | null;
  lore: string | null;
  is_seed: boolean;
  created_by: string | null;
};

function rowToDragon(row: DragonRow, numericId: number): Dragon {
  const element = (row.element as Element) ?? "Water";
  return {
    id: numericId,
    uuid: row.id,
    name: row.name,
    element,
    maxHp: row.max_hp,
    hp: row.max_hp,
    mp: row.mp,
    atk: row.atk,
    def: row.def,
    imageUrl: row.image_url ?? undefined,
    lore: row.lore ?? undefined,
    isSeed: row.is_seed,
    isCustom: !row.is_seed,
    createdBy: row.created_by,
    // Growth lives per player in `owned_dragons`; defaults until merged below.
    level: 1,
    exp: 0,
    statPoints: 0,
    base: { maxHp: row.max_hp, mp: row.mp, atk: row.atk, def: row.def },
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  dragons: [],
  customDragons: [],
  loadingDragons: true,
  loadError: null,
  fetchDragons: async () => {
    set({ loadingDragons: true, loadError: null });
    const { data, error } = await supabase
      .from("dragons")
      .select("*")
      .order("is_seed", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[dragons] fetch failed:", error);
      set({ loadingDragons: false, loadError: error.message });
      toast.error(i18n.t("errors.dragonLoadFailed", { msg: error.message }));
      return;
    }
    const rows = (data ?? []) as DragonRow[];
    let dragons = rows.map((r, i) => rowToDragon(r, i + 1));

    // Growth is stored per player in `owned_dragons`; merge the caller's
    // own progression/bonuses on top of the shared base stats.
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (uid) {
      const { data: owned } = await supabase
        .from("owned_dragons")
        .select("dragon_id, level, exp, stat_points, bonus_atk, bonus_max_hp, bonus_def, bonus_mp")
        .eq("user_id", uid);
      const byDragon = new Map(
        (owned ?? []).map((o) => [o.dragon_id as string, o]),
      );
      dragons = dragons.map((d) => {
        const g = d.uuid ? byDragon.get(d.uuid) : undefined;
        if (!g) return { ...d, level: 1, exp: 0, statPoints: 0 };
        const maxHp = d.maxHp + (g.bonus_max_hp ?? 0);
        return {
          ...d,
          maxHp,
          hp: maxHp,
          atk: d.atk + (g.bonus_atk ?? 0),
          def: d.def + (g.bonus_def ?? 0),
          mp: d.mp + (g.bonus_mp ?? 0),
          level: g.level ?? 1,
          exp: g.exp ?? 0,
          statPoints: g.stat_points ?? 0,
        };
      });
    }

    const customs = dragons.filter((d) => !d.isSeed);
    set({
      dragons,
      customDragons: customs,
      loadingDragons: false,
      loadError: null,
      ownedDragonIds: dragons.map((d) => d.id),
    });

  },
  addCustomDragon: async (d) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error(i18n.t("errors.loginRequired"));
      throw new Error("not authenticated");
    }
    const { error } = await supabase.from("dragons").insert({
      name: d.name,
      element: d.element,
      max_hp: d.maxHp,
      mp: d.mp,
      atk: d.atk,
      def: d.def,
      image_url: d.imageUrl ?? null,
      lore: d.lore ?? null,
      is_seed: false,
      created_by: uid,
    });
    if (error) {
      console.error("[dragons] insert failed:", error);
      toast.error(i18n.t("errors.registerFailed", { msg: error.message }));
      throw error;
    }
    await get().fetchDragons();
  },
  addCustomDragonsBulk: async (list) => {
    if (list.length === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error(i18n.t("errors.loginRequired"));
      throw new Error("not authenticated");
    }
    const rows = list.map((d) => ({
      name: d.name,
      element: d.element,
      max_hp: d.maxHp,
      mp: d.mp,
      atk: d.atk,
      def: d.def,
      image_url: d.imageUrl ?? null,
      lore: d.lore ?? null,
      is_seed: false,
      created_by: uid,
    }));
    const { error } = await supabase.from("dragons").insert(rows);
    if (error) {
      console.error("[dragons] bulk insert failed:", error);
      toast.error(i18n.t("errors.bulkSaveFailed", { msg: error.message }));
      throw error;
    }
    await get().fetchDragons();
  },
  removeCustomDragon: async (id) => {
    const target = get().dragons.find((d) => d.id === id);
    if (!target || !target.uuid) return;
    const { error } = await supabase.from("dragons").delete().eq("id", target.uuid);
    if (error) {
      console.error("[dragons] delete failed:", error);
      toast.error(i18n.t("errors.deleteFailedAdmin", { msg: error.message }));
      throw error;
    }
    await get().fetchDragons();
  },
  updateCustomDragon: async (id, patch) => {
    const target = get().dragons.find((d) => d.id === id);
    if (!target || !target.uuid) return;
    const update: {
      name?: string;
      element?: string;
      max_hp?: number;
      mp?: number;
      atk?: number;
      def?: number;
      image_url?: string | null;
      lore?: string | null;
    } = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.element !== undefined) update.element = patch.element;
    if (patch.maxHp !== undefined) update.max_hp = patch.maxHp;
    if (patch.mp !== undefined) update.mp = patch.mp;
    if (patch.atk !== undefined) update.atk = patch.atk;
    if (patch.def !== undefined) update.def = patch.def;
    if (patch.imageUrl !== undefined) update.image_url = patch.imageUrl ?? null;
    if (patch.lore !== undefined) update.lore = patch.lore ?? null;
    const { error } = await supabase.from("dragons").update(update).eq("id", target.uuid);
    if (error) {
      console.error("[dragons] update failed:", error);
      toast.error(i18n.t("errors.updateFailedAdmin", { msg: error.message }));
      throw error;
    }
    await get().fetchDragons();
  },
  addDragon: (d) =>
    set((state) => {
      const id = state.dragons.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      return { dragons: [...state.dragons, { ...d, id, uuid: `local-${id}` }] };
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
  ownedDragonIds: [],
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