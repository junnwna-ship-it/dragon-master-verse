import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Crop,
  ImageUp,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import creationArt from "@/assets/story/dragon_creation_hatchery.png";
import defaultDragonArt from "@/assets/dragons/personal-hatchling.png";
import { useAuth } from "@/hooks/useAuth";
import { useDragonDraft } from "@/hooks/useDragonDraft";
import { ownedGrowthKey } from "@/hooks/useOwnedGrowth";
import { supabase } from "@/integrations/supabase/client";
import { cleanDragonDrawing } from "@/lib/dragonImage.functions";
import { useGameStore, type Element } from "@/store/dragons";
import { archiveDragonDraft, selectedDragonDrawing } from "@/lib/dragonDraftStorage";
import { completePersonalDragonCreation } from "@/lib/personalDragonCreation";
import { createCloudDragon } from "@/lib/dragonCloudStorage";
import { imageToJpeg, loadDrawing } from "@/lib/dragonDrawingImage";
import { DragonDrawingEditor } from "./DragonDrawingEditor";

const ELEMENTS: Array<{ value: Element; label: string; color: string }> = [
  { value: "Earth", label: "대지", color: "border-amber-400/60 bg-amber-400/10 text-amber-100" },
  { value: "Water", label: "물", color: "border-sky-400/60 bg-sky-400/10 text-sky-100" },
  { value: "Fire", label: "불", color: "border-rose-400/60 bg-rose-400/10 text-rose-100" },
  { value: "Wood", label: "숲", color: "border-emerald-400/60 bg-emerald-400/10 text-emerald-100" },
  { value: "Light", label: "빛", color: "border-yellow-200/60 bg-yellow-200/10 text-yellow-50" },
  {
    value: "Dark",
    label: "그림자",
    color: "border-violet-400/60 bg-violet-400/10 text-violet-100",
  },
];

const PERSONALITIES = ["용감한", "다정한", "호기심 많은", "차분한", "장난기 많은", "신중한"];
const GOALS = [
  "마음을 나누기",
  "힘을 조절하기",
  "용기를 기르기",
  "친구를 지키기",
  "새로운 능력 발견하기",
];
const APPEARANCES = [
  { id: "pearl", label: "진주빛", filter: "none" },
  { id: "ember", label: "불꽃빛", filter: "sepia(0.35) saturate(1.65) hue-rotate(325deg)" },
  { id: "ocean", label: "바다빛", filter: "hue-rotate(145deg) saturate(1.35)" },
  { id: "forest", label: "숲빛", filter: "hue-rotate(70deg) saturate(1.3)" },
  { id: "shadow", label: "별밤빛", filter: "hue-rotate(225deg) saturate(1.5) brightness(0.8)" },
  { id: "sun", label: "햇살빛", filter: "sepia(0.45) saturate(1.45) brightness(1.05)" },
] as const;

const ELEMENT_STATS: Record<Element, { maxHp: number; mp: number; atk: number; def: number }> = {
  Earth: { maxHp: 1750, mp: 900, atk: 1200, def: 1550 },
  Water: { maxHp: 1450, mp: 1450, atk: 1250, def: 1200 },
  Fire: { maxHp: 1400, mp: 1050, atk: 1650, def: 1050 },
  Wood: { maxHp: 1550, mp: 1250, atk: 1300, def: 1300 },
  Light: { maxHp: 1450, mp: 1550, atk: 1350, def: 1100 },
  Dark: { maxHp: 1350, mp: 1400, atk: 1550, def: 1000 },
};

