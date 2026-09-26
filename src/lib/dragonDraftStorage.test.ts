import { afterEach, describe, expect, it, vi } from "vitest";
import {
  archiveDragonDraft,
  createEmptyDragonDraft,
  deleteDragonDraft,
  DRAGON_DRAFT_MAX_IMAGE_BYTES,
  dragonArchiveKey,
  dragonDraftKey,
  loadDragonArchive,
  loadDragonDraft,
  saveDragonDraft,
  validateDragonDraft,
  selectedDragonDrawing,
  type DragonDraft,
} from "./dragonDraftStorage";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER = "22222222-2222-4222-8222-222222222222";
const DRAGON = "33333333-3333-4333-8333-333333333333";
const DRAFT = "44444444-4444-4444-8444-444444444444";
const OTHER_DRAFT = "55555555-5555-4555-8555-555555555555";

function draft(overrides: Partial<DragonDraft> = {}): DragonDraft {
  return { ...createEmptyDragonDraft(OWNER), draftId: DRAFT, updatedAt: 1000, ...overrides };
}

function drawing(text = "drawing") {
  return new Blob([text], { type: "image/png" });
}

/**
 * Narrow async transaction double, not a browser IndexedDB conformance test.
 * It checks commit/abort handling and application invariants without new dependencies.
 */
