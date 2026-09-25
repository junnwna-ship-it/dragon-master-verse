import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Camera, Check, ImageUp, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import creationArt from "@/assets/story/dragon_creation_hatchery.png";
import defaultDragonArt from "@/assets/dragons/personal-hatchling.png";
import { useAuth } from "@/hooks/useAuth";
import { ownedGrowthKey } from "@/hooks/useOwnedGrowth";
import { supabase } from "@/integrations/supabase/client";
import { cleanDragonDrawing } from "@/lib/dragonImage.functions";
import { useGameStore, type Element } from "@/store/dragons";

const ELEMENTS: Array<{ value: Element; label: string; color: string }> = [
  { value: "Earth", label: "대지", color: "border-amber-400/60 bg-amber-400/10 text-amber-100" },
  { value: "Water", label: "물", color: "border-sky-400/60 bg-sky-400/10 text-sky-100" },
  { value: "Fire", label: "불", color: "border-rose-400/60 bg-rose-400/10 text-rose-100" },
  { value: "Wood", label: "숲", color: "border-emerald-400/60 bg-emerald-400/10 text-emerald-100" },
  { value: "Light", label: "빛", color: "border-yellow-200/60 bg-yellow-200/10 text-yellow-50" },
  { value: "Dark", label: "그림자", color: "border-violet-400/60 bg-violet-400/10 text-violet-100" },
];

const PERSONALITIES = ["용감한", "다정한", "호기심 많은", "차분한", "장난기 많은", "신중한"];
const GOALS = ["마음을 나누기", "힘을 조절하기", "용기를 기르기", "친구를 지키기", "새로운 능력 발견하기"];
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

async function imageToJpeg(source: File | string, filter = "none"): Promise<Blob> {
  const sourceUrl = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      element.src = sourceUrl;
    });
    const max = 720;
    const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 변환하지 못했습니다.");
    context.filter = filter;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 저장하지 못했습니다."))),
        "image/jpeg",
        0.86,
      );
    });
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(sourceUrl);
  }
}

