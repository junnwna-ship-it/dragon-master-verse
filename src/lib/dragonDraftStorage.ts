import type { Element } from "@/store/dragons";

/** Browser-local authoring data. Never send these blobs to localStorage. */
export interface DragonDraft {
  schemaVersion: 1;
  ownerId: string;
  draftId: string;
  updatedAt: number;
  step: 1 | 2 | 3;
  name: string;
  element: Element;
  personality: string;
  goal: string;
  origin: string;
  appearanceId: string;
  distinctiveFeatures: string;
  originalImage: Blob | null;
  cleanedImage: Blob | null;
  selectedImage: "original" | "cleaned";
  /** Non-idempotent RPC checkpoint: do not silently retry when its outcome is unknown. */
  creationAttemptedAt: number | null;
  createdDragonUuid: string | null;
}

export const DRAGON_DRAFT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DATABASE_NAME = "dragon-master-personal-drafts";
const ACTIVE_STORE = "active";
const ARCHIVE_STORE = "archive";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ELEMENTS: readonly Element[] = ["Wood", "Water", "Fire", "Earth", "Light", "Dark"];
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const INVALID = "드래곤 임시 저장 데이터가 올바르지 않습니다.";
const WRONG_OWNER = "다른 계정의 드래곤 임시 저장 데이터는 열 수 없습니다.";
const UNAVAILABLE = "이 브라우저에서 드래곤 임시 저장소를 사용할 수 없습니다.";
const STORAGE_FAILED =
  "드래곤 임시 저장에 실패했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.";
const STALE = "더 최근의 드래곤 임시 저장이 있습니다. 다시 불러온 뒤 시도해 주세요.";
const ARCHIVE_CONFLICT = "이 드래곤에는 이미 다른 그림 원본이 보관되어 있습니다.";

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(INVALID);
  return value.toLowerCase();
}

export function dragonDraftKey(ownerId: string): string {
  return uuid(ownerId);
}

export function dragonArchiveKey(ownerId: string, dragonUuid: string): string {
  return `${uuid(ownerId)}:${uuid(dragonUuid)}`;
}

function textField(value: unknown, maxLength: number, allowEmpty = true): string {
  if (typeof value !== "string" || value.length > maxLength || (!allowEmpty && !value.trim())) {
    throw new Error(INVALID);
  }
  return value;
}

function imageBlob(value: unknown): Blob | null {
  if (value === null) return null;
  if (
    typeof Blob === "undefined" ||
    !(value instanceof Blob) ||
    !IMAGE_TYPES.has(value.type) ||
    value.size === 0 ||
    value.size > DRAGON_DRAFT_MAX_IMAGE_BYTES
  ) {
    throw new Error(INVALID);
  }
  return value;
}

/** Reject corrupt, future-version, oversized, or cross-account records without deleting them. */
export function validateDragonDraft(value: unknown, ownerId: string): DragonDraft {
  const expectedOwner = uuid(ownerId);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(INVALID);
  const draft = value as Partial<DragonDraft>;
  const actualOwner = uuid(draft.ownerId);
  if (actualOwner !== expectedOwner) throw new Error(WRONG_OWNER);
  if (
    draft.schemaVersion !== 1 ||
    typeof draft.updatedAt !== "number" ||
    !Number.isSafeInteger(draft.updatedAt) ||
    draft.updatedAt <= 0 ||
    ![1, 2, 3].includes(draft.step ?? 0) ||
    !ELEMENTS.includes(draft.element as Element) ||
    (draft.creationAttemptedAt !== null &&
      (typeof draft.creationAttemptedAt !== "number" ||
        !Number.isSafeInteger(draft.creationAttemptedAt) ||
        draft.creationAttemptedAt <= 0)) ||
    (draft.selectedImage !== "original" && draft.selectedImage !== "cleaned")
  ) {
    throw new Error(INVALID);
  }
  const originalImage = imageBlob(draft.originalImage);
  const cleanedImage = imageBlob(draft.cleanedImage);
  if ((cleanedImage && !originalImage) || (draft.selectedImage === "cleaned" && !cleanedImage)) {
    throw new Error(INVALID);
  }
  return {
    schemaVersion: 1,
    ownerId: actualOwner,
    draftId: uuid(draft.draftId),
    updatedAt: draft.updatedAt,
    step: draft.step as DragonDraft["step"],
    name: textField(draft.name, 40),
    element: draft.element as Element,
    personality: textField(draft.personality, 200),
    goal: textField(draft.goal, 500),
    origin: textField(draft.origin, 2000),
    appearanceId: textField(draft.appearanceId, 80, false),
    distinctiveFeatures: textField(draft.distinctiveFeatures, 2000),
    originalImage,
    cleanedImage,
    selectedImage: draft.selectedImage,
    creationAttemptedAt: draft.creationAttemptedAt,
    createdDragonUuid: draft.createdDragonUuid === null ? null : uuid(draft.createdDragonUuid),
  };
}