async function uploadDragonImage(blob: Blob, userId: string, draftId?: string) {
  const path = `${userId}/personal-${draftId ?? crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("dragon-images")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error && !(draftId && /asset already exists/i.test(error.message))) throw error;
  return supabase.storage.from("dragon-images").getPublicUrl(path).data.publicUrl;
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

export function DragonOriginBuilder({
  onCancel,
  onCreated,
}: {
  onCancel?: () => void;
  onCreated: (dragonId: number) => void;
}) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">제작 계정을 확인하는 중…</p>;
  if (!user) return <p role="status">초안과 성장 기록을 저장하려면 로그인해 주세요.</p>;
  return (
    <DragonOriginEditor key={user.id} ownerId={user.id} onCancel={onCancel} onCreated={onCreated} />
  );
}

function useImageUrl(blob: Blob | null) {
  const [value, setValue] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setValue({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return value?.blob === blob ? value.url : null;
}

function DragonOriginEditor({
  ownerId,
  onCancel,
  onCreated,
}: {
  ownerId: string;
  onCancel?: () => void;
  onCreated: (dragonId: number) => void;
}) {
  const queryClient = useQueryClient();
  const fetchDragons = useGameStore((state) => state.fetchDragons);
  const {
    draft,
    status,
    error: draftError,
    restored,
    updateDraft,
    checkpoint,
    reload,
    retrySave,
    clear,
    discard,
    cloudState,
    cloudEnabled,
  } = useDragonDraft(ownerId);
  const step = draft?.step ?? 1;
  const setStep = (value: number) =>
    updateDraft({ step: Math.max(1, Math.min(3, value)) as 1 | 2 | 3 });
  const name = draft?.name ?? "";
  const element = draft?.element ?? "Earth";
  const personality = draft?.personality ?? PERSONALITIES[0];
  const goal = draft?.goal ?? GOALS[0];
  const origin = draft?.origin ?? "";
  const file = draft?.originalImage ?? null;
  const preparedImage = draft?.preparedImage ?? null;
  const aiImage = draft?.cleanedImage ?? null;
  const appearance = APPEARANCES.find((item) => item.id === draft?.appearanceId) ?? APPEARANCES[0];
  const originalUrl = useImageUrl(file);
  const preparedUrl = useImageUrl(preparedImage);
  const cleanedUrl = useImageUrl(aiImage);
  const preview =
    (draft?.selectedImage === "cleaned"
      ? cleanedUrl
      : draft?.selectedImage === "prepared"
        ? preparedUrl
        : originalUrl) ?? defaultDragonArt;
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [editingImage, setEditingImage] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const busy = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const stepPanel = useRef<HTMLFieldSetElement>(null);
  const lastStep = useRef(1);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    stepPanel.current?.scrollIntoView({ block: "start" });
    stepPanel.current?.focus({ preventScroll: true });
  }, [step]);
  const storyPreview = `${name.trim() || "나의 드래곤"} — ${personality} 성격의 ${ELEMENTS.find((item) => item.value === element)?.label} 드래곤. ${origin.trim()} 우리의 성장 약속은 ‘${goal}’. 앞으로 함께 배우며 성장합니다.`;
  const locked =
    saving ||
    cleaning ||
    readingImage ||
    editingImage ||
    !!draft?.creationAttemptedAt ||
    !!draft?.createdDragonUuid;

  const requireCurrentOwner = async () => {
    if (!alive.current) throw new Error("제작 화면이 닫혔습니다. 다시 열어 주세요.");
    const { data, error } = await supabase.auth.getUser();
    if (!alive.current || error || data.user?.id !== ownerId)
      throw new Error("로그인 계정이 변경되었습니다. 초안은 원래 계정에 보관됩니다.");
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (busy.current || locked) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
      toast.error("PNG, JPG 또는 WEBP 이미지를 선택해 주세요.");
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      toast.error("이미지는 8MB 이하로 선택해 주세요.");
      return;
    }
    busy.current = true;
    setReadingImage(true);
    try {
      const decoded = await loadDrawing(selected);
      decoded.close();
      if (!alive.current) return;
      updateDraft({
        originalImage: selected,
        preparedImage: null,
        cleanedImage: null,
        selectedImage: "original",
      });
    } catch (error) {
      if (alive.current)
        toast.error(error instanceof Error ? error.message : "그림을 읽지 못했습니다.");
    } finally {
      busy.current = false;
      if (alive.current) setReadingImage(false);
    }
  };

  const cleanWithAi = async () => {
    if (!draft || !file || busy.current || locked) return;
    busy.current = true;
    setCleaning(true);
    try {
      const compressed = await imageToJpeg(selectedDragonDrawing(draft) ?? file);
      const imageBase64 = await blobToDataUrl(compressed);
      await requireCurrentOwner();
      const result = await cleanDragonDrawing({ data: { imageBase64 } });
      const cleanedImage = await imageToJpeg(result.imageBase64);
      await requireCurrentOwner();
      updateDraft({ cleanedImage, selectedImage: "cleaned" });
      toast.success("손그림을 게임용 드래곤 이미지로 정돈했습니다.");
    } catch (error) {
      if (alive.current)
        toast.error(error instanceof Error ? error.message : "AI 그림 정돈에 실패했습니다.");
    } finally {
      busy.current = false;
      if (alive.current) setCleaning(false);
    }
  };

  const createDragon = async () => {
    if (!draft || busy.current || status === "error" || cloudState === "error") return;
    if (!name.trim()) {
      setStep(2);
      toast.error("드래곤의 이름을 지어 주세요.");
      return;
    }

    busy.current = true;
    setSaving(true);
    try {
      await requireCurrentOwner();
      if (!draft.creationAttemptedAt) await checkpoint(draft);
      const createdId = await completePersonalDragonCreation(draft, {
        backend: cloudEnabled ? "cloud" : "legacy",
        checkpoint,
        upload: async (snapshot) => {
          const source = selectedDragonDrawing(snapshot);
          const blob = await imageToJpeg(
            source ?? defaultDragonArt,
            snapshot.originalImage ? "none" : appearance.filter,
          );
          await requireCurrentOwner();
          return uploadDragonImage(blob, ownerId, cloudEnabled ? snapshot.draftId : undefined);
        },
        create: async (snapshot, imageUrl) => {
          await requireCurrentOwner();
          if (cloudEnabled) return createCloudDragon(snapshot, imageUrl);
          const stats = ELEMENT_STATS[snapshot.element];
          const { data, error } = await supabase.rpc("create_personal_dragon", {
            _name: snapshot.name.trim().slice(0, 24),
            _element: snapshot.element,
            _image_url: imageUrl,
            _lore: storyPreview,
            _max_hp: stats.maxHp,
            _mp: stats.mp,
            _atk: stats.atk,
            _def: stats.def,
          });
          if (error)
            throw new Error(
              "생성 응답을 확인하지 못했습니다. 중복 방지를 위해 자동 재생성을 중단했습니다. 보관함에서 결과를 확인해 주세요.",
            );
          return String(data);
        },
        archive: async (snapshot, uuid) => {
          await archiveDragonDraft(snapshot, uuid);
        },
        refreshAndResolve: async (uuid) => {
          await requireCurrentOwner();
          await queryClient.invalidateQueries({ queryKey: ownedGrowthKey(ownerId) });
          await queryClient.refetchQueries({ queryKey: ownedGrowthKey(ownerId) });
          await fetchDragons();
          await requireCurrentOwner();
          const state = useGameStore.getState();
          const created = state.dragons.find(
            (dragon) => dragon.uuid === uuid && dragon.createdBy === ownerId,
          );
          if (state.loadError || !created)
            throw new Error(
              "드래곤은 등록됐지만 목록을 불러오지 못했습니다. ‘만든 드래곤 다시 불러오기’를 눌러 주세요.",
            );
          return created.id;
        },
        clear,
      });
      if (alive.current) {
        toast.success(`${name}과(와)의 이야기가 시작됩니다!`);
        onCreated(createdId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (alive.current) toast.error(message);
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  if (!draft)
    return (
      <div
        role="status"
        className="rounded-2xl border border-white/15 bg-slate-900 p-6 text-slate-200"
      >
        {draftError ?? "저장한 제작 초안을 불러오는 중…"}
        {draftError && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              className="min-h-11 rounded-lg border border-amber-200/40 px-3 text-amber-100"
            >
              초안 다시 불러오기
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="min-h-11 px-3 underline">
                뒤로
              </button>
            )}
          </div>
        )}
      </div>
    );

  return (
    <section
      className="dragon-builder overflow-hidden rounded-3xl border border-amber-200/25 bg-slate-900/95 shadow-2xl shadow-black/30"
      aria-busy={saving || cleaning || readingImage}
    >
      {editingImage && file && (
        <DragonDrawingEditor
          original={file}
          returnFocusRef={editButton}
          onClose={() => setEditingImage(false)}
          onApply={async (image) => {
            if (!alive.current || draft.creationAttemptedAt || draft.createdDragonUuid)
              throw new Error("제작 화면이 변경되었습니다. 다시 열어 주세요.");
            await checkpoint({
              ...draft,
              preparedImage: image,
              selectedImage: "prepared",
              updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
            });
          }}
        />
      )}
      <div className="relative h-44 overflow-hidden sm:h-56">
        <img
          src={creationArt}
          alt="마법의 부화실에 놓인 드래곤 알"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-200">
            나의 드래곤 만들기
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">우리만의 첫 장을 준비해요</h2>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-5 rounded-xl border border-sky-300/20 bg-sky-400/5 p-3 text-sm text-slate-300">
          <p role="status" aria-live="polite" className="font-bold text-sky-100">
            {status === "saving"
              ? cloudEnabled
                ? "기기와 클라우드에 초안 저장 중…"
                : "이 기기에 초안 저장 중…"
              : status === "error"
                ? "초안 저장 확인 필요"
                : restored
                  ? "저장한 초안을 이어서 만들고 있어요"
                  : cloudState === "synced"
                    ? "기기와 클라우드에 초안이 저장되어 있어요"
                    : "이 기기에 초안이 저장되어 있어요"}
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            {cloudState === "synced"
              ? "이 계정의 초안과 비공개 그림이 클라우드에 동기화되었습니다. 공용 기기에는 로컬 사본도 남으니 주의해 주세요."
              : "이 계정의 그림과 설정은 현재 기기·브라우저에 보관됩니다. 클라우드 동기화가 확인되기 전에는 브라우저 데이터를 지우지 마세요."}
          </p>
          {draftError && (
            <p role="alert" className="mt-2 text-amber-200">
              {draftError}
            </p>
          )}
          {(status === "error" || cloudState === "error") && (
            <button
              type="button"
              disabled={saving || cleaning || readingImage || editingImage}
              onClick={() => void retrySave().catch(() => undefined)}
              className="mt-2 min-h-11 rounded-lg border border-amber-200/40 px-3 text-amber-100"
            >
              초안 다시 저장
            </button>
          )}
          {!locked && (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="mt-2 min-h-11 text-xs underline"
            >
              초안 버리고 새로 시작
            </button>
          )}
          {confirmDiscard && (
            <div role="alert" className="mt-3 rounded-lg border border-amber-300/40 p-3">
              <p>
                현재 초안의 그림과 설정을 삭제할까요? 클라우드 동기화된 초안과 비공개 그림도 함께
                삭제됩니다. 이미 등록한 드래곤의 보관 기록은 유지됩니다.
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  disabled={saving || cleaning}
                  className="min-h-11 rounded-lg bg-amber-200 px-3 text-slate-950"
                  onClick={() => {
                    if (busy.current) return;
                    busy.current = true;
                    setSaving(true);
                    void discard()
                      .then(() => setConfirmDiscard(false))
                      .catch(() => toast.error("초안을 삭제하지 못했습니다."))
                      .finally(() => {
                        busy.current = false;
                        if (alive.current) setSaving(false);
                      });
                  }}
                >
                  초안 삭제
                </button>
                <button
                  type="button"
                  className="min-h-11 px-3"
                  onClick={() => setConfirmDiscard(false)}
                >
                  계속 만들기
                </button>
              </div>
            </div>
          )}
          {draft.createdDragonUuid && (
            <p className="mt-2 text-emerald-200">
              드래곤 등록이 확인되었습니다. 다시 불러오기는 새 드래곤을 만들지 않습니다.
            </p>
          )}
          {draft.creationAttemptedAt && !draft.createdDragonUuid && (
            <p role="alert" className="mt-2 text-amber-200">
              {draft.creationBackend === "cloud" && cloudEnabled
                ? "생성 응답을 확인하지 못했습니다. 같은 초안으로 다시 확인해도 새 드래곤이 중복 생성되지 않습니다."
                : "생성 결과 확인이 필요합니다. 중복 생성을 막기 위해 재전송을 멈췄습니다. 보관함에서 결과를 확인해 주세요. 원본과 초안은 유지됩니다."}
            </p>
          )}
        </div>
        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="드래곤 만들기 단계">
          {["모습", "이름·성격", "성장 약속"].map((label, index) => {
            const number = index + 1;
            return (
              <li
                key={label}
                aria-current={number === step ? "step" : undefined}
                className={`rounded-xl border px-2 py-2 text-center text-xs ${number === step ? "border-violet-300 bg-violet-400/15 text-violet-100" : number < step ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-400"}`}
              >
                <span className="block font-black">{number < step ? "✓" : number}</span>
                {label}
              </li>
            );
          })}
        </ol>

        <fieldset
          disabled={locked}
          ref={stepPanel}
          tabIndex={-1}
          aria-label={`${step}단계`}
          className="scroll-mt-6 focus:outline-none"
        >
          {step > 1 && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3">
              <img
                src={preview}
                alt="내 드래곤 미리보기"
                style={{ filter: file ? "none" : appearance.filter }}
                className="h-16 w-16 shrink-0 rounded-lg object-contain"
              />
              <p className="min-w-0 text-sm font-bold text-amber-100">
                {name.trim() || "이름을 기다리는 나의 드래곤"}
              </p>
            </div>
          )}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-white">드래곤의 모습을 정해 주세요</h3>
              <p className="mt-1 text-sm text-slate-400">
                기본 드래곤을 꾸미거나, 손그림을 업로드하거나, 카메라로 바로 촬영할 수 있습니다.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:items-start">
                <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-200/40 bg-slate-950 shadow-lg">
                  <img
                    src={preview}
                    alt="내 드래곤 미리보기"
                    style={{ filter: file ? "none" : appearance.filter }}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-300/40 bg-sky-400/10 px-4 py-3 text-sm font-bold text-sky-100 hover:bg-sky-400/20">
                    <ImageUp className="h-4 w-4" /> 그림·사진 업로드
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={locked}
                      className="sr-only"
                      onChange={(event) => void chooseFile(event)}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-400/20">
                    <Camera className="h-4 w-4" /> 카메라로 손그림 찍기
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={locked}
                      className="sr-only"
                      onChange={(event) => void chooseFile(event)}
                    />
                  </label>
                  {file && (
                    <>
                      <button
                        ref={editButton}
                        type="button"
                        onClick={() => setEditingImage(true)}
                        disabled={locked || status !== "saved"}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100 disabled:opacity-50"
                      >
                        <Crop aria-hidden="true" className="size-4" /> 그림 자르기·회전
                      </button>
                      <button
                        type="button"
                        onClick={() => void cleanWithAi()}
                        disabled={locked || status !== "saved"}
                        className="flex items-center justify-center gap-2 rounded-xl border border-violet-300/50 bg-violet-400/15 px-4 py-3 text-sm font-bold text-violet-100 hover:bg-violet-400/25 disabled:opacity-50"
                      >
                        {cleaning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <WandSparkles className="h-4 w-4" />
                        )}
                        {cleaning
                          ? "AI가 선과 색을 정돈하는 중…"
                          : aiImage
                            ? "AI로 다시 정돈하기"
                            : "손그림을 AI로 정돈하기"}
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          updateDraft({
                            originalImage: null,
                            preparedImage: null,
                            cleanedImage: null,
                            selectedImage: "original",
                          })
                        }
                        className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        기본 드래곤으로 되돌리기
                      </button>
                    </>
                  )}
                  <p className="text-xs leading-relaxed text-slate-500">
                    사진을 자르고 회전해 드래곤만 남길 수 있어요. AI는 선택한 그림을 정돈하며,
                    버튼을 눌렀을 때만 실행됩니다. 사람 얼굴은 제외하고 종이에 그린 드래곤만 촬영해
                    주세요.
                  </p>
                  {readingImage && (
                    <p role="status" className="text-sm text-amber-100">
                      그림과 사진 방향을 확인하는 중…
                    </p>
                  )}
                </div>
              </div>
              {file && (preparedImage || aiImage) && (
                <div
                  className="mt-5 grid grid-cols-2 gap-3"
                  role="group"
                  aria-label="사용할 드래곤 그림 선택"
                >
                  {(
                    [
                      { value: "original", label: "내가 그린 원본", url: originalUrl },
                      { value: "prepared", label: "자르기·회전 편집본", url: preparedUrl },
                      { value: "cleaned", label: "AI 정돈본", url: cleanedUrl },
                    ] as const
                  )
                    .filter((item) => item.url)
                    .map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={draft.selectedImage === item.value}
                        onClick={() => updateDraft({ selectedImage: item.value })}
                        className={`overflow-hidden rounded-xl border-2 p-2 text-sm ${draft.selectedImage === item.value ? "border-amber-300 bg-amber-300/10 text-amber-100" : "border-white/15 text-slate-300"}`}
                      >
                        {item.url && (
                          <img
                            src={item.url}
                            alt={item.label}
                            className="aspect-square w-full rounded-lg bg-slate-950 object-contain"
                          />
                        )}
                        <span className="mt-2 block font-bold">
                          {item.label}
                          {draft.selectedImage === item.value ? " · 선택됨" : " 선택"}
                        </span>
                      </button>
                    ))}
                  <p className="col-span-2 text-xs text-slate-400">
                    원본·편집본·AI 정돈본은 따로 보관합니다. 비교하거나 선택을 바꿔도 AI를 다시
                    호출하지 않습니다. 새 원본을 올리면 이전 편집본과 정돈본은 교체됩니다.
                  </p>
                </div>
              )}
              {!file && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-300">비늘의 빛깔</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {APPEARANCES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={appearance.id === item.id}
                        onClick={() => updateDraft({ appearanceId: item.id })}
                        className={`rounded-full border px-3 py-1.5 text-xs ${appearance.id === item.id ? "border-violet-300 bg-violet-400/20 text-violet-100" : "border-white/10 text-slate-400"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold text-white">이름과 타고난 힘을 정해요</h3>
              <label htmlFor="dragon-name" className="mt-4 block text-sm font-bold text-slate-300">
                드래곤 이름
              </label>
              <input
                id="dragon-name"
                value={name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                maxLength={24}
                placeholder="예: 루미"
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-300"
              />
              <p className="mt-4 text-xs font-bold text-slate-300">원소</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ELEMENTS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={element === item.value}
                    onClick={() => updateDraft({ element: item.value })}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${element === item.value ? item.color : "border-white/10 bg-white/5 text-slate-400"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs font-bold text-slate-300">성격</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PERSONALITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={personality === item}
                    onClick={() => updateDraft({ personality: item })}
                    className={`rounded-full border px-3 py-1.5 text-xs ${personality === item ? "border-violet-300 bg-violet-400/20 text-violet-100" : "border-white/10 text-slate-400"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <label
                htmlFor="dragon-features"
                className="mt-5 block text-sm font-bold text-slate-300"
              >
                성장해도 지키고 싶은 모습
              </label>
              <textarea
                id="dragon-features"
                value={draft.distinctiveFeatures}
                onChange={(event) => updateDraft({ distinctiveFeatures: event.target.value })}
                maxLength={160}
                rows={2}
                placeholder="예: 둥근 뿔 두 개, 별 모양 꼬리, 파란 날개"
                className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-300"
              />
              <p className="mt-1 text-xs text-slate-400">
                내 그림 기록에 함께 보관합니다. 성장 이미지에 자동 반영하는 기능은 다음 단계에서
                연결합니다.
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-lg font-bold text-white">함께 만들 성장서사를 약속해요</h3>
              <label
                htmlFor="dragon-origin"
                className="mt-4 block text-sm font-bold text-slate-300"
              >
                우리의 첫 만남
              </label>
              <textarea
                id="dragon-origin"
                value={origin}
                onChange={(event) => updateDraft({ origin: event.target.value })}
                maxLength={120}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-300"
              />
              <p className="mt-4 text-xs font-bold text-slate-300">첫 번째 성장 목표</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GOALS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={goal === item}
                    onClick={() => updateDraft({ goal: item })}
                    className={`rounded-full border px-3 py-1.5 text-xs ${goal === item ? "border-amber-300 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-400"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                  <Sparkles className="h-4 w-4" /> 성장서사 미리보기
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{storyPreview}</p>
              </div>
            </div>
          )}
        </fieldset>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          {cloudState === "synced"
            ? "제작 초안과 손그림은 비공개 클라우드에 동기화됩니다. 등록 카드 그림과 이름·소개는 게임 도감에 공개됩니다."
            : "현재 초안은 이 브라우저에 보관됩니다. 등록 카드 그림과 이름·소개는 게임 도감에 공개됩니다. 클라우드 동기화는 아직 확인되지 않았습니다."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            disabled={saving || cleaning || readingImage || editingImage}
            onClick={() => (step > 1 && !locked ? setStep(step - 1) : onCancel?.())}
            className="flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 1 || locked ? "나가기 · 초안 유지" : "이전"}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={locked || status !== "saved" || (step === 2 && !name.trim())}
              className="flex items-center gap-1 rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-violet-200 disabled:opacity-40"
            >
              다음 <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void createDragon()}
              disabled={
                saving ||
                cleaning ||
                status !== "saved" ||
                cloudState === "error" ||
                (!!draft.creationAttemptedAt &&
                  !draft.createdDragonUuid &&
                  !(draft.creationBackend === "cloud" && cloudEnabled))
              }
              className="flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-200 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving
                ? "드래곤을 준비하는 중…"
                : draft.createdDragonUuid
                  ? "만든 드래곤 다시 불러오기"
                  : "만들고 첫 만남 시작"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
