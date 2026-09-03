import { describe, expect, it } from "vitest";
import {
  clearUgcProgress,
  loadUgcProgress,
  resolveUgcProgress,
  saveUgcProgress,
  ugcProgressKey,
} from "./ugcProgress";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const base = {
  nodeKey: "Node_5",
  finished: false,
  stats: { courage: 2 },
  picked: 1,
  quizResult: "correct" as const,
};

describe("ugcProgress", () => {
  it("round-trips the last node and quiz result", () => {
    const s = memoryStorage();
    saveUgcProgress("story-1", base, s);
    const loaded = loadUgcProgress("story-1", s);
    expect(loaded).toMatchObject(base);
    expect(loaded!.updatedAt).toBeTypeOf("number");
  });

  it("scopes progress per story id", () => {
    const s = memoryStorage();
    saveUgcProgress("story-1", base, s);
    expect(loadUgcProgress("story-2", s)).toBeNull();
    expect(s.map.has(ugcProgressKey("story-1"))).toBe(true);
  });

  it("ignores corrupted payloads", () => {
    const s = memoryStorage();
    s.setItem(ugcProgressKey("story-1"), "{not json");
    expect(loadUgcProgress("story-1", s)).toBeNull();
    s.setItem(ugcProgressKey("story-1"), JSON.stringify({ nodeKey: 7 }));
    expect(loadUgcProgress("story-1", s)).toBeNull();
  });

  it("clears progress on restart", () => {
    const s = memoryStorage();
    saveUgcProgress("story-1", base, s);
    clearUgcProgress("story-1", s);
    expect(loadUgcProgress("story-1", s)).toBeNull();
  });

  it("keeps the saved node when it still exists", () => {
    expect(resolveUgcProgress({ ...base, updatedAt: 1 }, ["Node_1", "Node_5"])).toMatchObject({
      nodeKey: "Node_5",
      quizResult: "correct",
    });
  });

  it("drops progress when the author removed that node", () => {
    expect(resolveUgcProgress({ ...base, updatedAt: 1 }, ["Node_1"])).toBeNull();
  });

  it("restores a finished run", () => {
    expect(
      resolveUgcProgress({ ...base, nodeKey: null, finished: true, updatedAt: 1 }, ["Node_1"]),
    ).toMatchObject({ finished: true });
  });
});