export function createEmptyDragonDraft(ownerId: string): DragonDraft {
  const normalizedOwner = uuid(ownerId);
  if (typeof globalThis.crypto?.randomUUID !== "function") throw new Error(UNAVAILABLE);
  return {
    schemaVersion: 1,
    ownerId: normalizedOwner,
    draftId: globalThis.crypto.randomUUID(),
    updatedAt: Date.now(),
    step: 1,
    name: "",
    element: "Earth",
    personality: "용감한",
    goal: "마음을 나누기",
    origin: "성의 알 보관실에서 나와 눈을 맞췄다",
    appearanceId: "pearl",
    distinctiveFeatures: "",
    originalImage: null,
    cleanedImage: null,
    selectedImage: "original",
    creationAttemptedAt: null,
    createdDragonUuid: null,
  };
}

// All calls in this tab observe invocation order, including load-after-save and delete-after-save.
// IndexedDB read/write transactions also serialize against other tabs touching the same stores.
let pendingOperation: Promise<unknown> = Promise.resolve();

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = pendingOperation.then(operation, operation);
  pendingOperation = next.catch(() => undefined);
  return next;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => fail(new Error(UNAVAILABLE)), 10_000);
    function fail(error: Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    }
    try {
      if (typeof globalThis.indexedDB === "undefined") {
        fail(new Error(UNAVAILABLE));
        return;
      }
      const request = globalThis.indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ACTIVE_STORE))
          database.createObjectStore(ACTIVE_STORE);
        if (!database.objectStoreNames.contains(ARCHIVE_STORE))
          database.createObjectStore(ARCHIVE_STORE);
      };
      request.onerror = () => fail(new Error(UNAVAILABLE));
      request.onblocked = () => fail(new Error(UNAVAILABLE));
      request.onsuccess = () => {
        if (finished) {
          request.result.close();
          return;
        }
        finished = true;
        clearTimeout(timer);
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    } catch {
      fail(new Error(UNAVAILABLE));
    }
  });
}

async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  operation: (tx: IDBTransaction, done: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(stores, mode);
      let result: T;
      let hasResult = false;
      let failure: Error | null = null;
      const done = (value: T) => {
        result = value;
        hasResult = true;
      };
      const fail = (error: Error) => {
        failure = error;
        try {
          tx.abort();
        } catch {
          reject(error);
        }
      };
      tx.oncomplete = () => {
        if (hasResult && !failure) resolve(result);
        else reject(failure ?? new Error(STORAGE_FAILED));
      };
      tx.onerror = () => {
        failure ??= new Error(STORAGE_FAILED);
      };
      tx.onabort = () => reject(failure ?? new Error(STORAGE_FAILED));
      try {
        operation(tx, done, fail);
      } catch {
        fail(new Error(STORAGE_FAILED));
      }
    });
  } finally {
    database.close();
  }
}

function readDraft(
  tx: IDBTransaction,
  store: string,
  key: string,
  ownerId: string,
  done: (draft: DragonDraft | null) => void,
  fail: (error: Error) => void,
) {
  const request = tx.objectStore(store).get(key);
  request.onsuccess = () => {
    try {
      done(request.result === undefined ? null : validateDragonDraft(request.result, ownerId));
    } catch (error) {
      fail(error instanceof Error ? error : new Error(INVALID));
    }
  };
}

