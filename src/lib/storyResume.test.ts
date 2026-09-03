import { describe, expect, it } from "vitest";
import { resolveResume } from "./storyResume";

const ALL = ["Node_1", "Node_2", "Node_3"] as const;

describe("resolveResume — publish / unpublish transitions keep the saved Node_ value", () => {
  it("waits while the save is loading", () => {
    expect(
      resolveResume({ saveLoading: true, publishedKeys: ALL, startKey: "Node_1", save: null }),
    ).toEqual({ kind: "loading" });
  });

  it("starts at the chapter start when there is no save", () => {
    expect(
      resolveResume({ saveLoading: false, publishedKeys: ALL, startKey: "Node_1", save: null }),
    ).toEqual({ kind: "start", nodeKey: "Node_1" });
  });

  it("resumes the exact saved node while the chapter is public", () => {
    expect(
      resolveResume({
        saveLoading: false,
        publishedKeys: ALL,
        startKey: "Node_1",
        save: { nodeKey: "Node_2" },
      }),
    ).toEqual({ kind: "resume", nodeKey: "Node_2" });
  });

  it("blocks (never restarts) when the saved node becomes unpublished", () => {
    const decision = resolveResume({
      saveLoading: false,
      publishedKeys: ["Node_1", "Node_3"],
      startKey: "Node_1",
      save: { nodeKey: "Node_2" },
    });
    expect(decision).toEqual({ kind: "blocked", nodeKey: "Node_2" });
    // The saved value must survive: it is echoed back, not replaced by the start node.
    expect(decision.kind === "blocked" && decision.nodeKey).toBe("Node_2");
  });

  it("shows the empty-chapter screen when everything is unpublished", () => {
    expect(
      resolveResume({
        saveLoading: false,
        publishedKeys: [],
        startKey: null,
        save: { nodeKey: "Node_2" },
      }),
    ).toEqual({ kind: "empty" });
  });

  it("round-trips public -> private -> public with the same Node_ value", () => {
    const save = { nodeKey: "Node_2" };
    const publicKeys = [...ALL];
    const privateKeys = ["Node_1", "Node_3"];

    expect(
      resolveResume({ saveLoading: false, publishedKeys: publicKeys, startKey: "Node_1", save }),
    ).toEqual({ kind: "resume", nodeKey: "Node_2" });

    expect(
      resolveResume({ saveLoading: false, publishedKeys: privateKeys, startKey: "Node_1", save }),
    ).toEqual({ kind: "blocked", nodeKey: "Node_2" });

    // Republished: resume lands back on Node_2, not Node_1.
    expect(
      resolveResume({ saveLoading: false, publishedKeys: publicKeys, startKey: "Node_1", save }),
    ).toEqual({ kind: "resume", nodeKey: "Node_2" });
    expect(save.nodeKey).toBe("Node_2");
  });

  it("does not resume a finished run", () => {
    expect(
      resolveResume({
        saveLoading: false,
        publishedKeys: ALL,
        startKey: "Node_1",
        save: { nodeKey: null, finished: true },
      }),
    ).toEqual({ kind: "start", nodeKey: "Node_1" });
  });
});
