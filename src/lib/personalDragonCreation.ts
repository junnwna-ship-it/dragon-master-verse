import type { DragonDraft } from "./dragonDraftStorage";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UNCERTAIN_CREATION_MESSAGE =
  "드래곤 생성 요청의 처리 결과를 확인하지 못했습니다. 중복 생성을 막기 위해 다시 만들지 않고, 생성된 드래곤이 있는지 확인해 주세요.";

export class PersonalDragonCreationError extends Error {
  constructor(
    readonly code: "uncertain_creation" | "invalid_saved_uuid" | "draft_cleanup_failed",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PersonalDragonCreationError";
  }
}

export interface PersonalDragonCreationDependencies {
  checkpoint: (draft: DragonDraft) => Promise<void>;
  upload: (draft: DragonDraft) => Promise<string>;
  create: (draft: DragonDraft, imageUrl: string) => Promise<string>;
  archive: (draft: DragonDraft, dragonUuid: string) => Promise<void>;
  refreshAndResolve: (dragonUuid: string) => Promise<number>;
  clear: (draft: DragonDraft) => Promise<void>;
}

function nextTimestamp(previous: number): number {
  return Math.max(Date.now(), previous + 1);
}

/**
 * Creation and UI hydration are separate phases. Once the RPC may have run,
 * never retry it automatically: an absent response is not proof of rollback.
 * A confirmed UUID remains recoverable until archiving and hydration succeed.
 */
export async function completePersonalDragonCreation(
  draft: DragonDraft,
  deps: PersonalDragonCreationDependencies,
): Promise<number> {
  let confirmed = draft;
  if (draft.createdDragonUuid != null) {
    if (!UUID_PATTERN.test(draft.createdDragonUuid)) {
      throw new PersonalDragonCreationError(
        "invalid_saved_uuid",
        "저장된 드래곤의 식별자를 확인하지 못했습니다. 초안을 유지한 채 저장 기록을 확인해 주세요.",
      );
    }
  } else {
    if (draft.creationAttemptedAt != null) {
      throw new PersonalDragonCreationError("uncertain_creation", UNCERTAIN_CREATION_MESSAGE);
    }

    const imageUrl = await deps.upload(draft);
    const attemptedAt = Date.now();
    const attempted: DragonDraft = {
      ...draft,
      creationAttemptedAt: attemptedAt,
      updatedAt: Math.max(attemptedAt, draft.updatedAt + 1),
    };
    // Persist before making a request that may commit even if its response is lost.
    await deps.checkpoint(attempted);

    let dragonUuid: string;
    try {
      dragonUuid = await deps.create(attempted, imageUrl);
      if (typeof dragonUuid !== "string" || !UUID_PATTERN.test(dragonUuid)) {
        throw new Error("Invalid dragon UUID returned by creation.");
      }
    } catch (cause) {
      throw new PersonalDragonCreationError("uncertain_creation", UNCERTAIN_CREATION_MESSAGE, {
        cause,
      });
    }

    confirmed = {
      ...attempted,
      createdDragonUuid: dragonUuid,
      updatedAt: nextTimestamp(attempted.updatedAt),
    };
    await deps.checkpoint(confirmed);
  }

  // Both branches now have a validated authoritative UUID, never a numeric UI ID.
  const dragonUuid = confirmed.createdDragonUuid!;
  await deps.archive(confirmed, dragonUuid);
  const dragonId = await deps.refreshAndResolve(dragonUuid);
  try {
    await deps.clear(confirmed);
  } catch (cause) {
    throw new PersonalDragonCreationError(
      "draft_cleanup_failed",
      "드래곤은 저장되었지만 이 기기의 초안 정리를 완료하지 못했습니다. 다시 이어가면 새 드래곤을 만들지 않고 저장된 드래곤을 불러옵니다.",
      { cause },
    );
  }
  return dragonId;
}