function installDatabaseDouble() {
  const data = new Map<string, Map<string, unknown>>();
  let failNextCommit = false;
  type RequestDouble = {
    result?: unknown;
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    onupgradeneeded?: (() => void) | null;
    onblocked?: (() => void) | null;
  };
  const database = {
    close() {},
    onversionchange: null,
    objectStoreNames: { contains: (name: string) => data.has(name) },
    createObjectStore: (name: string) => data.set(name, new Map()),
    transaction(storeNames: string[], mode: IDBTransactionMode) {
      const working = new Map(storeNames.map((name) => [name, new Map(data.get(name))]));
      let pending = 0;
      let aborted = false;
      let completed = false;
      let completionTimer: ReturnType<typeof setTimeout> | undefined;
      const transaction = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        abort() {
          if (aborted || completed) return;
          aborted = true;
          clearTimeout(completionTimer);
          queueMicrotask(() => transaction.onabort?.());
        },
        objectStore(name: string) {
          const rows = working.get(name)!;
          function request(action: () => unknown): RequestDouble {
            const result: RequestDouble = { onsuccess: null, onerror: null };
            pending += 1;
            clearTimeout(completionTimer);
            setTimeout(() => {
              if (aborted) return;
              try {
                result.result = action();
                result.onsuccess?.();
              } catch {
                result.onerror?.();
                transaction.onerror?.();
                transaction.abort();
              } finally {
                pending -= 1;
                scheduleCompletion();
              }
            }, 0);
            return result;
          }
          return {
            get: (key: string) => request(() => structuredClone(rows.get(key))),
            put: (value: unknown, key: string) =>
              request(() => rows.set(key, structuredClone(value))),
            add: (value: unknown, key: string) =>
              request(() => {
                if (rows.has(key)) throw new Error("ConstraintError");
                rows.set(key, structuredClone(value));
                return key;
              }),
            delete: (key: string) => request(() => rows.delete(key)),
          };
        },
      };
      function scheduleCompletion() {
        if (aborted || completed || pending > 0) return;
        completionTimer = setTimeout(() => {
          if (aborted || pending > 0) return;
          if (mode === "readwrite" && failNextCommit) {
            failNextCommit = false;
            transaction.abort();
            return;
          }
          if (mode === "readwrite") {
            for (const [name, rows] of working) data.set(name, rows);
          }
          completed = true;
          transaction.oncomplete?.();
        }, 0);
      }
      scheduleCompletion();
      return transaction;
    },
  };
  vi.stubGlobal("indexedDB", {
    open() {
      const request: RequestDouble = { result: database, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        if (data.size === 0) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  });
  return {
    data,
    abortNextCommit: () => {
      failNextCommit = true;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("dragon draft validation", () => {
  it("creates an account-scoped versioned draft with resumable defaults", () => {
    const value = createEmptyDragonDraft(OWNER);
    expect(value).toMatchObject({
      schemaVersion: 2,
      ownerId: OWNER,
      step: 1,
      element: "Earth",
      appearanceId: "pearl",
      personality: "용감한",
      creationAttemptedAt: null,
      createdDragonUuid: null,
    });
    expect(validateDragonDraft(value, OWNER)).toEqual(value);
    expect(value.draftId).not.toEqual(createEmptyDragonDraft(OWNER).draftId);
  });

  it("uses unambiguous account-specific keys and normalizes UUID casing", () => {
    const letterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(dragonDraftKey(letterId.toUpperCase())).toBe(letterId);
    expect(dragonDraftKey(OWNER)).not.toBe(dragonDraftKey(OTHER_OWNER));
    expect(dragonArchiveKey(OWNER, DRAGON)).not.toBe(dragonArchiveKey(OTHER_OWNER, DRAGON));
    expect(() => dragonDraftKey("owner:another-owner")).toThrow();
    expect(() => dragonArchiveKey(OWNER, "dragon-name")).toThrow();
  });

  it("rejects other owners and removes unknown payload properties", () => {
    expect(() => validateDragonDraft(draft(), OTHER_OWNER)).toThrow("다른 계정");
    const value = validateDragonDraft({ ...draft(), accessToken: "not-stored" }, OWNER);
    expect(value).not.toHaveProperty("accessToken");
  });

  it.each([
    null,
    [],
    { schemaVersion: 3 },
    { step: 4 },
    { element: "Storm" },
    { name: "a".repeat(41) },
    { appearanceId: "" },
    { updatedAt: Number.NaN },
    { updatedAt: -1 },
    { creationAttemptedAt: Number.POSITIVE_INFINITY },
    { creationAttemptedAt: 0 },
    { createdDragonUuid: "not-a-uuid" },
    { draftId: "not-a-uuid" },
    { selectedImage: "other" },
  ])("rejects corrupt or unsupported draft data: %j", (patch) => {
    expect(() =>
      validateDragonDraft(
        patch === null || Array.isArray(patch) ? patch : { ...draft(), ...patch },
        OWNER,
      ),
    ).toThrow();
  });

  it("rejects cleaned selection without its image and a cleaned image without its original", () => {
    expect(() => validateDragonDraft(draft({ selectedImage: "cleaned" }), OWNER)).toThrow();
    expect(() => validateDragonDraft(draft({ cleanedImage: drawing() }), OWNER)).toThrow();
  });

  it("accepts original and cleaned versions without discarding either", () => {
    const value = draft({
      originalImage: drawing("original"),
      cleanedImage: drawing("cleaned"),
      selectedImage: "cleaned",
    });
    expect(validateDragonDraft(value, OWNER)).toEqual(value);
  });

  it("upgrades existing version-one drafts and archives without changing their artwork", () => {
    const legacy = {
      ...draft({
        originalImage: drawing("old original"),
        cleanedImage: drawing("old AI"),
        selectedImage: "cleaned",
      }),
      schemaVersion: 1,
    };
    const { preparedImage: _unused, ...stored } = legacy;
    const upgraded = validateDragonDraft(stored, OWNER);
    expect(upgraded.schemaVersion).toBe(2);
    expect(upgraded.preparedImage).toBeNull();
    expect(upgraded.originalImage).toBe(legacy.originalImage);
    expect(selectedDragonDrawing(upgraded)).toBe(legacy.cleanedImage);
  });

  it("requires an original and a valid prepared blob for a prepared selection", () => {
    expect(() => validateDragonDraft(draft({ selectedImage: "prepared" }), OWNER)).toThrow();
    expect(() => validateDragonDraft(draft({ preparedImage: drawing() }), OWNER)).toThrow();
    expect(() =>
      validateDragonDraft(
        draft({
          originalImage: drawing(),
          preparedImage: new Blob(["bad"], { type: "text/plain" }),
        }),
        OWNER,
      ),
    ).toThrow();
  });

  it("selects the exact original, prepared or AI version for card upload and AI input", () => {
    const originalImage = drawing("original");
    const preparedImage = drawing("cropped");
    const cleanedImage = drawing("AI");
    const versions = { original: originalImage, prepared: preparedImage, cleaned: cleanedImage };
    for (const selectedImage of ["original", "prepared", "cleaned"] as const) {
      const value = validateDragonDraft(
        draft({ originalImage, preparedImage, cleanedImage, selectedImage }),
        OWNER,
      );
      expect(selectedDragonDrawing(value)).toBe(versions[selectedImage]);
    }
  });

  it("rejects empty, unsupported, oversized, and non-Blob images", () => {
    for (const originalImage of [
      new Blob([], { type: "image/png" }),
      new Blob(["<svg/>"], { type: "image/svg+xml" }),
      new Blob([new Uint8Array(DRAGON_DRAFT_MAX_IMAGE_BYTES + 1)], { type: "image/png" }),
      { type: "image/png", size: 100 },
    ]) {
      expect(() => validateDragonDraft({ ...draft(), originalImage }, OWNER)).toThrow();
    }
    expect(
      validateDragonDraft(
        draft({
          originalImage: new Blob([new Uint8Array(DRAGON_DRAFT_MAX_IMAGE_BYTES)], {
            type: "image/webp",
          }),
        }),
        OWNER,
      ).originalImage?.size,
    ).toBe(DRAGON_DRAFT_MAX_IMAGE_BYTES);
  });
});

describe("dragon draft persistence (transaction double)", () => {
  it("fails explicitly when IndexedDB is unavailable, then lets later calls recover", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(saveDragonDraft(draft())).rejects.toThrow("사용할 수 없습니다");
    await expect(loadDragonDraft(OWNER)).rejects.toThrow("사용할 수 없습니다");
    await expect(deleteDragonDraft(OWNER, DRAFT)).rejects.toThrow("사용할 수 없습니다");
    await expect(archiveDragonDraft(draft(), DRAGON)).rejects.toThrow("사용할 수 없습니다");
    installDatabaseDouble();
    await expect(saveDragonDraft(draft())).resolves.toBeUndefined();
  });

  it("round-trips actual Blob bytes and isolates owners", async () => {
    installDatabaseDouble();
    await saveDragonDraft(draft({ name: "별이", originalImage: drawing("my own drawing") }));
    const restored = await loadDragonDraft(OWNER);
    expect(restored?.name).toBe("별이");
    expect(await restored?.originalImage?.text()).toBe("my own drawing");
    expect(await loadDragonDraft(OTHER_OWNER)).toBeNull();
    await saveDragonDraft(draft({ ownerId: OTHER_OWNER, name: "다른 그림" }));
    expect((await loadDragonDraft(OWNER))?.name).toBe("별이");
    expect((await loadDragonDraft(OTHER_OWNER))?.name).toBe("다른 그림");
  });

  it("serializes writes and reads, and snapshots values before queued work starts", async () => {
    installDatabaseDouble();
    const first = draft({ name: "처음" });
    const savingFirst = saveDragonDraft(first);
    first.name = "외부 변경";
    const savingSecond = saveDragonDraft(draft({ name: "마지막", updatedAt: 2000 }));
    const reading = loadDragonDraft(OWNER);
    await Promise.all([savingFirst, savingSecond]);
    expect((await reading)?.name).toBe("마지막");
    await expect(saveDragonDraft(draft({ name: "오래된 변경" }))).rejects.toThrow("더 최근");
    expect((await loadDragonDraft(OWNER))?.name).toBe("마지막");
  });

  it("does not let a different draft overwrite the active draft or let old cleanup erase it", async () => {
    installDatabaseDouble();
    await saveDragonDraft(draft());
    await expect(saveDragonDraft(draft({ draftId: OTHER_DRAFT }))).rejects.toThrow("더 최근");
    expect(await deleteDragonDraft(OWNER, OTHER_DRAFT)).toBe(false);
    expect(await deleteDragonDraft(OTHER_OWNER, DRAFT)).toBe(false);
    expect(await deleteDragonDraft(OWNER, DRAFT)).toBe(true);
    await saveDragonDraft(draft({ draftId: OTHER_DRAFT }));
    expect(await deleteDragonDraft(OWNER, DRAFT)).toBe(false);
    expect((await loadDragonDraft(OWNER))?.draftId).toBe(OTHER_DRAFT);
  });

  it("keeps attempted and confirmed creation checkpoints sticky", async () => {
    installDatabaseDouble();
    await saveDragonDraft(draft({ creationAttemptedAt: 1000 }));
    await expect(saveDragonDraft(draft({ updatedAt: 2000 }))).rejects.toThrow("더 최근");
    await expect(
      saveDragonDraft(draft({ creationAttemptedAt: 2000, updatedAt: 2000 })),
    ).rejects.toThrow("더 최근");
    await saveDragonDraft(
      draft({ creationAttemptedAt: 1000, createdDragonUuid: DRAGON, updatedAt: 2000 }),
    );
    await expect(
      saveDragonDraft(draft({ creationAttemptedAt: 1000, updatedAt: 3000 })),
    ).rejects.toThrow("더 최근");
    expect((await loadDragonDraft(OWNER))?.createdDragonUuid).toBe(DRAGON);
  });

  it("does not report success on a transaction that aborts after a write request", async () => {
    const database = installDatabaseDouble();
    database.abortNextCommit();
    await expect(saveDragonDraft(draft())).rejects.toThrow("저장에 실패");
    expect(await loadDragonDraft(OWNER)).toBeNull();
  });

  it("rejects corrupted persisted records and never silently overwrites them", async () => {
    const database = installDatabaseDouble();
    await saveDragonDraft(draft());
    database.data.get("active")!.set(OWNER, { ...draft(), schemaVersion: 99 });
    await expect(loadDragonDraft(OWNER)).rejects.toThrow("올바르지 않습니다");
    await expect(saveDragonDraft(draft())).rejects.toThrow("올바르지 않습니다");
    database.data.get("active")!.set(OWNER, draft({ ownerId: OTHER_OWNER }));
    await expect(loadDragonDraft(OWNER)).rejects.toThrow("다른 계정");
  });

  it("restores and archives original, prepared and AI bytes independently", async () => {
    installDatabaseDouble();
    const value = draft({
      originalImage: drawing("original"),
      preparedImage: drawing("cropped and rotated"),
      cleanedImage: drawing("cleaned"),
      selectedImage: "prepared",
      creationAttemptedAt: 1000,
      createdDragonUuid: DRAGON,
    });
    await saveDragonDraft(value);
    const restored = await loadDragonDraft(OWNER);
    expect(await selectedDragonDrawing(restored!)?.text()).toBe("cropped and rotated");
    await archiveDragonDraft(value, DRAGON);
    expect(await loadDragonDraft(OWNER)).not.toBeNull();
    await deleteDragonDraft(OWNER, DRAFT);
    const archived = await loadDragonArchive(OWNER, DRAGON);
    expect(archived?.createdDragonUuid).toBe(DRAGON);
    expect(await archived?.originalImage?.text()).toBe("original");
    expect(await archived?.preparedImage?.text()).toBe("cropped and rotated");
    expect(await archived?.cleanedImage?.text()).toBe("cleaned");
    expect(await loadDragonArchive(OTHER_OWNER, DRAGON)).toBeNull();
  });

  it("makes repeated archive IDs idempotent only for the same draft, without replacing originals", async () => {
    installDatabaseDouble();
    await archiveDragonDraft(draft({ name: "원본", originalImage: drawing("first") }), DRAGON);
    const again = await archiveDragonDraft(
      draft({ name: "수정본", originalImage: drawing("replacement") }),
      DRAGON,
    );
    expect(again.name).toBe("원본");
    expect(await again.originalImage?.text()).toBe("first");
    await expect(archiveDragonDraft(draft({ draftId: OTHER_DRAFT }), DRAGON)).rejects.toThrow(
      "이미 다른",
    );
    await expect(
      archiveDragonDraft(draft({ createdDragonUuid: OTHER_DRAFT }), DRAGON),
    ).rejects.toThrow("이미 다른");
    expect((await loadDragonArchive(OWNER, DRAGON))?.draftId).toBe(DRAFT);
  });

  it("rejects an archive row stored under the wrong dragon UUID", async () => {
    const database = installDatabaseDouble();
    await archiveDragonDraft(draft(), DRAGON);
    database.data
      .get("archive")!
      .set(dragonArchiveKey(OWNER, DRAGON), draft({ createdDragonUuid: OTHER_DRAFT }));
    await expect(loadDragonArchive(OWNER, DRAGON)).rejects.toThrow("올바르지 않습니다");
  });
});
