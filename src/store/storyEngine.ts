import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Data-driven visual-novel engine state.
 *
 * The client knows NOTHING about the story's shape: every branch, label and
 * stat mutation comes from `story_nodes.options` (JSON) in the database, so
 * UGC authors can publish new chapters without any code change.
 *
 * Structure is "foldback": several options may point at the same `next_node`,
 * which converges branches back onto a shared spine.
 */
export interface VnOption {
  /** Button label shown to the player. */
  label: string;
  /** `node_key` of the node to render next. Empty/null = chapter ends. */
  next_node?: string | null;
  /** Arbitrary stat deltas, e.g. { Worm_Affinity: 2, Courage: 1 }. */
  state_changes?: Record<string, number> | null;
  /** Quiz ids linked to this choice — solved before moving on. */
  quiz_ids?: string[];
  /** How many random quizzes to ask when no ids are given (0 = none). */
  quiz_count?: number;
  /** When true, a wrong answer does NOT advance to `next_node`. */
  quiz_required?: boolean;
  /** Node to go to when the quiz is failed (falls back to staying put). */
  quiz_fail_node?: string | null;
  /**
   * Stat gates, e.g. { Worm_Affinity: 60 }. The choice is only offered when
   * every listed stat is at or above its threshold. Used for branching endings.
   */
  requires?: Record<string, number> | null;
}


export interface VnNode {
  id: string;
  chapter_id: string;
  node_key: string | null;
  title: string;
  speaker: string | null;
  body_text: string | null;
  description: string | null;
  background_image_url: string | null;
  options: VnOption[];
  state_changes: Record<string, number> | null;
  is_start: boolean;
  stage_number: number;
  /** Authored rewards granted on first visit (gold / stat points / items). */
  rewards?: { gold?: number; stat_points?: number; items?: Record<string, number> } | null;
}

export type VnStats = Record<string, number>;

interface VnRunState {
  chapterId: string | null;
  /** Current node_key. */
  nodeKey: string | null;
  stats: VnStats;
  visited: string[];
  /** node_keys whose on-enter state_changes were already applied. */
  applied: string[];
  finished: boolean;
}

interface VnStore extends VnRunState {
  start: (chapterId: string, startKey: string, opts?: { reset?: boolean }) => void;
  /** Apply an option: merge its state_changes and move to next_node. */
  choose: (option: VnOption) => void;
  /** Apply a node's on-enter state_changes (idempotent per node). */
  enter: (node: VnNode) => void;
  /** Replace the run with a snapshot loaded from the cloud save. */
  hydrate: (snapshot: VnRunState) => void;
  reset: () => void;
}


const EMPTY: VnRunState = {
  chapterId: null,
  nodeKey: null,
  stats: {},
  visited: [],
  applied: [],
  finished: false,
};

function addStats(base: VnStats, delta?: Record<string, number> | null): VnStats {
  if (!delta) return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(delta)) {
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    next[key] = (next[key] ?? 0) + value;
  }
  return next;
}

export const useStoryEngine = create<VnStore>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      start: (chapterId, startKey, opts) => {
        const state = get();
        const resume =
          !opts?.reset && state.chapterId === chapterId && state.nodeKey && !state.finished;
        if (resume) return;
        set({
          chapterId,
          nodeKey: startKey,
          stats: {},
          visited: [startKey],
          applied: [],
          finished: false,
        });
      },

      enter: (node) => {
        const key = node.node_key;
        if (!key) return;
        set((s) =>
          s.applied.includes(key)
            ? s
            : {
                ...s,
                applied: [...s.applied, key],
                stats: addStats(s.stats, node.state_changes),
              },
        );
      },

      choose: (option) => {
        set((s) => {
          const stats = addStats(s.stats, option.state_changes);
          const next = option.next_node ?? null;
          if (!next) return { ...s, stats, finished: true };
          return {
            ...s,
            stats,
            nodeKey: next,
            finished: false,
            visited: s.visited.includes(next) ? s.visited : [...s.visited, next],
          };
        });
      },

      hydrate: (snapshot) => set({ ...snapshot }),

      reset: () => set({ ...EMPTY }),

    }),
    { name: "story.vn.run", version: 1 },
  ),
);
