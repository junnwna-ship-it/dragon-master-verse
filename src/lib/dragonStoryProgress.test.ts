import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  filters: [] as [string, unknown][],
  row: null as Record<string, unknown> | null,
  error: null as null | { code: string; message: string },
  upsert: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          mock.filters.push([key, value]);
          return query;
        },
        maybeSingle: async () => ({ data: mock.row, error: mock.error }),
        upsert: mock.upsert,
        delete: () => {
          mock.delete();
          return query;
        },
        then: (resolve: (result: { error: null }) => void) => resolve({ error: null }),
      };
      return query;
    },
  },
}));

import {
  deleteScopedProgress,
  isMissingProgressTable,
  legacyProgressFromRow,
  readScopedProgress,
  scopedProgressFromRow,
  writeScopedProgress,
} from "./dragonStoryProgress";

const USER = "11111111-1111-4111-8111-111111111111";
const DRAGON = "22222222-2222-4222-8222-222222222222";
const scope = { dragonId: DRAGON, chapterId: "my_dragon", storyVersion: "v1" };
const runId = `my_dragon:${DRAGON}`;
const snapshot = {
  chapterId: runId,
  nodeKey: "meeting",
  stats: { Bond: 2 },
  visited: ["arrival", "meeting"],
  applied: ["arrival"],
  finished: false,
};

beforeEach(() => {
  mock.filters = [];
  mock.row = null;
  mock.error = null;
  mock.upsert.mockReset();
  mock.delete.mockReset();
  mock.upsert.mockResolvedValue({ error: null });
});

describe("dragon-scoped story progress", () => {
  it("reads only the requested user, dragon, chapter and version", async () => {
    mock.row = {
      node_key: "meeting",
      stats: { Bond: 2 },
      visited: ["arrival", "meeting"],
      applied: ["arrival"],
      finished: false,
    };
    const { row, error } = await readScopedProgress(USER, scope);
    expect(error).toBeNull();
    expect(mock.filters).toEqual([
      ["user_id", USER],
      ["dragon_id", DRAGON],
      ["chapter_id", "my_dragon"],
      ["story_version", "v1"],
    ]);
    expect(scopedProgressFromRow(row!, runId)).toEqual(snapshot);
  });

  it("writes and clears only the requested story slot", async () => {
    await writeScopedProgress(USER, scope, snapshot);
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER,
        dragon_id: DRAGON,
        chapter_id: "my_dragon",
        story_version: "v1",
        node_key: "meeting",
      }),
      { onConflict: "user_id,dragon_id,chapter_id,story_version" },
    );
    await deleteScopedProgress(USER, scope);
    expect(mock.delete).toHaveBeenCalledOnce();
    expect(mock.filters.slice(-4)).toEqual([
      ["user_id", USER],
      ["dragon_id", DRAGON],
      ["chapter_id", "my_dragon"],
      ["story_version", "v1"],
    ]);
  });

  it("imports only the matching legacy chapter without losing its run state", () => {
    const legacy = {
      vn_chapter_id: runId,
      vn_node_key: "meeting",
      vn_stats: { Bond: 2 },
      vn_visited: ["arrival", "meeting"],
      vn_applied: ["arrival"],
      vn_finished: false,
    };
    expect(legacyProgressFromRow(legacy, runId)).toEqual(snapshot);
    expect(legacyProgressFromRow(legacy, `my_dragon:${USER}`)).toBeNull();
    expect(legacyProgressFromRow({ ...legacy, vn_node_key: "" }, runId)).toBeNull();
  });

  it("falls back only for a missing table, not permissions or connectivity", () => {
    expect(isMissingProgressTable({ code: "42P01" })).toBe(true);
    expect(isMissingProgressTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingProgressTable({ code: "42501" })).toBe(false);
    expect(isMissingProgressTable(null)).toBe(false);
  });
});
