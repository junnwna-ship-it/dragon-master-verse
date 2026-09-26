import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyDragonDraft,
  deleteDragonDraft,
  loadDragonDraft,
  saveDragonDraft,
  type DragonDraft,
} from "@/lib/dragonDraftStorage";
import {
  abandonCloudDraft,
  cloudSchemaAvailable,
  loadCloudDraft,
  saveCloudDraft,
} from "@/lib/dragonCloudStorage";

/** Local-first autosave with an owner-scoped, revision-checked cloud copy. */
export function useDragonDraft(ownerId: string) {
  const [draft, setDraft] = useState<DragonDraft | null>(null);
  const [status, setStatus] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const current = useRef<DragonDraft | null>(null);
  const alive = useRef(false);
  const revision = useRef(0);
  const loadRevision = useRef(0);
  const cloudEnabled = useRef(false);
  const cloudRevision = useRef(0);
  const cloudQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [cloudState, setCloudState] = useState<"local" | "synced" | "error">("local");

  const syncCloud = useCallback((snapshot: DragonDraft): Promise<void> => {
    if (!cloudEnabled.current || snapshot.createdDragonUuid) return Promise.resolve();
    setCloudState("local");
    const task = cloudQueue.current
      .catch(() => undefined)
      .then(async () => {
        const nextRevision = await saveCloudDraft(
          snapshot,
          cloudRevision.current,
          async (partial) => {
            cloudRevision.current = partial;
            if (current.current?.draftId === snapshot.draftId) {
              const amended = { ...current.current, cloudRevision: partial };
              current.current = amended;
              await saveDragonDraft(amended);
              if (alive.current) setDraft(amended);
            }
          },
        );
        cloudRevision.current = nextRevision;
        if (current.current?.draftId === snapshot.draftId) {
          const latest = current.current;
          const acknowledged = {
            ...latest,
            cloudRevision: nextRevision,
            cloudSyncedAt:
              latest.updatedAt === snapshot.updatedAt ? snapshot.updatedAt : latest.cloudSyncedAt,
          };
          current.current = acknowledged;
          await saveDragonDraft(acknowledged);
          if (alive.current) setDraft(acknowledged);
        }
        if (alive.current)
          setCloudState(
            current.current?.updatedAt === current.current?.cloudSyncedAt ? "synced" : "local",
          );
      });
    cloudQueue.current = task;
    return task;
  }, []);

  const reload = useCallback(async () => {
    const request = ++loadRevision.current;
    let saved: DragonDraft | null = null;
    setStatus("loading");
    setError(null);
    try {
      await cloudQueue.current.catch(() => undefined);
      saved = await loadDragonDraft(ownerId);
      const available = await cloudSchemaAvailable();
      const remote = available ? await loadCloudDraft(ownerId) : null;
      if (!alive.current || request !== loadRevision.current) return;
      if (saved && remote && saved.draftId !== remote.draftId)
        throw new Error(
          "다른 기기의 제작 초안이 있습니다. 이 기기의 초안을 보존했습니다. 충돌 해결 전에는 생성을 진행할 수 없습니다.",
        );
      if (
        saved &&
        remote &&
        remote.cloudRevision! > (saved.cloudRevision ?? 0) &&
        saved.updatedAt > (saved.cloudSyncedAt ?? 0)
      )
        throw new Error("두 기기에서 초안이 동시에 수정되었습니다. 이 기기의 초안을 보존했습니다.");
      const next =
        remote && (!saved || remote.cloudRevision! > (saved.cloudRevision ?? 0))
          ? {
              ...remote,
              updatedAt: Math.max(remote.updatedAt, (saved?.updatedAt ?? 0) + 1),
              cloudSyncedAt: Math.max(remote.updatedAt, (saved?.updatedAt ?? 0) + 1),
            }
          : (saved ?? createEmptyDragonDraft(ownerId));
      // Never write defaults until the existing account-specific record was read.
      if (!saved || next !== saved) await saveDragonDraft(next);
      if (!alive.current || request !== loadRevision.current) return;
      cloudEnabled.current = available;
      cloudRevision.current = next.cloudRevision ?? 0;
      current.current = next;
      setDraft(next);
      setRestored(!!saved || !!remote);
      if (
        available &&
        !(next.creationBackend === "cloud" && next.creationAttemptedAt) &&
        (!remote || next.updatedAt > (next.cloudSyncedAt ?? 0))
      ) {
        await syncCloud(next);
      }
      if (!alive.current || request !== loadRevision.current) return;
      setCloudState(
        available && current.current?.updatedAt === current.current?.cloudSyncedAt
          ? "synced"
          : "local",
      );
      setStatus("saved");
    } catch (cause) {
      if (!alive.current || request !== loadRevision.current) return;
      if (saved && !current.current) {
        current.current = saved;
        cloudRevision.current = saved.cloudRevision ?? 0;
        setDraft(saved);
        setRestored(true);
      }
      setCloudState("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "초안을 읽지 못했습니다. 기존 초안은 덮어쓰지 않았습니다.",
      );
      setStatus("error");
    }
  }, [ownerId, syncCloud]);

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
        await syncCloud(next);
        if (alive.current && request === revision.current) setStatus("saved");
      } catch (cause) {
        if (alive.current && request === revision.current) {
          setStatus("error");
          setCloudState("error");
          setError(
            cause instanceof Error
              ? cause.message
              : "초안을 저장하지 못했습니다. 현재 입력은 화면에 남아 있습니다.",
          );
        }
        throw new Error(
          "초안 저장에 실패했습니다. 저장 확인 전에는 드래곤 생성을 진행하지 않습니다.",
        );
      }
    },
    [ownerId, syncCloud],
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
    if (!current.current) return;
    if (!cloudEnabled.current && cloudState === "error") {
      await saveDragonDraft(current.current);
      await reload();
    } else {
      await checkpoint(current.current);
    }
  }, [checkpoint, cloudState, reload]);

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
    await cloudQueue.current.catch(() => undefined);
    if (cloudEnabled.current && cloudRevision.current > 0)
      await abandonCloudDraft(ownerId, previous.draftId);
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
    cloudState,
    cloudEnabled: cloudEnabled.current,
  };
}
