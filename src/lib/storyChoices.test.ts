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

describe("dragon_master four-ending gate", () => {
  const endings = [
    opt("two", { Path_Group: 1, Worm_Affinity: 55 }),
    opt("master", { Worm_Affinity: 60 }),
    opt("alone", { Independence: 35 }),
    opt("lost"),
  ];

  it("unlocks The Two Masters only for a group run with high affinity", () => {
    const labels = visibleOptions(endings, { Path_Group: 1, Worm_Affinity: 70 }).map((o) => o.label);
    expect(labels).toContain("two");
  });

  it("hides The Two Masters on a solo run", () => {
    const labels = visibleOptions(endings, { Path_Alone: 1, Worm_Affinity: 70 }).map((o) => o.label);
    expect(labels).not.toContain("two");
    expect(labels).toContain("master");
  });

  it("still ends the chapter when nothing is earned", () => {
    expect(visibleOptions(endings, { Worm_Affinity: 10 }).map((o) => o.label)).toEqual(["lost"]);
  });
});
