/**
 * Pure resume policy for story mode.
 *
 * An admin can unpublish scenes at any time, so the saved `node_key` may not be
 * readable anymore. The rule we must never break: an unreadable save is
 * BLOCKED, never silently restarted — restarting would overwrite the cloud save
 * and lose the player's progress.
 */
export type StorySave = {
  nodeKey: string | null;
  finished?: boolean;
};

export type ResumeDecision =
  | { kind: "loading" }
  /** Whole chapter is unpublished / empty. */
  | { kind: "empty" }
  /** Save points at a scene that is not published right now. */
  | { kind: "blocked"; nodeKey: string }
  /** Safe to continue from the saved scene. */
  | { kind: "resume"; nodeKey: string }
  /** No usable save: begin at the chapter start. */
  | { kind: "start"; nodeKey: string };

export function resolveResume(input: {
  saveLoading: boolean;
  /** node_key values the current viewer can actually read (published ones). */
  publishedKeys: readonly string[];
  startKey: string | null;
  save: StorySave | null | undefined;
}): ResumeDecision {
  const { saveLoading, publishedKeys, startKey, save } = input;
  if (saveLoading) return { kind: "loading" };
  if (!publishedKeys.length) return { kind: "empty" };

  const savedKey = save?.nodeKey ?? null;
  if (savedKey && !save?.finished) {
    if (publishedKeys.includes(savedKey)) return { kind: "resume", nodeKey: savedKey };
    return { kind: "blocked", nodeKey: savedKey };
  }
  if (savedKey && publishedKeys.includes(savedKey)) return { kind: "resume", nodeKey: savedKey };
  if (startKey) return { kind: "start", nodeKey: startKey };
  return { kind: "empty" };
}
