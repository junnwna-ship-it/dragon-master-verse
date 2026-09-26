import { supabase } from "@/integrations/supabase/client";
import { validateDragonDraft, type DragonDraft } from "./dragonDraftStorage";

type DrawingKind = "original" | "prepared" | "cleaned";
type CloudRow = {
  draft_id: string;
  owner_id: string;
  revision: number;
  metadata: Record<string, unknown>;
  status: string;
  dragon_id?: string | null;
};
type CloudMetadata = Record<string, unknown> & {
  originalPath: string | null;
  preparedPath: string | null;
  cleanedPath: string | null;
};

const BUCKET = "dragon-originals";
const KINDS: DrawingKind[] = ["original", "prepared", "cleaned"];
const IMAGE_KEY: Record<DrawingKind, keyof DragonDraft> = {
  original: "originalImage",
  prepared: "preparedImage",
  cleaned: "cleanedImage",
};
const MISSING_SCHEMA = new Set(["PGRST205", "42P01"]);
const registeredPaths = new Set<string>();
const digestByBlob = new WeakMap<Blob, Promise<string>>();

function cloudError(error: { message: string; code?: string } | null, fallback: string) {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}

export async function cloudSchemaAvailable(): Promise<boolean> {
  const { error } = await supabase
    .from("dragon_drafts" as never)
    .select("draft_id")
    .limit(1);
  if (!error) return true;
  if (MISSING_SCHEMA.has(error.code)) return false;
  throw new Error(`클라우드 저장소 연결을 확인하지 못했습니다: ${error.message}`);
}

async function imagePath(draft: DragonDraft, kind: DrawingKind, blob: Blob): Promise<string> {
  let digest = digestByBlob.get(blob);
  if (!digest) {
    digest = blob
      .arrayBuffer()
      .then((buffer) => crypto.subtle.digest("SHA-256", buffer))
      .then((hash) =>
        Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""),
      );
    digestByBlob.set(blob, digest);
  }
  const hex = await digest;
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return `${draft.ownerId}/${draft.draftId}/${kind}/${hex}.${extension}`;
}

function metadataFromDraft(
  draft: DragonDraft,
  paths: Partial<Record<DrawingKind, string>>,
): CloudMetadata {
  return {
    step: draft.step,
    name: draft.name,
    element: draft.element,
    personality: draft.personality,
    goal: draft.goal,
    origin: draft.origin,
    appearanceId: draft.appearanceId,
    distinctiveFeatures: draft.distinctiveFeatures,
    selectedImage: draft.selectedImage,
    creationAttemptedAt: draft.creationAttemptedAt,
    creationBackend: draft.creationBackend ?? null,
    originalPath: paths.original ?? null,
    preparedPath: paths.prepared ?? null,
    cleanedPath: paths.cleaned ?? null,
  };
}

async function saveMetadata(
  draft: DragonDraft,
  revision: number,
  metadata: CloudMetadata,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "save_dragon_draft" as never,
    {
      _draft_id: draft.draftId,
      _expected_revision: revision,
      _metadata: metadata,
    } as never,
  );
  cloudError(error, "클라우드 초안을 저장하지 못했습니다");
  if (typeof data !== "number" || !Number.isSafeInteger(data))
    throw new Error("클라우드 저장 버전을 확인하지 못했습니다.");
  return data;
}

/** Private, immutable, content-addressed images; a draft is created before asset registration. */
export async function saveCloudDraft(
  draft: DragonDraft,
  expectedRevision: number,
  onIntermediateRevision?: (revision: number) => Promise<void>,
): Promise<number> {
  let revision = expectedRevision;
  const images = KINDS.filter((kind) => draft[IMAGE_KEY[kind]] instanceof Blob);
  if (revision === 0 && images.length) {
    revision = await saveMetadata(draft, 0, {
      ...metadataFromDraft(draft, {}),
      selectedImage: "original",
    });
    await onIntermediateRevision?.(revision);
  }
  const paths: Partial<Record<DrawingKind, string>> = {};
  for (const kind of images) {
    const blob = draft[IMAGE_KEY[kind]] as Blob;
    const path = await imagePath(draft, kind, blob);
    if (!registeredPaths.has(path)) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type,
        upsert: false,
      });
      // A same-content retry is safe; other failures must remain visible.
      if (uploadError && !/asset already exists/i.test(uploadError.message)) throw uploadError;
      const { error: assetError } = await supabase.rpc(
        "register_dragon_asset" as never,
        {
          _draft_id: draft.draftId,
          _path: path,
          _kind: kind,
          _mime_type: blob.type,
          _byte_size: blob.size,
        } as never,
      );
      cloudError(assetError, "비공개 그림을 등록하지 못했습니다");
      registeredPaths.add(path);
    }
    paths[kind] = path;
  }
  return saveMetadata(draft, revision, metadataFromDraft(draft, paths));
}

