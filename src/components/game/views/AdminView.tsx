import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Trash2, Upload, Plus, Pencil, X, Layers, ShieldAlert, Cloud, ToggleRight, Settings2, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGameStore, type Element } from "@/store/dragons";
import { DragonImage } from "../DragonImage";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, type AppSettings } from "@/hooks/useAppSettings";

/**
 * Admin Dashboard — cloud-backed.
 *
 * - Single-create form: writes one dragon row to Supabase. Image (if chosen)
 *   is compressed in-browser to 400x400 JPEG q=0.8 and uploaded to the
 *   `dragon-images` Storage bucket under `<uid>/<random>.jpg`. The returned
 *   public URL is stored as `image_url`.
 * - Bulk grid: pick N images at once, edit per-row stats inline, then
 *   "전체 저장" uploads all images in parallel and bulk-inserts the rows.
 * - Admin-only sections (delete/edit existing rows) are gated by RLS and a
 *   client-side `useIsAdmin()` check that hides the controls.
 */

const ELEMENTS: { value: Element; label: string }[] = [
  { value: "Water", label: "Water (수)" },
  { value: "Fire",  label: "Fire (화)" },
  { value: "Wood",  label: "Wood (목)" },
  { value: "Light", label: "Metal/Light (금)" },
  { value: "Earth", label: "Earth (토)" },
  { value: "Dark",  label: "Dark (암)" },
];

const MAX_DIM = 400;
const JPEG_QUALITY = 0.8;

/** Compress + resize a File to a JPEG Blob no larger than MAX_DIM on its longest side. */
async function compressImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode failed"));
    i.src = dataUrl;
  });
  const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
  return blob;
}

/** Upload a Blob to dragon-images and return its public URL. */
async function uploadDragonImage(blob: Blob, uid: string): Promise<string> {
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("dragon-images")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("[storage] upload failed:", error);
    throw error;
  }
  const { data } = supabase.storage.from("dragon-images").getPublicUrl(path);
  return data.publicUrl;
}

interface BulkRow {
  key: string;
  file: File;
  previewUrl: string;
  name: string;
  element: Element;
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  lore: string;
}

/**
 * Inline toggle row that flips a single feature flag in `app_settings`.
 * Optimistic + realtime — every connected client reflects the change instantly.
 */
