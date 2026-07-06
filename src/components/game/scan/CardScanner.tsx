import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Sparkles, Upload, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { recognizeCard } from "@/lib/scan.functions";
import { useGameStore, type Dragon } from "@/store/dragons";

type Recognized = {
  name: string;
  element: Dragon["element"];
  hp: number;
  mp: number;
  atk: number;
  def: number;
  confidence: number;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Downscale to keep the payload reasonable
async function compressImage(dataUrl: string, maxSize = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function CardScanner({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const addDragon = useGameStore((s) => s.addDragon);

  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"capture" | "analyzing" | "review">("capture");
  const [result, setResult] = useState<Recognized | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    try {
      setStep("analyzing");
      const raw = await fileToDataUrl(file);
      const compressed = await compressImage(raw);
      setPreview(compressed);
      const recognized = await recognizeCard({ data: { imageBase64: compressed } });
      setResult(recognized as Recognized);
      setStep("review");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("scan.recognizeFailed"));
      setStep("capture");
      setPreview(null);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setStep("capture");
  };

  const save = async () => {
    if (!result || !preview) return;
    setSaving(true);
    try {
      // Upload image
      const blob = await (await fetch(preview)).blob();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("card-scans")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      // Insert DB row
      const { error: dbErr } = await supabase.from("scanned_cards").insert({
        user_id: userId,
        name: result.name,
        element: result.element,
        hp: result.hp,
        max_hp: result.hp,
        mp: result.mp,
        atk: result.atk,
        def: result.def,
        image_url: path,
        confidence: result.confidence,
      });
      if (dbErr) throw dbErr;

      // Add to local roster
      addDragon({
        name: result.name,
        element: result.element,
        hp: result.hp,
        maxHp: result.hp,
        mp: result.mp,
        atk: result.atk,
        def: result.def,
      });

      toast.success(t("scan.saved", { name: result.name }));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("scan.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-bold text-slate-100">{t("scan.title")}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "capture" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              {t("scan.intro")}
            </p>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-4 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              <Camera className="h-5 w-5" /> {t("scan.camera")}
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              <Upload className="h-4 w-4" /> {t("scan.gallery")}
            </button>
          </div>
        )}

        {step === "analyzing" && (
          <div className="space-y-3 py-6 text-center">
            {preview && (
              <img src={preview} alt="" className="mx-auto h-40 w-32 rounded-xl object-cover" />
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              {t("scan.analyzing")}
            </div>
          </div>
        )}

        {step === "review" && result && preview && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <img src={preview} alt="" className="h-32 w-24 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  value={result.name}
                  onChange={(e) => setResult({ ...result, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm font-bold text-slate-100"
                />
                <select
                  value={result.element}
                  onChange={(e) =>
                    setResult({ ...result, element: e.target.value as Dragon["element"] })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                >
                  {["Wood", "Water", "Fire", "Earth"].map((el) => (
                    <option key={el} value={el}>
                      {el}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  {t("scan.confidence")}{" "}
                  <span className="font-mono text-amber-300">
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["hp", "mp", "atk", "def"] as const).map((k) => (
                <label key={k} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs">
                  <span className="font-bold uppercase text-slate-400">{k}</span>
                  <input
                    type="number"
                    value={result[k]}
                    onChange={(e) => setResult({ ...result, [k]: Number(e.target.value) })}
                    className="w-14 bg-transparent text-right font-mono text-slate-100 focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={reset}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> {t("scan.rescan")}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("scan.register")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}