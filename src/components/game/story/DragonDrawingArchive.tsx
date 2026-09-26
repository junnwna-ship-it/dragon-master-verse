import { useEffect, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { loadDragonArchive, type DragonDraft } from "@/lib/dragonDraftStorage";

type ArchiveProps = {
  ownerId: string;
  dragonUuid: string;
};

type ArchiveState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      draft: DragonDraft | null;
      originalUrl: string | null;
      cleanedUrl: string | null;
    };

function originalFilename(image: Blob): string {
  const extension =
    image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
  return `dragon-original.${extension}`;
}

function DragonDrawingArchiveContent({ ownerId, dragonUuid }: ArchiveProps) {
  const [state, setState] = useState<ArchiveState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const releaseUrls = () => {
      for (const url of objectUrls.splice(0)) URL.revokeObjectURL(url);
    };
    const imageUrl = (image: Blob | null) => {
      if (!image) return null;
      const url = URL.createObjectURL(image);
      objectUrls.push(url);
      return url;
    };

    void loadDragonArchive(ownerId, dragonUuid)
      .then((draft) => {
        if (!active) return;
        const originalUrl = imageUrl(draft?.originalImage ?? null);
        const cleanedUrl = imageUrl(draft?.cleanedImage ?? null);
        setState({ status: "ready", draft, originalUrl, cleanedUrl });
      })
      .catch(() => {
        releaseUrls();
        if (active) setState({ status: "error" });
      });

    return () => {
      active = false;
      releaseUrls();
    };
  }, [ownerId, dragonUuid]);

  if (state.status === "loading") {
    return (
      <p role="status" className="px-1 text-xs text-slate-400">
        이 기기에 보관한 그림을 불러오는 중입니다.
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p
        role="status"
        className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100"
      >
        이 기기에 보관한 그림을 불러오지 못했습니다. 브라우저 저장 공간과 설정을 확인해 주세요.
        서버에 저장된 드래곤과는 별도의 보관함입니다.
      </p>
    );
  }

  if (!state.draft) return null;

  const { draft, originalUrl, cleanedUrl } = state;
  const storyFields = [
    { label: "우리의 첫 만남", value: draft.origin },
    { label: "드래곤의 성격", value: draft.personality },
    { label: "함께 이룰 성장 약속", value: draft.goal },
    { label: "꼭 지킬 나만의 생김새", value: draft.distinctiveFeatures },
  ];

  return (
    <details className="group min-w-0 rounded-2xl border border-amber-200/20 bg-slate-950/40">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-amber-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [&::-webkit-details-marker]:hidden">
        내 그림과 첫 약속
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="space-y-4 px-4 pb-4">
        <p className="text-xs leading-relaxed text-slate-300">
          이 기기·브라우저에 보관한 그림입니다. 다른 기기로 동기화되지 않습니다.
        </p>

        {originalUrl || cleanedUrl ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { kind: "original", label: "원본 그림", url: originalUrl },
              { kind: "cleaned", label: "AI 정돈본", url: cleanedUrl },
            ].map(({ kind, label, url }) =>
              url ? (
                <figure
                  key={kind}
                  className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-2"
                >
                  <img
                    src={url}
                    alt={`${draft.name.trim() || "나의 드래곤"}의 ${label}`}
                    className="aspect-square w-full rounded-lg bg-slate-950/50 object-contain"
                    loading="lazy"
                  />
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 text-xs text-slate-200">
                    <span>{label}</span>
                    {draft.selectedImage === kind && (
                      <span className="rounded-full bg-amber-200/10 px-2 py-1 text-[11px] text-amber-100">
                        생성 시 선택한 그림
                      </span>
                    )}
                  </figcaption>
                </figure>
              ) : null,
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-300">
            기본 드래곤 모습으로 처음 만났어요. 이 보관함에는 별도로 업로드한 원본 그림이 없습니다.
          </p>
        )}

        {originalUrl && draft.originalImage && (
          <a
            href={originalUrl}
            download={originalFilename(draft.originalImage)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-200/20 px-3 py-2 text-xs text-amber-100 outline-none hover:bg-amber-200/10 focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Download aria-hidden="true" className="size-4" />
            원본 그림 다운로드
          </a>
        )}

        <dl className="space-y-3 text-sm">
          {storyFields.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-medium text-amber-100">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                {value.trim() || "아직 기록하지 않았어요."}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

export function DragonDrawingArchive(props: ArchiveProps) {
  // Remount synchronously: another account or dragon must never see the previous archive for a frame.
  return <DragonDrawingArchiveContent key={`${props.ownerId}:${props.dragonUuid}`} {...props} />;
}
