import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyDragonDraft,
  deleteDragonDraft,
  loadDragonDraft,
  saveDragonDraft,
  type DragonDraft,
} from "@/lib/dragonDraftStorage";

/** Local-only autosave: each edit is queued immediately, including before unmount. */
export function useDragonDraft(ownerId: string) {
  const [draft, setDraft] = useState<DragonDraft | null>(null);
  const [status, setStatus] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const current = useRef<DragonDraft | null>(null);
  const alive = useRef(false);
  const revision = useRef(0);
  const loadRevision = useRef(0);

  const reload = useCallback(async () => {
    const request = ++loadRevision.current;
    setStatus("loading");
    setError(null);
    try {
      const saved = await loadDragonDraft(ownerId);
      if (!alive.current || request !== loadRevision.current) return;
      const next = saved ?? createEmptyDragonDraft(ownerId);
      // Never write defaults until the existing account-specific record was read.
      if (!saved) await saveDragonDraft(next);
      if (!alive.current || request !== loadRevision.current) return;
      current.current = next;
      setDraft(next);
      setRestored(!!saved);
      setStatus("saved");
    } catch {
      if (!alive.current || request !== loadRevision.current) return;
      setError(
        "이 브라우저에서 초안을 읽지 못했습니다. 저장소 권한·용량을 확인하고 다시 열어 주세요. 기존 초안은 덮어쓰지 않았습니다.",
      );
      setStatus("error");
    }
  }, [ownerId]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
      loadRevision.current += 1;
    };
  }, [ownerId, reload]);

  const checkpoint = useCallback(
    async (next: DragonDraft) => {
      if (next.ownerId !== ownerId)
        throw new Error("제작 계정이 변경되었습니다. 다시 열어 주세요.");
      const request = ++revision.current;
      current.current = next;
      // A confirmed server UUID must still reach the original owner's local
      // checkpoint if navigation/unmount happened while the request was in flight.
      if (alive.current) {
        setDraft(next);
        setStatus("saving");
        setError(null);
      }
      try {
        await saveDragonDraft(next);
        if (alive.current && request === revision.current) setStatus("saved");
      } catch {
        if (alive.current && request === revision.current) {
          setStatus("error");
          setError(
            "초안을 저장하지 못했습니다. 현재 입력은 화면에 남아 있습니다. 저장 공간을 확인한 뒤 다시 저장해 주세요.",
          );
        }
        throw new Error(
          "초안 저장에 실패했습니다. 저장 확인 전에는 드래곤 생성을 진행하지 않습니다.",
        );
      }
    },
    [ownerId],
  );

  const updateDraft = useCallback(
    (patch: Partial<DragonDraft>) => {
      const previous = current.current;
      if (!alive.current || !previous || previous.createdDragonUuid || previous.creationAttemptedAt)
        return;
      const next = {
        ...previous,
        ...patch,
        ownerId,
        draftId: previous.draftId,
        updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
      };
      void checkpoint(next).catch(() => undefined);
    },
    [checkpoint, ownerId],
  );

  const retrySave = useCallback(async () => {
    if (current.current) await checkpoint(current.current);
  }, [checkpoint]);

  const clear = useCallback(
    async (completed: DragonDraft) => {
      await deleteDragonDraft(ownerId, completed.draftId);
      // No autosave effect can recreate the draft after this guarded deletion.
    },
    [ownerId],
  );

  const discard = useCallback(async () => {
    const previous = current.current;
    if (!previous || previous.creationAttemptedAt || previous.createdDragonUuid) return;
    await deleteDragonDraft(ownerId, previous.draftId);
    if (!alive.current) return;
    const next = createEmptyDragonDraft(ownerId);
    await checkpoint(next);
    setRestored(false);
  }, [checkpoint, ownerId]);

  return {
    draft,
    status,
    error,
    restored,
    updateDraft,
    checkpoint,
    reload,
    retrySave,
    clear,
    discard,
  };
}