function FeatureToggle({
  flagKey,
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  flagKey: keyof AppSettings;
  label: string;
  description: string;
  value: boolean;
  onChange: (key: keyof AppSettings, next: boolean) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-100">{label}</p>
        <p className="truncate text-[11px] text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(flagKey, !value)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
          value ? "bg-emerald-500" : "bg-slate-700"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function AdminView() {
  const dragons = useGameStore((s) => s.dragons);
  const customDragons = useGameStore((s) => s.customDragons);
  const addCustomDragon = useGameStore((s) => s.addCustomDragon);
  const addCustomDragonsBulk = useGameStore((s) => s.addCustomDragonsBulk);
  const removeCustomDragon = useGameStore((s) => s.removeCustomDragon);
  const updateCustomDragon = useGameStore((s) => s.updateCustomDragon);

  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { settings, setFlag } = useAppSettings();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [justUpdatedId, setJustUpdatedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [lore, setLore] = useState("");
  const [maxHp, setMaxHp] = useState(1500);
  const [maxMp, setMaxMp] = useState(1000);
  const [atk, setAtk] = useState(1500);
  const [def, setDef] = useState(1000);
  const [element, setElement] = useState<Element>("Water");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const customIds = useMemo(() => new Set(customDragons.map((d) => d.id)), [customDragons]);

  // Revoke object URLs created for previews when bulk rows go away.
  useEffect(() => {
    return () => {
      bulkRows.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLore("");
    setMaxHp(1500);
    setMaxMp(1000);
    setAtk(1500);
    setDef(1000);
    setElement("Water");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
    setImageName("");
    setError("");
  }

  function startEdit(id: number) {
    if (!isAdmin) {
      toast.error("관리자만 수정할 수 있습니다");
      return;
    }
    const d = customDragons.find((x) => x.id === id);
    if (!d) return;
    setEditingId(id);
    setName(d.name);
    setLore(d.lore ?? "");
    setMaxHp(d.maxHp);
    setMaxMp(d.mp);
    setAtk(d.atk);
    setDef(d.def);
    setElement(d.element);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(d.imageUrl ?? "");
    setImageName(d.imageUrl ? "기존 이미지" : "");
    setError("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageName(file.name);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    setBusy(true);
    try {
      let imageUrl: string | undefined = undefined;
      if (imageFile) {
        const blob = await compressImage(imageFile);
        imageUrl = await uploadDragonImage(blob, user.id);
      } else if (editingId != null) {
        // Keep existing image when editing without re-uploading.
        imageUrl = imagePreview || undefined;
      }

      if (editingId != null) {
        await updateCustomDragon(editingId, {
          name: name.trim(),
          element,
          maxHp,
          hp: maxHp,
          mp: maxMp,
          atk,
          def,
          imageUrl,
          lore: lore.trim() || undefined,
        });
        setJustUpdatedId(editingId);
        toast.success("드래곤이 수정되었습니다");
      } else {
        await addCustomDragon({
          name: name.trim(),
          element,
          maxHp,
          hp: maxHp,
          mp: maxMp,
          atk,
          def,
          imageUrl,
          lore: lore.trim() || undefined,
        });
        toast.success("드래곤이 등록되었습니다");
      }
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("[admin] save failed:", err);
      setError(msg);
      toast.error(`저장 실패: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function onBulkFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const rows: BulkRow[] = files.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 24),
      element: "Water",
      maxHp: 1500,
      maxMp: 1000,
      atk: 1500,
      def: 1000,
      lore: "",
    }));
    setBulkRows((prev) => [...prev, ...rows]);
    e.target.value = "";
  }

  function updateBulk(key: string, patch: Partial<BulkRow>) {
    setBulkRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeBulk(key: string) {
    setBulkRows((rows) => {
      const target = rows.find((r) => r.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return rows.filter((r) => r.key !== key);
    });
  }

  async function submitBulk() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (bulkRows.length === 0) return;
    if (bulkRows.some((r) => !r.name.trim())) {
      toast.error("모든 행에 이름을 입력하세요");
      return;
    }
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: bulkRows.length });
    try {
      // Compress + upload in parallel — track progress so the user sees feedback.
      let done = 0;
      const uploads = await Promise.all(
        bulkRows.map(async (r) => {
          const blob = await compressImage(r.file);
          const url = await uploadDragonImage(blob, user.id);
          done += 1;
          setBulkProgress({ done, total: bulkRows.length });
          return { row: r, url };
        }),
      );

      const payload = uploads.map(({ row, url }) => ({
        name: row.name.trim(),
        element: row.element,
        maxHp: row.maxHp,
        hp: row.maxHp,
        mp: row.maxMp,
        atk: row.atk,
        def: row.def,
        imageUrl: url,
        lore: row.lore.trim() || undefined,
      }));

      await addCustomDragonsBulk(payload);
      toast.success(`${payload.length}마리 일괄 등록 완료`);

      // Cleanup previews.
      bulkRows.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      setBulkRows([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("[admin] bulk save failed:", err);
      toast.error(`일괄 저장 실패: ${msg}`);
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  }

  useEffect(() => {
    if (justUpdatedId == null) return;
    const t = setTimeout(() => setJustUpdatedId(null), 1400);
    return () => clearTimeout(t);
  }, [justUpdatedId]);

  if (!user) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200">
        <div className="flex items-center gap-2 font-bold">
          <ShieldAlert className="h-4 w-4" /> 로그인이 필요합니다
        </div>
        <p className="text-xs text-amber-300/80">
          드래곤을 등록하려면 먼저 로그인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-100">관리자 페이지</h2>
        <p className="text-xs text-slate-400">
          {isAdmin
            ? "커스텀 드래곤을 생성·수정·삭제합니다 (클라우드 동기화)"
            : "커스텀 드래곤을 생성합니다 (수정·삭제는 관리자 전용)"}
        </p>
        {adminLoading ? null : isAdmin ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            <Cloud className="h-3 w-3" /> ADMIN
          </p>
        ) : null}
      </div>

      {/* Feature flags — admin-only live toggles backed by `app_settings`. */}
      {isAdmin && (
        <section className="space-y-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Settings2 className="h-3 w-3" /> Feature Flags (라이브 토글)
          </p>
          <FeatureToggle
            flagKey="isShopOpen"
            label="Shop 오픈"
            description="상점 탭의 잠금 해제 / 구매 RPC 활성화"
            value={settings.isShopOpen}
            onChange={setFlag}
            disabled={false}
          />
          <FeatureToggle
            flagKey="isTrainingOpen"
            label="훈련소 오픈"
            description="드래곤 스탯 분배(스탯 포인트 사용) 활성화"
            value={settings.isTrainingOpen}
            onChange={setFlag}
            disabled={false}
          />
          <p className="pt-1 text-[10px] text-slate-500">
            <ToggleRight className="mr-1 inline h-3 w-3" /> 변경 즉시 모든 클라이언트에 반영됩니다.
          </p>
        </section>
      )}

      {/* Single-card form */}
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {editingId != null ? `드래곤 수정 #${editingId}` : "새 드래곤 카드"}
          </p>
          {editingId != null && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              <X className="h-3 w-3" /> 취소
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block text-xs">
            <span className="mb-1 block text-slate-400">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
              placeholder="드래곤 이름"
            />
          </label>
          <label className="col-span-2 block text-xs">
            <span className="mb-1 block text-slate-400">Lore (특징)</span>
            <textarea
              value={lore}
              onChange={(e) => setLore(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
              placeholder="간단한 특징 설명"
            />
          </label>

          {[
            { label: "Max HP", value: maxHp, set: setMaxHp },
            { label: "Max MP", value: maxMp, set: setMaxMp },
            { label: "ATK",    value: atk,   set: setAtk },
            { label: "DEF",    value: def,   set: setDef },
          ].map((f) => (
            <label key={f.label} className="block text-xs">
              <span className="mb-1 block text-slate-400">{f.label}</span>
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.set(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
              />
            </label>
          ))}

          <label className="col-span-2 block text-xs">
            <span className="mb-1 block text-slate-400">속성</span>
            <select
              value={element}
              onChange={(e) => setElement(e.target.value as Element)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
            >
              {ELEMENTS.map((el) => (
                <option key={el.value} value={el.value}>
                  {el.label}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2 block text-xs">
            <span className="mb-1 block text-slate-400">이미지 업로드 (Storage로 전송)</span>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 hover:border-amber-500">
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">{imageName || "파일 선택"}</span>
                <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
              </label>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-12 w-12 rounded-lg border border-slate-700 object-cover"
                />
              )}
            </div>
          </label>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {editingId != null ? (
            <>
              <Pencil className="h-4 w-4" />
              {busy ? "저장 중…" : "변경사항 저장"}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {busy ? "업로드 중…" : "새 드래곤 카드 생성하기"}
            </>
          )}
        </button>
      </form>

      {/* Bulk upload grid */}
      <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Layers className="h-3 w-3" /> 일괄 업로드
          </p>
          <label className="flex cursor-pointer items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700">
            <Upload className="h-3 w-3" /> 파일 추가
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onBulkFiles}
              className="hidden"
            />
          </label>
        </div>

        {bulkRows.length === 0 ? (
          <p className="text-center text-[11px] text-slate-500">
            여러 이미지 파일을 한 번에 선택해 자동으로 압축(400px, JPEG q0.8)한 뒤<br />
            스탯을 매칭해 일괄 등록할 수 있습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {bulkRows.map((r) => (
              <li
                key={r.key}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={r.previewUrl}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-lg border border-slate-700 object-cover"
                  />
                  <input
                    value={r.name}
                    onChange={(e) => updateBulk(r.key, { name: e.target.value })}
                    placeholder="이름"
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                  />
                  <select
                    value={r.element}
                    onChange={(e) =>
                      updateBulk(r.key, { element: e.target.value as Element })
                    }
                    className="rounded-md border border-slate-700 bg-slate-900 px-1 py-1 text-xs text-slate-100"
                  >
                    {ELEMENTS.map((el) => (
                      <option key={el.value} value={el.value}>
                        {el.value}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeBulk(r.key)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    aria-label="제거"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: "HP", value: r.maxHp, key: "maxHp" as const },
                    { label: "MP", value: r.maxMp, key: "maxMp" as const },
                    { label: "ATK", value: r.atk, key: "atk" as const },
                    { label: "DEF", value: r.def, key: "def" as const },
                  ].map((f) => (
                    <label key={f.label} className="block text-[10px] text-slate-400">
                      <span className="mb-0.5 block">{f.label}</span>
                      <input
                        type="number"
                        value={f.value}
                        onChange={(e) =>
                          updateBulk(r.key, { [f.key]: Number(e.target.value) || 0 })
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-100"
                      />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {bulkRows.length > 0 && (
          <button
            type="button"
            onClick={submitBulk}
            disabled={bulkBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Cloud className="h-4 w-4" />
            {bulkBusy
              ? bulkProgress
                ? `업로드 ${bulkProgress.done}/${bulkProgress.total}…`
                : "업로드 중…"
              : `전체 저장 (${bulkRows.length}마리)`}
          </button>
        )}
      </section>

      {/* Quiz manager — admin only */}
      {isAdmin && <QuizManager />}

      {/* Manage list */}
      <section>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          전체 드래곤 ({dragons.length}) — 커스텀 {customDragons.length}
        </p>
        <ul className="space-y-1.5">
          {dragons.map((d) => {
            const isCustom = customIds.has(d.id);
            return (
              <li
                key={d.id}
                className={`flex items-center gap-3 rounded-xl border bg-slate-900/60 p-2 transition-colors ${
                  justUpdatedId === d.id
                    ? "border-amber-400/70 ring-1 ring-amber-400/40"
                    : "border-slate-800"
                }`}
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                  <DragonImage dragon={d} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-100">
                    {d.name}
                    {isCustom ? (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        CUSTOM
                      </span>
                    ) : (
                      <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                        SEED
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {d.element} · HP {d.maxHp} · MP {d.mp} · ATK {d.atk} · DEF {d.def}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(d.id)}
                      aria-label={`${d.name} 편집`}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        editingId === d.id
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
                      }`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (editingId === d.id) resetForm();
                        try {
                          await removeCustomDragon(d.id);
                          toast.success(`${d.name} 삭제됨`);
                        } catch {
                          /* toast already shown by store */
                        }
                      }}
                      aria-label={`${d.name} 삭제`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] uppercase tracking-wider text-slate-600">
                    {isCustom ? "잠김" : "기본"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * 퀴즈 매니저 — 관리자가 'quizzes' 테이블에 최대 30개 문항을 등록·수정·삭제.
 * 각 문제: 질문, 보기 4개, 정답 인덱스(0–3).
 * RLS는 admin role에 한해 INSERT/UPDATE/DELETE 허용.
 */
const MAX_QUIZZES = 30;

interface QuizRow {
  id: string;
  question: string;
  choices: string[];
  answer_index: number;
  category: string;
}

function QuizManager() {
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [answerIdx, setAnswerIdx] = useState(0);
  const [category, setCategory] = useState("general");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, question, choices, answer_index, category")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(`퀴즈 로드 실패: ${error.message}`); return; }
    setRows((data ?? []).map((r) => ({
      id: r.id, question: r.question, choices: r.choices as string[],
      answer_index: r.answer_index, category: r.category,
    })));
  };

  useEffect(() => { void load(); }, []);

  const reset = () => {
    setEditingId(null); setQuestion(""); setChoices(["", "", "", ""]);
    setAnswerIdx(0); setCategory("general");
  };

  const startEdit = (q: QuizRow) => {
    setEditingId(q.id); setQuestion(q.question);
    const c = [...q.choices, "", "", "", ""].slice(0, 4) as [string, string, string, string];
    setChoices(c); setAnswerIdx(q.answer_index); setCategory(q.category || "general");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) { toast.error("질문을 입력하세요"); return; }
    if (choices.some((c) => !c.trim())) { toast.error("보기 4개를 모두 입력하세요"); return; }
    if (answerIdx < 0 || answerIdx > 3) { toast.error("정답 인덱스가 잘못되었습니다"); return; }
    if (!editingId && rows.length >= MAX_QUIZZES) {
      toast.error(`최대 ${MAX_QUIZZES}개까지 등록할 수 있습니다`); return;
    }
    setBusy(true);
    const payload = {
      question: question.trim(),
      choices: choices.map((c) => c.trim()),
      answer_index: answerIdx,
      category: category.trim() || "general",
    };
    const { error } = editingId
      ? await supabase.from("quizzes").update(payload).eq("id", editingId)
      : await supabase.from("quizzes").insert(payload);
    setBusy(false);
    if (error) { toast.error(`저장 실패: ${error.message}`); return; }
    toast.success(editingId ? "수정 완료" : "퀴즈 등록 완료");
    reset(); await load();
  };

  const remove = async (id: string) => {
    if (!confirm("이 퀴즈를 삭제할까요?")) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) { toast.error(`삭제 실패: ${error.message}`); return; }
    toast.success("삭제됨"); await load();
    if (editingId === id) reset();
  };

  return (
    <section className="space-y-3 rounded-2xl border border-purple-500/40 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-300">
          <HelpCircle className="h-3 w-3" /> 퀴즈 관리 ({rows.length}/{MAX_QUIZZES})
        </p>
        {editingId && (
          <button type="button" onClick={reset}
            className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700">
            <X className="h-3 w-3" /> 취소
          </button>
        )}
      </div>

      <form onSubmit={save} className="space-y-2">
        <label className="block text-xs">
          <span className="mb-1 block text-slate-400">질문</span>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2}
            placeholder="예) 드래곤은 어떤 알에서 부화할까요?"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-500" />
        </label>
        <div className="grid grid-cols-1 gap-2">
          {choices.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-xs">
              <input type="radio" name="answer" checked={answerIdx === i}
                onChange={() => setAnswerIdx(i)}
                className="h-4 w-4 accent-emerald-500" aria-label={`보기 ${String.fromCharCode(65 + i)} 정답으로 선택`} />
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                answerIdx === i ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}>{String.fromCharCode(65 + i)}</span>
              <input value={c} onChange={(e) => {
                const next = [...choices] as [string, string, string, string];
                next[i] = e.target.value; setChoices(next);
              }} placeholder={`보기 ${i + 1}`}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-purple-500" />
            </label>
          ))}
        </div>
        <label className="block text-xs">
          <span className="mb-1 block text-slate-400">카테고리</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-500" />
        </label>
        <button type="submit" disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-400 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editingId ? "변경사항 저장" : "퀴즈 등록"}
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-4 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
          아직 등록된 퀴즈가 없습니다
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((q) => (
            <li key={q.id}
              className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{q.question}</p>
                <p className="truncate text-[10px] text-slate-400">
                  정답: <span className="font-bold text-emerald-300">{String.fromCharCode(65 + q.answer_index)}. {q.choices[q.answer_index]}</span>
                  {" · "}{q.category}
                </p>
              </div>
              <button type="button" onClick={() => startEdit(q)}
                aria-label="편집"
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  editingId === q.id ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
                }`}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(q.id)}
                aria-label="삭제"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}