async function uploadDragonImage(blob: Blob, userId: string) {
  const path = `${userId}/personal-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("dragon-images")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchDragons = useGameStore((state) => state.fetchDragons);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [element, setElement] = useState<Element>("Earth");
  const [personality, setPersonality] = useState(PERSONALITIES[0]!);
  const [goal, setGoal] = useState(GOALS[0]!);
  const [origin, setOrigin] = useState("성의 알 보관실에서 나와 눈을 맞췄다.");
  const [file, setFile] = useState<File | null>(null);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [preview, setPreview] = useState(defaultDragonArt);
  const [appearance, setAppearance] = useState<(typeof APPEARANCES)[number]>(APPEARANCES[0]);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (aiImage) {
      setPreview(aiImage);
      return;
    }
    if (!file) {
      setPreview(defaultDragonArt);
      return;
    }
    const next = URL.createObjectURL(file);
    setPreview(next);
    return () => URL.revokeObjectURL(next);
  }, [file, aiImage]);

  const storyPreview = useMemo(
    () =>
      `${name.trim() || "나의 드래곤"}은(는) ${personality} 성격의 ${ELEMENTS.find((item) => item.value === element)?.label} 드래곤입니다. ${origin.trim()} 앞으로 당신과 함께 ‘${goal}’을 배우며 성장합니다.`,
    [name, personality, element, origin, goal],
  );

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      toast.error("이미지 파일을 선택해 주세요.");
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      toast.error("이미지는 8MB 이하로 선택해 주세요.");
      return;
    }
    setAiImage(null);
    setFile(selected);
  };

  const cleanWithAi = async () => {
    if (!file) return;
    setCleaning(true);
    try {
      const compressed = await imageToJpeg(file);
      const imageBase64 = await blobToDataUrl(compressed);
      const result = await cleanDragonDrawing({ data: { imageBase64 } });
      setAiImage(result.imageBase64);
      toast.success("손그림을 게임용 드래곤 이미지로 정돈했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 그림 정돈에 실패했습니다.");
    } finally {
      setCleaning(false);
    }
  };

  const createDragon = async () => {
    if (!user) {
      toast.error("드래곤의 성장 기록을 저장하려면 로그인해 주세요.");
      return;
    }
    if (!name.trim()) {
      setStep(2);
      toast.error("드래곤의 이름을 지어 주세요.");
      return;
    }

    setSaving(true);
    try {
      const imageBlob = await imageToJpeg(aiImage ?? file ?? defaultDragonArt, file ? "none" : appearance.filter);
      const imageUrl = await uploadDragonImage(imageBlob, user.id);
      const stats = ELEMENT_STATS[element];
      const { data, error } = await supabase.rpc("create_personal_dragon", {
        _name: name.trim().slice(0, 24),
        _element: element,
        _image_url: imageUrl,
        _lore: storyPreview,
        _max_hp: stats.maxHp,
        _mp: stats.mp,
        _atk: stats.atk,
        _def: stats.def,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ownedGrowthKey(user.id) });
      await queryClient.refetchQueries({ queryKey: ownedGrowthKey(user.id) });
      await fetchDragons();
      const dragonUuid = String(data);
      const created = useGameStore.getState().dragons.find((dragon) => dragon.uuid === dragonUuid);
      if (!created) throw new Error("만든 드래곤을 다시 불러오지 못했습니다.");
      toast.success(`${created.name}과(와)의 이야기가 시작됩니다!`);
      onCreated(created.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`드래곤을 만들지 못했습니다: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-300/25 bg-slate-900/95 shadow-2xl shadow-violet-950/50">
      <div className="relative h-44 overflow-hidden sm:h-56">
        <img src={creationArt} alt="마법의 부화실에 놓인 드래곤 알" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-200">나의 드래곤 만들기</p>
          <h2 className="mt-1 text-2xl font-black text-white">우리만의 첫 장을 준비해요</h2>
        </div>
      </div>

      <div className="p-5">
        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="드래곤 만들기 단계">
          {["모습", "이름과 성격", "성장 약속"].map((label, index) => {
            const number = index + 1;
            return (
              <li key={label} className={`rounded-xl border px-2 py-2 text-center text-[11px] ${number === step ? "border-violet-300 bg-violet-400/15 text-violet-100" : number < step ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-500"}`}>
                <span className="block font-black">{number < step ? "✓" : number}</span>{label}
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <div>
            <h3 className="text-lg font-bold text-white">드래곤의 모습을 정해 주세요</h3>
            <p className="mt-1 text-sm text-slate-400">기본 드래곤을 꾸미거나, 손그림을 업로드하거나, 카메라로 바로 촬영할 수 있습니다.</p>
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-stretch">
              <div className="aspect-square w-44 overflow-hidden rounded-3xl border-2 border-violet-300/50 bg-slate-950 shadow-lg">
                <img src={preview} alt="내 드래곤 미리보기" style={{ filter: file ? "none" : appearance.filter }} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-300/40 bg-sky-400/10 px-4 py-3 text-sm font-bold text-sky-100 hover:bg-sky-400/20">
                  <ImageUp className="h-4 w-4" /> 그림·사진 업로드
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={chooseFile} />
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-400/20">
                  <Camera className="h-4 w-4" /> 카메라로 손그림 찍기
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={chooseFile} />
                </label>
                {file && (
                  <>
                    <button type="button" onClick={() => void cleanWithAi()} disabled={cleaning} className="flex items-center justify-center gap-2 rounded-xl border border-violet-300/50 bg-violet-400/15 px-4 py-3 text-sm font-bold text-violet-100 hover:bg-violet-400/25 disabled:opacity-50">
                      {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      {cleaning ? "AI가 선과 색을 정돈하는 중…" : aiImage ? "AI로 다시 정돈하기" : "손그림을 AI로 정돈하기"}
                    </button>
                    {aiImage && (
                      <button type="button" onClick={() => setAiImage(null)} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5">
                        촬영한 원본으로 보기
                      </button>
                    )}
                    <button type="button" onClick={() => { setFile(null); setAiImage(null); }} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5">
                      기본 드래곤으로 되돌리기
                    </button>
                  </>
                )}
                <p className="text-xs leading-relaxed text-slate-500">AI 정돈은 버튼을 누른 경우에만 실행됩니다. 사람 얼굴이 들어간 사진은 사용하지 말고, 종이에 그린 드래곤만 촬영해 주세요.</p>
              </div>
            </div>
            {!file && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-300">비늘의 빛깔</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {APPEARANCES.map((item) => (
                    <button key={item.id} type="button" onClick={() => setAppearance(item)} className={`rounded-full border px-3 py-1.5 text-xs ${appearance.id === item.id ? "border-violet-300 bg-violet-400/20 text-violet-100" : "border-white/10 text-slate-400"}`}>
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
            <label className="mt-4 block text-xs font-bold text-slate-300">드래곤 이름</label>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoFocus placeholder="예: 루미" className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-300" />
            <p className="mt-4 text-xs font-bold text-slate-300">원소</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ELEMENTS.map((item) => (
                <button key={item.value} type="button" onClick={() => setElement(item.value)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${element === item.value ? item.color : "border-white/10 bg-white/5 text-slate-400"}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-bold text-slate-300">성격</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERSONALITIES.map((item) => (
                <button key={item} type="button" onClick={() => setPersonality(item)} className={`rounded-full border px-3 py-1.5 text-xs ${personality === item ? "border-violet-300 bg-violet-400/20 text-violet-100" : "border-white/10 text-slate-400"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-bold text-white">함께 만들 성장서사를 약속해요</h3>
            <label className="mt-4 block text-xs font-bold text-slate-300">우리의 첫 만남</label>
            <textarea value={origin} onChange={(event) => setOrigin(event.target.value)} maxLength={120} rows={3} className="mt-1 w-full resize-none rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-300" />
            <p className="mt-4 text-xs font-bold text-slate-300">첫 번째 성장 목표</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GOALS.map((item) => (
                <button key={item} type="button" onClick={() => setGoal(item)} className={`rounded-full border px-3 py-1.5 text-xs ${goal === item ? "border-amber-300 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-400"}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-200"><Sparkles className="h-4 w-4" /> 성장서사 미리보기</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{storyPreview}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onCancel?.()} className="flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" /> {step === 1 ? "취소" : "이전"}
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={step === 2 && !name.trim()} className="flex items-center gap-1 rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-violet-200 disabled:opacity-40">
              다음 <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => void createDragon()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-200 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "드래곤을 깨우는 중…" : "만들고 첫 만남 시작"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
