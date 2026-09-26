import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DragonDraft } from "./dragonDraftStorage";
import {
  completePersonalDragonCreation,
  PersonalDragonCreationError,
  UNCERTAIN_CREATION_MESSAGE,
} from "./personalDragonCreation";

const DRAGON_UUID = "33333333-3333-4333-8333-333333333333";
const IMAGE_URL = "https://example.test/personal-dragon.jpg";

function draftFixture(overrides: Partial<DragonDraft> = {}): DragonDraft {
  return {
    schemaVersion: 1,
    ownerId: "11111111-1111-4111-8111-111111111111",
    draftId: "22222222-2222-4222-8222-222222222222",
    updatedAt: 1000,
    step: 3,
    name: "루미",
    element: "Earth",
    personality: "용감한",
    goal: "친구를 지키기",
    origin: "성의 알 보관실에서 만났다.",
    appearanceId: "pearl",
    distinctiveFeatures: "작은 별 모양 무늬",
    originalImage: new Blob(["original drawing"], { type: "image/png" }),
    cleanedImage: null,
    selectedImage: "original",
    creationAttemptedAt: null,
    createdDragonUuid: null,
    ...overrides,
  };
}

function harness(draft = draftFixture()) {
  const state = {
    active: draft as DragonDraft | null,
    calls: [] as string[],
    checkpoints: [] as DragonDraft[],
  };
  const deps = {
    checkpoint: vi.fn(async (next: DragonDraft) => {
      state.calls.push("checkpoint");
      state.checkpoints.push(next);
      state.active = next;
    }),
    upload: vi.fn(async (_draft: DragonDraft) => {
      state.calls.push("upload");
      return IMAGE_URL;
    }),
    create: vi.fn(async (_draft: DragonDraft, _imageUrl: string) => {
      state.calls.push("create");
      return DRAGON_UUID;
    }),
    archive: vi.fn(async (_draft: DragonDraft, _uuid: string) => {
      state.calls.push("archive");
    }),
    refreshAndResolve: vi.fn(async (_uuid: string) => {
      state.calls.push("refresh");
      return 17;
    }),
    clear: vi.fn(async (_draft: DragonDraft) => {
      state.calls.push("clear");
      state.active = null;
    }),
  };
  return { state, deps };
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("personal dragon creation checkpoints", () => {
  it("persists attempt and UUID before archiving, refreshing, and clearing", async () => {
    const draft = draftFixture();
    const { deps, state } = harness(draft);

    expect(await completePersonalDragonCreation(draft, deps)).toBe(17);
    expect(state.calls).toEqual([
      "upload",
      "checkpoint",
      "create",
      "checkpoint",
      "archive",
      "refresh",
      "clear",
    ]);
    const [attempt, confirmed] = state.checkpoints;
    expect(attempt).toMatchObject({
      creationAttemptedAt: 1000,
      createdDragonUuid: null,
      updatedAt: 1001,
    });
    expect(confirmed).toMatchObject({
      creationAttemptedAt: 1000,
      createdDragonUuid: DRAGON_UUID,
      updatedAt: 1002,
    });
    expect(deps.create).toHaveBeenCalledExactlyOnceWith(attempt, IMAGE_URL);
    expect(deps.archive).toHaveBeenCalledExactlyOnceWith(confirmed, DRAGON_UUID);
    expect(deps.refreshAndResolve).toHaveBeenCalledExactlyOnceWith(DRAGON_UUID);
    expect(deps.clear).toHaveBeenCalledExactlyOnceWith(confirmed);
    expect(confirmed.originalImage).toBe(draft.originalImage);
    expect(draft.creationAttemptedAt).toBeNull();
    expect(draft.createdDragonUuid).toBeNull();
    expect(state.active).toBeNull();
  });

  it("keeps update revisions increasing even when the clock moves backwards", async () => {
    vi.mocked(Date.now).mockReturnValue(900);
    const { deps, state } = harness();
    await completePersonalDragonCreation(draftFixture(), deps);
    expect(state.checkpoints.map((value) => value.updatedAt)).toEqual([1001, 1002]);
    expect(state.checkpoints[0].creationAttemptedAt).toBe(900);
  });

  it("permits a retry if upload failed before any creation attempt", async () => {
    const draft = draftFixture();
    const { deps, state } = harness(draft);
    deps.upload.mockRejectedValueOnce(new Error("upload offline"));
    await expect(completePersonalDragonCreation(draft, deps)).rejects.toThrow("upload offline");
    expect(deps.checkpoint).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.clear).not.toHaveBeenCalled();
    expect(state.active?.creationAttemptedAt).toBeNull();

    await expect(completePersonalDragonCreation(state.active!, deps)).resolves.toBe(17);
    expect(deps.upload).toHaveBeenCalledTimes(2);
    expect(deps.create).toHaveBeenCalledTimes(1);
  });

  it("does not call creation if its attempt checkpoint cannot be persisted", async () => {
    const { deps } = harness();
    deps.checkpoint.mockRejectedValueOnce(new Error("storage quota"));
    await expect(completePersonalDragonCreation(draftFixture(), deps)).rejects.toThrow(
      "storage quota",
    );
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.archive).not.toHaveBeenCalled();
    expect(deps.clear).not.toHaveBeenCalled();
  });

  it("retains the uncertain checkpoint when a creation response is lost and blocks retry", async () => {
    const { deps, state } = harness();
    deps.create.mockRejectedValueOnce(new Error("response lost after commit"));
    await expect(completePersonalDragonCreation(draftFixture(), deps)).rejects.toMatchObject({
      code: "uncertain_creation",
      message: UNCERTAIN_CREATION_MESSAGE,
    });
    expect(state.active).toMatchObject({
      createdDragonUuid: null,
      creationAttemptedAt: 1000,
    });
    await expect(completePersonalDragonCreation(state.active!, deps)).rejects.toThrow(
      UNCERTAIN_CREATION_MESSAGE,
    );
    expect(deps.upload).toHaveBeenCalledTimes(1);
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(deps.checkpoint).toHaveBeenCalledTimes(1);
    expect(deps.archive).not.toHaveBeenCalled();
    expect(deps.clear).not.toHaveBeenCalled();
  });

  it.each(["", "not-a-uuid", null, undefined, 42])(
    "treats malformed creation response %s as uncertain without clearing its checkpoint",
    async (result) => {
      const { deps, state } = harness();
      deps.create.mockResolvedValueOnce(result as unknown as string);
      await expect(completePersonalDragonCreation(draftFixture(), deps)).rejects.toBeInstanceOf(
        PersonalDragonCreationError,
      );
      expect(state.active?.creationAttemptedAt).toBe(1000);
      expect(state.active?.createdDragonUuid).toBeNull();
      expect(deps.checkpoint).toHaveBeenCalledTimes(1);
      expect(deps.archive).not.toHaveBeenCalled();
      expect(deps.clear).not.toHaveBeenCalled();
    },
  );

  it("does not finalize if persistence of the returned UUID fails", async () => {
    const { deps, state } = harness();
    deps.checkpoint.mockImplementation(async (next) => {
      if (next.createdDragonUuid) throw new Error("checkpoint interrupted");
      state.active = next;
    });
    await expect(completePersonalDragonCreation(draftFixture(), deps)).rejects.toThrow(
      "checkpoint interrupted",
    );
    expect(state.active?.creationAttemptedAt).toBe(1000);
    expect(deps.archive).not.toHaveBeenCalled();
    expect(deps.clear).not.toHaveBeenCalled();
    await expect(completePersonalDragonCreation(state.active!, deps)).rejects.toThrow(
      UNCERTAIN_CREATION_MESSAGE,
    );
    expect(deps.create).toHaveBeenCalledTimes(1);
  });

  it("resumes a confirmed UUID without uploading, creating, or replacing the checkpoint", async () => {
    const draft = draftFixture({ creationAttemptedAt: 900, createdDragonUuid: DRAGON_UUID });
    const { deps, state } = harness(draft);
    await expect(completePersonalDragonCreation(draft, deps)).resolves.toBe(17);
    expect(state.calls).toEqual(["archive", "refresh", "clear"]);
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.checkpoint).not.toHaveBeenCalled();
    expect(deps.archive).toHaveBeenCalledExactlyOnceWith(draft, DRAGON_UUID);
  });

  it.each(["archive", "refreshAndResolve"] as const)(
    "keeps the confirmed UUID when %s fails and resumes without duplicate creation",
    async (stage) => {
      const { deps, state } = harness();
      deps[stage].mockRejectedValueOnce(new Error("retry finalization"));
      await expect(completePersonalDragonCreation(draftFixture(), deps)).rejects.toThrow(
        "retry finalization",
      );
      expect(state.active?.createdDragonUuid).toBe(DRAGON_UUID);
      expect(deps.clear).not.toHaveBeenCalled();

      await expect(completePersonalDragonCreation(state.active!, deps)).resolves.toBe(17);
      expect(deps.upload).toHaveBeenCalledTimes(1);
      expect(deps.create).toHaveBeenCalledTimes(1);
      expect(deps.checkpoint).toHaveBeenCalledTimes(2);
      expect(deps.clear).toHaveBeenCalledTimes(1);
    },
  );

  it("distinguishes local cleanup failure from failed cloud creation", async () => {
    const { deps, state } = harness();
    deps.clear.mockRejectedValueOnce(new Error("delete failed"));
    await expect(completePersonalDragonCreation(draftFixture(), deps)).rejects.toMatchObject({
      code: "draft_cleanup_failed",
    });
    expect(state.active?.createdDragonUuid).toBe(DRAGON_UUID);
    await expect(completePersonalDragonCreation(state.active!, deps)).resolves.toBe(17);
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(deps.upload).toHaveBeenCalledTimes(1);
  });

  it("blocks a previously attempted unconfirmed draft before any dependency runs", async () => {
    const { deps, state } = harness();
    await expect(
      completePersonalDragonCreation(draftFixture({ creationAttemptedAt: 999 }), deps),
    ).rejects.toThrow(UNCERTAIN_CREATION_MESSAGE);
    expect(state.calls).toEqual([]);
  });

  it("rejects corrupt confirmed UUIDs without running dependencies or starting over", async () => {
    const { deps, state } = harness();
    await expect(
      completePersonalDragonCreation(draftFixture({ createdDragonUuid: "17" }), deps),
    ).rejects.toMatchObject({ code: "invalid_saved_uuid" });
    expect(state.calls).toEqual([]);
  });
});