export function loadDragonDraft(ownerId: string): Promise<DragonDraft | null> {
  return serial(() => {
    const key = dragonDraftKey(ownerId);
    return transaction([ACTIVE_STORE], "readonly", (tx, done, fail) => {
      readDraft(tx, ACTIVE_STORE, key, ownerId, done, fail);
    });
  });
}

/** Resolves only after commit; a stale write never silently replaces newer work. */
export function saveDragonDraft(draft: DragonDraft): Promise<void> {
  // Snapshot at invocation rather than after earlier queued writes complete.
  let snapshot: DragonDraft;
  try {
    snapshot = validateDragonDraft(draft, draft.ownerId);
  } catch (error) {
    return Promise.reject(error);
  }
  return serial(() =>
    transaction([ACTIVE_STORE], "readwrite", (tx, done, fail) => {
      const key = dragonDraftKey(snapshot.ownerId);
      readDraft(
        tx,
        ACTIVE_STORE,
        key,
        snapshot.ownerId,
        (existing) => {
          if (
            existing &&
            (existing.draftId !== snapshot.draftId ||
              existing.updatedAt > snapshot.updatedAt ||
              (existing.creationAttemptedAt !== null &&
                existing.creationAttemptedAt !== snapshot.creationAttemptedAt) ||
              (existing.createdDragonUuid !== null &&
                existing.createdDragonUuid !== snapshot.createdDragonUuid))
          ) {
            fail(new Error(STALE));
            return;
          }
          tx.objectStore(ACTIVE_STORE).put(snapshot, key);
          done(undefined);
        },
        fail,
      );
    }),
  );
}

/** A late cleanup cannot erase another draft that has since become active. */
export function deleteDragonDraft(ownerId: string, draftId: string): Promise<boolean> {
  return serial(() => {
    const key = dragonDraftKey(ownerId);
    const expectedDraft = uuid(draftId);
    return transaction([ACTIVE_STORE], "readwrite", (tx, done, fail) => {
      readDraft(
        tx,
        ACTIVE_STORE,
        key,
        ownerId,
        (existing) => {
          const matches = existing?.draftId === expectedDraft;
          if (matches) tx.objectStore(ACTIVE_STORE).delete(key);
          done(matches);
        },
        fail,
      );
    });
  });
}

/** Immutable per-dragon copy. Does not remove the active draft; navigation decides when to do that. */
export function archiveDragonDraft(draft: DragonDraft, dragonUuid: string): Promise<DragonDraft> {
  let snapshot: DragonDraft;
  let key: string;
  try {
    const createdDragonUuid = uuid(dragonUuid);
    if (draft.createdDragonUuid !== null && uuid(draft.createdDragonUuid) !== createdDragonUuid) {
      throw new Error(ARCHIVE_CONFLICT);
    }
    snapshot = validateDragonDraft({ ...draft, createdDragonUuid }, draft.ownerId);
    key = dragonArchiveKey(snapshot.ownerId, createdDragonUuid);
  } catch (error) {
    return Promise.reject(error);
  }
  return serial(() =>
    transaction([ARCHIVE_STORE], "readwrite", (tx, done, fail) => {
      readDraft(
        tx,
        ARCHIVE_STORE,
        key,
        snapshot.ownerId,
        (existing) => {
          if (existing) {
            if (
              existing.draftId !== snapshot.draftId ||
              existing.createdDragonUuid !== snapshot.createdDragonUuid
            ) {
              fail(new Error(ARCHIVE_CONFLICT));
            } else {
              done(existing);
            }
            return;
          }
          tx.objectStore(ARCHIVE_STORE).add(snapshot, key);
          done(snapshot);
        },
        fail,
      );
    }),
  );
}

export function loadDragonArchive(
  ownerId: string,
  dragonUuid: string,
): Promise<DragonDraft | null> {
  return serial(() => {
    const key = dragonArchiveKey(ownerId, dragonUuid);
    const expectedDragon = uuid(dragonUuid);
    return transaction([ARCHIVE_STORE], "readonly", (tx, done, fail) => {
      readDraft(
        tx,
        ARCHIVE_STORE,
        key,
        ownerId,
        (draft) => {
          if (draft && draft.createdDragonUuid !== expectedDragon) {
            fail(new Error(INVALID));
            return;
          }
          done(draft);
        },
        fail,
      );
    });
  });
}
