import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Crop, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  centeredSquareCrop,
  drawingGeometry,
  exportDrawing,
  FULL_DRAWING_CROP,
  loadDrawing,
  renderDrawing,
  type DrawingCrop,
  type DrawingRotation,
  type LoadedDrawing,
} from "@/lib/dragonDrawingImage";

const EDGES = [
  { key: "left", opposite: "right", label: "왼쪽" },
  { key: "right", opposite: "left", label: "오른쪽" },
  { key: "top", opposite: "bottom", label: "위쪽" },
  { key: "bottom", opposite: "top", label: "아래쪽" },
] as const;

export function DragonDrawingEditor({
  original,
  onApply,
  onClose,
  returnFocusRef,
}: {
  original: Blob;
  onApply: (image: Blob) => Promise<void>;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [image, setImage] = useState<LoadedDrawing | null>(null);
  const [rotation, setRotation] = useState<DrawingRotation>(0);
  const [crop, setCrop] = useState<DrawingCrop>({ ...FULL_DRAWING_CROP });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const frame = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const alive = useRef(false);
  const busy = useRef(false);
  const inputId = useId();

  useEffect(() => {
    let active = true;
    let loaded: LoadedDrawing | null = null;
    alive.current = true;
    void loadDrawing(original).then(
      (result) => {
        if (!active) {
          result.close();
          return;
        }
        loaded = result;
        setImage(result);
      },
      (cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "그림을 읽지 못했습니다.");
      },
    );
    return () => {
      active = false;
      alive.current = false;
      loaded?.close();
    };
  }, [original]);

  useEffect(() => {
    if (!image || !frame.current || !preview.current) return;
    try {
      renderDrawing(frame.current, image, { rotation, crop: FULL_DRAWING_CROP }, 720);
      renderDrawing(preview.current, image, { rotation, crop }, 360);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "미리보기를 표시하지 못했습니다.");
    }
  }, [image, rotation, crop]);

  const rotate = (direction: -90 | 90) => {
    setRotation((previous) => ((previous + direction + 360) % 360) as DrawingRotation);
    setCrop({ ...FULL_DRAWING_CROP });
  };

  const apply = async () => {
    if (!image || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await exportDrawing(image, { rotation, crop });
      if (!alive.current) return;
      await onApply(result);
      if (alive.current) onClose();
    } catch (cause) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : "편집본 저장에 실패했습니다.");
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const geometry = image ? drawingGeometry(image, { rotation, crop }) : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl border-amber-200/25 bg-slate-900 p-4 text-slate-100 sm:p-6 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogTitle className="pr-12 text-lg font-bold text-amber-100">
          내 그림 자르기·회전
        </DialogTitle>
        <DialogDescription className="pr-8 text-slate-300">
          드래곤만 남도록 테두리를 조절해 주세요. 원본은 그대로 보관하고 편집본을 따로 만듭니다.
          다시 편집할 때는 처음 원본에서 시작합니다.
        </DialogDescription>
        {!image && !error && <p role="status">사진 방향을 확인하는 중…</p>}
        <fieldset disabled={!image || saving} className="min-w-0 space-y-4" aria-busy={saving}>
          <legend className="sr-only">사진 편집 도구</legend>
          <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="flex min-h-32 min-w-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2">
              <div className="relative overflow-hidden">
                <canvas
                  ref={frame}
                  role="img"
                  aria-label="회전한 원본과 남길 영역"
                  className="block max-h-64 max-w-full object-contain"
                />
                {image && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute border-2 border-amber-300 shadow-[0_0_0_2000px_rgba(0,0,0,0.65)]"
                    style={{
                      left: `${crop.left}%`,
                      right: `${crop.right}%`,
                      top: `${crop.top}%`,
                      bottom: `${crop.bottom}%`,
                    }}
                  />
                )}
              </div>
            </div>
            <figure className="flex min-w-0 items-center gap-3 sm:flex-col sm:items-stretch">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-950 p-1 sm:h-36 sm:w-full">
                <canvas
                  ref={preview}
                  role="img"
                  aria-label="저장될 편집본 미리보기"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <figcaption className="text-xs leading-relaxed text-slate-300">
                <span className="block font-bold text-amber-100">저장될 모습</span>
                {geometry && (
                  <span>
                    {geometry.outputWidth} × {geometry.outputHeight}px
                  </span>
                )}
              </figcaption>
            </figure>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => rotate(-90)}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/20 px-3 text-sm disabled:opacity-50"
            >
              <RotateCcw aria-hidden="true" className="size-4" /> 왼쪽 회전
            </button>
            <button
              type="button"
              onClick={() => rotate(90)}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/20 px-3 text-sm disabled:opacity-50"
            >
              <RotateCw aria-hidden="true" className="size-4" /> 오른쪽 회전
            </button>
            <button
              type="button"
              onClick={() => image && setCrop(centeredSquareCrop(image, rotation))}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/20 px-3 text-sm disabled:opacity-50"
            >
              <Crop aria-hidden="true" className="size-4" /> 정사각형
            </button>
            <button
              type="button"
              onClick={() => {
                setRotation(0);
                setCrop({ ...FULL_DRAWING_CROP });
              }}
              className="min-h-11 rounded-lg px-3 text-sm underline disabled:opacity-50"
            >
              처음 모습
            </button>
          </div>
          <p className="text-xs text-slate-400">
            밝은 테두리 안의 그림이 남아요. 회전하면 자르기 범위가 초기화됩니다.
          </p>
          <div className="grid min-w-0 gap-x-5 gap-y-1 sm:grid-cols-2">
            {EDGES.map(({ key, opposite, label }) => (
              <div key={key} className="min-w-0">
                <label htmlFor={`${inputId}-${key}`} className="flex justify-between gap-2 text-sm">
                  {label} 잘라내기 <span className="text-amber-200">{Math.round(crop[key])}%</span>
                </label>
                <input
                  id={`${inputId}-${key}`}
                  type="range"
                  min={0}
                  max={Math.max(0, 99 - crop[opposite])}
                  step={0.5}
                  value={crop[key]}
                  aria-valuetext={`${Math.round(crop[key])}% 잘라내기`}
                  onChange={(event) =>
                    setCrop((previous) => ({ ...previous, [key]: Number(event.target.value) }))
                  }
                  className="block h-11 w-full min-w-0 cursor-pointer accent-amber-300"
                />
              </div>
            ))}
          </div>
        </fieldset>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-white/20 px-4 text-sm disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!image || saving}
            onClick={() => void apply()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {saving && (
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {saving ? "편집본 저장 중…" : "편집본 사용하기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
