import { describe, expect, it } from "vitest";
import { meetsRequires, visibleOptions } from "./storyChoices";
import type { VnOption } from "@/store/storyEngine";

const opt = (label: string, requires?: Record<string, number>): VnOption => ({
  label,
  next_node: label,
  requires: requires ?? null,
});

describe("meetsRequires", () => {
  it("passes with no gate", () => {
    expect(meetsRequires(null, {})).toBe(true);
  });
  it("compares each stat against its threshold", () => {
    expect(meetsRequires({ Courage: 10 }, { Courage: 10 })).toBe(true);
    expect(meetsRequires({ Courage: 10 }, { Courage: 9 })).toBe(false);
    expect(meetsRequires({ Courage: 10, Social: 5 }, { Courage: 20 })).toBe(false);
  });
});

describe("visibleOptions", () => {
  const ending = [
    opt("master", { Worm_Affinity: 60 }),
    opt("alone", { Independence: 30 }),
    opt("lost"),
  ];

  it("leaves ungated nodes untouched", () => {
    const plain = [opt("a"), opt("b")];
    expect(visibleOptions(plain, {})).toEqual(plain);
  });

  it("offers only the earned ending", () => {
    expect(visibleOptions(ending, { Worm_Affinity: 70 }).map((o) => o.label)).toEqual(["master"]);
    expect(visibleOptions(ending, { Independence: 40 }).map((o) => o.label)).toEqual(["alone"]);
  });

  it("falls back to the unconditional ending", () => {
    expect(visibleOptions(ending, { Worm_Affinity: 5 }).map((o) => o.label)).toEqual(["lost"]);
  });
});