async function download(path: unknown, ownerId: string, draftId: string): Promise<Blob | null> {
  if (path == null) return null;
  if (typeof path !== "string" || !path.startsWith(`${ownerId}/${draftId}/`))
    throw new Error("다른 계정의 그림 경로를 거부했습니다.");
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  cloudError(error, "비공개 그림을 복원하지 못했습니다");
  return data;
}

export async function loadCloudDraft(ownerId: string): Promise<DragonDraft | null> {
  const { data, error } = await supabase
    .from("dragon_drafts" as never)
    .select("draft_id,owner_id,revision,metadata,status")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  cloudError(error, "클라우드 초안을 읽지 못했습니다");
  if (!data) return null;
  return hydrateCloudRow(data as unknown as CloudRow, ownerId);
}

async function hydrateCloudRow(row: CloudRow, ownerId: string): Promise<DragonDraft> {
  if (row.owner_id !== ownerId) throw new Error("다른 계정의 초안을 거부했습니다.");
  const m = row.metadata as CloudMetadata;
  const [originalImage, preparedImage, cleanedImage] = await Promise.all([
    download(m.originalPath, ownerId, row.draft_id),
    download(m.preparedPath, ownerId, row.draft_id),
    download(m.cleanedPath, ownerId, row.draft_id),
  ]);
  const loadedAt = Date.now();
  return validateDragonDraft(
    {
      schemaVersion: 2,
      ownerId,
      draftId: row.draft_id,
      updatedAt: loadedAt,
      ...m,
      originalImage,
      preparedImage,
      cleanedImage,
      creationAttemptedAt: m.creationAttemptedAt ?? null,
      createdDragonUuid: row.dragon_id ?? null,
      cloudRevision: row.revision,
      cloudSyncedAt: loadedAt,
    },
    ownerId,
  );
}

/** Restore a completed dragon's private drawing album on another device. */
export async function loadCloudDragonArchive(
  ownerId: string,
  dragonUuid: string,
): Promise<DragonDraft | null> {
  if (!(await cloudSchemaAvailable())) return null;
  const { data, error } = await supabase
    .from("dragon_drafts" as never)
    .select("draft_id,owner_id,revision,metadata,status,dragon_id")
    .eq("owner_id", ownerId)
    .eq("dragon_id", dragonUuid)
    .eq("status", "completed")
    .maybeSingle();
  cloudError(error, "클라우드 드래곤 그림을 읽지 못했습니다");
  if (!data) return null;
  return hydrateCloudRow(data as unknown as CloudRow, ownerId);
}

export async function abandonCloudDraft(ownerId: string, draftId: string): Promise<void> {
  const { error } = await supabase.rpc(
    "abandon_dragon_draft" as never,
    { _draft_id: draftId } as never,
  );
  cloudError(error, "클라우드 초안을 버리지 못했습니다");
  for (const kind of KINDS) {
    const prefix = `${ownerId}/${draftId}/${kind}`;
    for (let page = 0; page < 100; page += 1) {
      const { data, error: listError } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 100,
      });
      cloudError(listError, "비공개 그림 목록을 읽지 못했습니다");
      const paths = (data ?? []).filter((item) => item.id).map((item) => `${prefix}/${item.name}`);
      if (!paths.length) break;
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
      cloudError(removeError, "비공개 그림을 삭제하지 못했습니다");
      if (page === 99) throw new Error("비공개 그림 정리가 끝나지 않았습니다. 다시 시도해 주세요.");
    }
  }
  const { error: purgeError } = await supabase.rpc(
    "purge_abandoned_dragon_draft" as never,
    { _draft_id: draftId } as never,
  );
  cloudError(purgeError, "클라우드 초안을 최종 삭제하지 못했습니다");
}

export async function createCloudDragon(draft: DragonDraft, imageUrl: string): Promise<string> {
  const cardPath = `${draft.ownerId}/personal-${draft.draftId}.jpg`;
  const { data, error } = await supabase.rpc(
    "create_personal_dragon_v2" as never,
    {
      _draft_id: draft.draftId,
      _card_path: cardPath,
      _image_url: imageUrl,
    } as never,
  );
  cloudError(error, "드래곤 생성을 확인하지 못했습니다");
  return String(data);
}
