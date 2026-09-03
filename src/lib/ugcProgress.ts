/**
 * Local persistence for studio (UGC) story playthroughs.
 *
 * The main chapter uses the cloud `story_saves` table, but studio stories are
 * played from the lobby modal, so progress is kept per-browser. This keeps the
 * last node and the quiz result alive across refreshes and back-navigation.
 */
export type UgcProgress = {
  nodeKey: string | null;
  finished: boolean;
  stats: Record<string, number>;
  picked: number | null;
  quizResult: "correct" | "wrong" | null;
  updatedAt: number;
};

export const UGC_PROGRESS_PREFIX = "ugc-story-progress:";

export function ugcProgressKey(storyId: string) {
  return `${UGC_PROGRESS_PREFIX}${storyId}`;
}

type Storageish = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Storageish | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isValidProgress(value: unknown): value is UgcProgress {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<UgcProgress>;
  const keyOk = v.nodeKey === null || typeof v.nodeKey === "string";
  const quizOk = v.quizResult === null || v.quizResult === "correct" || v.quizResult === "wrong";
  const pickedOk = v.picked === null || typeof v.picked === "number";
  const statsOk = !!v.stats && typeof v.stats === "object" && !Array.isArray(v.stats);
  return keyOk && quizOk && pickedOk && statsOk && typeof v.finished === "boolean";
}

export function loadUgcProgress(
  storyId: string | null | undefined,
  storage: Storageish | null = store(),
): UgcProgress | null {
  if (!storyId || !storage) return null;
  try {
    const raw = storage.getItem(ugcProgressKey(storyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveUgcProgress(
  storyId: string | null | undefined,
  progress: Omit<UgcProgress, "updatedAt">,
  storage: Storageish | null = store(),
) {
  if (!storyId || !storage) return;
  try {
    storage.setItem(ugcProgressKey(storyId), JSON.stringify({ ...progress, updatedAt: Date.now() }));
  } catch {
    /* quota / private mode — progress is best effort */
  }
}

export function clearUgcProgress(
  storyId: string | null | undefined,
  storage: Storageish | null = store(),
) {
  if (!storyId || !storage) return;
  try {
    storage.removeItem(ugcProgressKey(storyId));
  } catch {
    /* ignore */
  }
}

/**
 * A saved node must still exist in the story (the author may have rewritten it).
 * Finished runs are always restorable.
 */
export function resolveUgcProgress(
  saved: UgcProgress | null,
  availableKeys: readonly string[],
): UgcProgress | null {
  if (!saved) return null;
  if (saved.finished) return saved;
  if (!saved.nodeKey || !availableKeys.includes(saved.nodeKey)) return null;
  return saved;
}
