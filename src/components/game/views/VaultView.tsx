import { useMemo } from "react";
import { Heart, Sword, Shield, Droplet, X, Check, Swords } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { DragonImage } from "../DragonImage";

const elementTone: Record<string, string> = {
  Wood: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  Water: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  Fire: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  Earth: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  Light: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200",
  Dark: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

/**
 * 내 카드 저장소 — 보유 드래곤 그리드와 출전 덱(0/3) 슬롯.
 * 카드 탭 토글로 덱에 추가/해제. 정확히 3마리가 채워져야 PvP 진입 가능.
 */
export function VaultView() {
  const dragons = useGameStore((s) => s.dragons);
  const ownedIds = useGameStore((s) => s.ownedDragonIds);
  const selectedDeck = useGameStore((s) => s.selectedDeck);
  const toggleDeckMember = useGameStore((s) => s.toggleDeckMember);
  const clearDeck = useGameStore((s) => s.clearDeck);
  const setView = useGameStore((s) => s.setView);

  const owned = useMemo(
    () => ownedIds.map((id) => dragons.find((d) => d.id === id)).filter((d): d is Dragon => !!d),
    [ownedIds, dragons],
  );
  const deck = useMemo(
    () => selectedDeck.map((id) => dragons.find((d) => d.id === id)).filter((d): d is Dragon => !!d),
    [selectedDeck, dragons],
  );

  const slots: (Dragon | null)[] = [deck[0] ?? null, deck[1] ?? null, deck[2] ?? null];
  const ready = deck.length === 3;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">내 카드 저장소</h2>
        <p className="text-xs text-slate-400">출전 덱 3마리를 편성하세요</p>
      </div>

      {/* 출전 덱 슬롯 */}
      <section className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            출전 덱 ({deck.length}/3)
          </p>
          {deck.length > 0 && (
            <button
              onClick={clearDeck}
              className="text-[10px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            >
              비우기
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((d, i) => (
            <div
              key={i}
              className={`relative aspect-[3/4] overflow-hidden rounded-xl border ${
                d ? "border-amber-500/60 bg-slate-900/60" : "border-dashed border-slate-600/60 bg-slate-900/40"
              }`}
            >
              {d ? (
                <button
                  type="button"
                  onClick={() => toggleDeckMember(d.id)}
                  className="group block h-full w-full"
                  aria-label={`${d.name} 덱에서 제외`}
                >
                  <DragonImage dragon={d} className="h-full w-full" />
                  <span className="absolute right-1 top-1 rounded-full bg-rose-500/90 p-0.5 opacity-0 transition group-hover:opacity-100">
                    <X className="h-3 w-3 text-white" />
                  </span>
                  <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/90 to-transparent px-1.5 py-1 text-left">
                    <span className="block truncate text-[11px] font-bold text-slate-100">{d.name}</span>
                    <span className="block text-[9px] text-slate-400">#{i + 1} · {d.element}</span>
                  </span>
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-600">
                  <span className="text-2xl font-bold">{i + 1}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => setView("pvp")}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
        >
          <Swords className="h-4 w-4" />
          {ready ? "PvP 아레나 진입" : `덱 편성 필요 (${deck.length}/3)`}
        </button>
      </section>

      {/* 보유 드래곤 */}
      <section>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          보유 드래곤 ({owned.length})
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {owned.map((d) => {
            const sel = selectedDeck.includes(d.id);
            const tone = elementTone[d.element] ?? elementTone.Wood;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDeckMember(d.id)}
                className={`group relative overflow-hidden rounded-xl border text-left transition ${
                  sel
                    ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-900/30"
                    : "border-slate-700/60 bg-slate-800/60 hover:border-slate-500"
                }`}
              >
                <div className="relative aspect-square">
                  <DragonImage dragon={d} className="h-full w-full" />
                  {sel && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-bold text-slate-100">{d.name}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase ${tone}`}>
                      {d.element}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px] text-slate-300">
                    <span className="flex items-center gap-1"><Heart className="h-2.5 w-2.5 text-emerald-400" />{d.maxHp}</span>
                    <span className="flex items-center gap-1"><Droplet className="h-2.5 w-2.5 text-sky-400" />{d.mp}</span>
                    <span className="flex items-center gap-1"><Sword className="h-2.5 w-2.5" />{d.atk}</span>
                    <span className="flex items-center gap-1"><Shield className="h-2.5 w-2.5" />{d.def}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}