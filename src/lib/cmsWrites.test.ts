import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertCmsRow, type CmsTable } from "./cmsWrites";

const db = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));

beforeEach(() => {
  vi.resetAllMocks();
  db.from.mockReturnValue({ insert: db.insert });
  db.insert.mockReturnValue({ select: db.select });
  db.select.mockReturnValue({ single: db.single });
});

describe("CMS insert dispatch", () => {
  const tables: CmsTable[] = [
    "store_items",
    "story_nodes",
    "training_stats",
    "game_settings",
    "characters",
    "bgm_tracks",
    "battle_skills",
    "combat_items",
    "dragon_pool",
  ];
  it.each(tables)("inserts into %s without altering the payload", async (table) => {
    const row = { id: "draft", description: "한글 내용" };
    const result = { data: row, error: null };
    db.single.mockResolvedValue(result);
    expect(await insertCmsRow(table, row)).toBe(result);
    expect(db.from).toHaveBeenCalledExactlyOnceWith(table);
    expect(db.insert).toHaveBeenCalledExactlyOnceWith(row);
    expect(db.select).toHaveBeenCalledExactlyOnceWith();
  });

  it("preserves database errors for the mutation to report", async () => {
    const result = { data: null, error: { message: "permission denied", code: "42501" } };
    db.single.mockResolvedValue(result);
    expect(await insertCmsRow("story_nodes", {})).toBe(result);
  });
});
