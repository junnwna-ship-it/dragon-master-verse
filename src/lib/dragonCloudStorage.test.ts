import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DragonDraft } from "./dragonDraftStorage";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  schemaError: null as null | { code: string; message: string },
  row: null as null | Record<string, unknown>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        limit: async () => ({ error: mock.schemaError }),
        maybeSingle: async () => ({ data: mock.row, error: null }),
      };
      return query;
    },
    rpc: mock.rpc,
    storage: { from: () => ({ upload: mock.upload, list: mock.list, remove: mock.remove }) },
  },
}));

import {
  abandonCloudDraft,
  cloudSchemaAvailable,
  loadCloudDragonArchive,
  saveCloudDraft,
} from "./dragonCloudStorage";

function draft(): DragonDraft {
  return {
    schemaVersion: 2,
    ownerId: "11111111-1111-4111-8111-111111111111",
    draftId: crypto.randomUUID(),
    updatedAt: 1000,
    step: 1,
    name: "루미",
    element: "Earth",
    personality: "용감한",
    goal: "친구를 지키기",
    origin: "알 보관실에서 만났다",
    appearanceId: "pearl",
    distinctiveFeatures: "",
    originalImage: null,
    preparedImage: null,
    cleanedImage: null,
    selectedImage: "original",
    creationAttemptedAt: null,
    createdDragonUuid: null,
  };
}

beforeEach(() => {
  mock.rpc.mockReset();
  mock.upload.mockReset();
  mock.list.mockReset();
  mock.remove.mockReset();
  mock.schemaError = null;
  mock.row = null;
  mock.upload.mockResolvedValue({ error: null });
  mock.list.mockResolvedValue({ data: [], error: null });
  mock.remove.mockResolvedValue({ error: null });
});

describe("private cloud drafts", () => {
  it("falls back only when the new table is absent", async () => {
    mock.schemaError = { code: "PGRST205", message: "missing" };
    await expect(cloudSchemaAvailable()).resolves.toBe(false);
    mock.schemaError = { code: "42501", message: "denied" };
    await expect(cloudSchemaAvailable()).rejects.toThrow("denied");
  });

  it("stores a private drawing once and advances the server revision", async () => {
    let revision = 0;
    mock.rpc.mockImplementation(async (name: string) => {
      if (name === "save_dragon_draft") return { data: ++revision, error: null };
      return { data: null, error: null };
    });
    const image = new Blob(["my dragon"], { type: "image/png" });
    const value = { ...draft(), originalImage: image };
    const intermediate = vi.fn();
    await expect(saveCloudDraft(value, 0, intermediate)).resolves.toBe(2);
    expect(intermediate).toHaveBeenCalledWith(1);
    expect(mock.upload).toHaveBeenCalledTimes(1);
    const path = mock.upload.mock.calls[0][0] as string;
    expect(path).toMatch(
      new RegExp(`^${value.ownerId}/${value.draftId}/original/[0-9a-f]{64}\\.png$`),
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      "register_dragon_asset",
      expect.objectContaining({ _path: path, _draft_id: value.draftId }),
    );
    await expect(saveCloudDraft(value, 2)).resolves.toBe(3);
    expect(mock.upload).toHaveBeenCalledTimes(1);
  });

  it("restores the owner-scoped completed archive when this device has no copy", async () => {
    const value = draft();
    const dragonUuid = "33333333-3333-4333-8333-333333333333";
    mock.row = {
      draft_id: value.draftId,
      owner_id: value.ownerId,
      revision: 4,
      status: "completed",
      dragon_id: dragonUuid,
      metadata: {
        step: value.step,
        name: value.name,
        element: value.element,
        personality: value.personality,
        goal: value.goal,
        origin: value.origin,
        appearanceId: value.appearanceId,
        distinctiveFeatures: value.distinctiveFeatures,
        selectedImage: "original",
        originalPath: null,
        preparedPath: null,
        cleanedPath: null,
      },
    };
    await expect(loadCloudDragonArchive(value.ownerId, dragonUuid)).resolves.toMatchObject({
      draftId: value.draftId,
      createdDragonUuid: dragonUuid,
      cloudRevision: 4,
    });
    await expect(loadCloudDragonArchive(crypto.randomUUID(), dragonUuid)).rejects.toThrow(
      "다른 계정",
    );
  });

  it("removes private objects before purging an abandoned draft", async () => {
    const value = draft();
    mock.rpc.mockResolvedValue({ error: null });
    mock.list.mockResolvedValueOnce({
      data: [{ id: "object-1", name: "drawing.png" }],
      error: null,
    });
    await abandonCloudDraft(value.ownerId, value.draftId);
    expect(mock.remove).toHaveBeenCalledWith([
      `${value.ownerId}/${value.draftId}/original/drawing.png`,
    ]);
    expect(mock.rpc.mock.calls.map((call) => call[0])).toEqual([
      "abandon_dragon_draft",
      "purge_abandoned_dragon_draft",
    ]);
  });
});
