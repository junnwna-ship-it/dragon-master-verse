import { useState, type ChangeEvent, type FormEvent } from "react";
import { Trash2, Upload, Plus } from "lucide-react";
import { useGameStore, type Element } from "@/store/dragons";
import { DragonImage } from "../DragonImage";

/**
 * Admin Dashboard — 커스텀 드래곤 생성/삭제. 이미지 업로드는 FileReader로
 * Base64 변환 후 imageUrl에 저장 → localStorage('customDragons')에 영속.
 */
const ELEMENTS: { value: Element; label: string }[] = [
  { value: "Water", label: "Water (수)" },
  { value: "Fire",  label: "Fire (화)" },
  { value: "Wood",  label: "Wood (목)" },
  { value: "Light", label: "Metal/Light (금)" },
  { value: "Earth", label: "Earth (토)" },
  { value: "Dark",  label: "Dark (암)" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function AdminView() {
  const dragons = useGameStore((s) => s.dragons);
  const customDragons = useGameStore((s) => s.customDragons);
  const addCustomDragon = useGameStore((s) => s.addCustomDragon);
  const removeCustomDragon = useGameStore((s) => s.removeCustomDragon);

  const [name, setName] = useState("");
  const [lore, setLore] = useState("");
  const [maxHp, setMaxHp] = useState(1500);
  const [maxMp, setMaxMp] = useState(1000);
  const [atk, setAtk] = useState(1500);
  const [def, setDef] = useState(1000);
  const [element, setElement] = useState<Element>("Water");
  const [imageData, setImageData] = useState<string>("");
  const [imageName, setImageName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const customIds = new Set(customDragons.map((d) => d.id));

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      setImageData(b64);
      setImageName(file.name);
      setError("");
    } catch {
      setError("이미지 변환 실패");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    addCustomDragon({
      name: name.trim(),
      element,
      maxHp,
      hp: maxHp,
      mp: maxMp,
      atk,
      def,
      imageUrl: imageData || undefined,
      lore: lore.trim() || undefined,
    });
    setName("");
    setLore("");
    setImageData("");
    setImageName("");
    setError("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-100">관리자 페이지</h2>
        <p className="text-xs text-slate-400">커스텀 드래곤을 생성·관리합니다 (브라우저 저장)</p>
      </div>

      {/* Create form */}
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">새 드래곤 카드</p>

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
            <span className="mb-1 block text-slate-400">이미지 업로드</span>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 hover:border-amber-500">
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">{imageName || "파일 선택"}</span>
                <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
              </label>
              {imageData && (
                <img
                  src={imageData}
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />새 드래곤 카드 생성하기
        </button>
      </form>

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
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-2"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                  <DragonImage dragon={d} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-100">
                    {d.name}
                    {isCustom && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        CUSTOM
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {d.element} · HP {d.maxHp} · MP {d.mp} · ATK {d.atk} · DEF {d.def}
                  </p>
                </div>
                {isCustom ? (
                  <button
                    type="button"
                    onClick={() => removeCustomDragon(d.id)}
                    aria-label={`${d.name} 삭제`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-[9px] uppercase tracking-wider text-slate-600">기본</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}