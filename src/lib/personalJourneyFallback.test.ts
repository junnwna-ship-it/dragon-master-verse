import { describe, expect, it } from "vitest";
import { personalJourneyFallback, withPersonalJourneyFallback } from "./personalJourneyFallback";

describe("personal journey fallback", () => {
  it.each(["my_dragon", "dragon_growth"])(
    "provides a complete, reward-free %s chapter only when needed",
    (chapterId) => {
      const nodes = personalJourneyFallback(chapterId);
      const keys = new Set(nodes.map((node) => node.node_key));
      expect(nodes.length).toBeGreaterThanOrEqual(5);
      expect(nodes.filter((node) => node.is_start)).toHaveLength(1);
      expect(nodes[0]?.is_start).toBe(true);
      expect(nodes.some((node) => node.options.some((option) => option.next_node === null))).toBe(
        true,
      );
      for (const node of nodes) {
        expect(node.chapter_id).toBe(chapterId);
        expect(node.rewards).toBeNull();
        expect(node.state_changes).toBeNull();
        expect(node.body_text).toContain("{dragon}");
        for (const option of node.options) {
          if (option.next_node) expect(keys.has(option.next_node)).toBe(true);
          expect(option.state_changes).toBeUndefined();
        }
      }
    },
  );

  it("never supplies a stand-in for the book chapter or user-published chapters", () => {
    expect(personalJourneyFallback("dragon_master")).toEqual([]);
    expect(personalJourneyFallback("custom_story")).toEqual([]);
  });

  it("uses published scenes ahead of built-in scenes", () => {
    const published = [{ ...personalJourneyFallback("my_dragon")[0]!, id: "published:arrival" }];
    expect(withPersonalJourneyFallback("my_dragon", published)).toBe(published);
    expect(withPersonalJourneyFallback("my_dragon", [])).toHaveLength(6);
    expect(withPersonalJourneyFallback("dragon_master", [])).toEqual([]);
  });
});
