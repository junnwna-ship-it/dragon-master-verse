import { describe, expect, it } from "vitest";
import { mergeScannedDragons } from "./dragonRoster";
import type { Dragon } from "@/store/dragons";

const dragon = (id: number, uuid?: string): Dragon => ({
  id,
  uuid,
  name: "루미",
  element: "Earth",
  hp: 1750,
  maxHp: 1750,
  mp: 900,
  atk: 1200,
  def: 1550,
});

describe("lobby roster merge", () => {
  it("retains personal dragons beyond the original three seeds", () => {
    const personal = { ...dragon(4, "personal"), imageUrl: "drawing.jpg", lore: "함께 성장해요" };
    expect(mergeScannedDragons([dragon(1, "seed"), personal], [])).toContainEqual(personal);
  });
  it("replaces old legacy scans instead of accumulating duplicates", () => {
    expect(
      mergeScannedDragons([dragon(1), dragon(1000)], [dragon(1000), dragon(1001)]),
    ).toHaveLength(3);
  });
  it("does not collide with cloud ids at or above 1000", () => {
    const result = mergeScannedDragons([dragon(1000, "personal")], [dragon(1000)]);
    expect(result.map((entry) => entry.id)).toEqual([1000, 1001]);
  });
});
