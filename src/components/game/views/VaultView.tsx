import { useMemo } from "react";
import { Heart, Sword, Shield, Droplet, X, Swords, Plus } from "lucide-react";
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
  const full = ready;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">내 카드 저장소</h2>
        <p className="text-xs text-slate-400">출전 덱 3마리를 편성하세요</p>
      </div>

      {/* 출전 덱 슬롯 — sticky로 항상 보이게 */}
      <section
        className={`sticky top-0 z-10 -mx-4 rounded-b-2xl border-b border-slate-700/60 bg-slate-900/95 px-4 pb-3 pt-3 backdrop-blur transition ${
          ready ? "shadow-[0_4px_20px_-8px_rgba(245,158,11,0.4)]" : ""
        }`}
      >
        <style>{`
          @keyframes vault-slot-pop {
            0% { transform: scale(0.85); opacity: 0; }
            55% { transform: scale(1.06); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .vault-slot-pop { animation: vault-slot-pop 0.28s ease-out 1; }
          @keyframes vault-dot-fill {
            0% { transform: scale(0.6); }
            55% { transform: scale(1.25); }
            100% { transform: scale(1); }
          }
          .vault-dot-fill { animation: vault-dot-fill 0.32s ease-out 1; }
        `}</style>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              출전 덱
            </p>
            {/* 점 인디케이터 — 0/3을 시각화 */}
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => {
                const filled = i < deck.length;
                return (
                  <span
                    key={i}
                    className={`block h-2 w-2 rounded-full transition-colors ${
                      filled ? "vault-dot-fill bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.7)]" : "bg-slate-700"
                    }`}
                  />
                );
              })}
            </div>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                ready ? "text-amber-300" : "text-slate-300"
              }`}
            >
              {deck.length}/3
            </span>
          </div>
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
              className={`relative aspect-[3/4] overflow-hidden rounded-xl border transition ${
                d
                  ? "border-amber-500 bg-slate-900/60 shadow-lg shadow-amber-900/30"
                  : "border-dashed border-slate-600/60 bg-slate-900/40"
              }`}
            >
              {/* 슬롯 번호 배지 — 항상 좌상단에 표시 */}
              <span
                className={`absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  d ? "bg-amber-500 text-slate-950 shadow" : "bg-slate-800 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              {d ? (
                <button
                  type="button"
                  // 새 카드가 들어올 때마다 pop 애니메이션 — key=드래곤 ID
                  key={d.id}
                  onClick={() => toggleDeckMember(d.id)}
                  className="vault-slot-pop group block h-full w-full"
                  aria-label={`${d.name} 덱에서 제외`}
                >
                  <DragonImage dragon={d} className="h-full w-full" />
                  <span className="absolute right-1 top-1 z-10 rounded-full bg-rose-500/90 p-0.5 opacity-0 transition group-hover:opacity-100">
                    <X className="h-3 w-3 text-white" />
                  </span>
                  <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent px-1.5 py-1 text-left">
                    <span className="block truncate text-[11px] font-bold text-slate-100">{d.name}</span>
                    <span className="block text-[9px] text-slate-400">{d.element}</span>
                  </span>
                </button>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-600">
                  <Plus className="h-5 w-5" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider">비어있음</span>
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
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            보유 드래곤 ({owned.length})
          </p>
          {full && (
            <p className="text-[10px] text-amber-300">덱이 가득 찼어요 — 교체하려면 슬롯을 탭하세요</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {owned.map((d) => {
            const slotIdx = selectedDeck.indexOf(d.id);
            const sel = slotIdx >= 0;
            const dim = full && !sel;
            const tone = elementTone[d.element] ?? elementTone.Wood;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDeckMember(d.id)}
                aria-pressed={sel}
                className={`group relative overflow-hidden rounded-xl border text-left transition active:scale-[0.97] ${
                  sel
                    ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-400/50 shadow-lg shadow-amber-900/30"
                    : dim
                      ? "border-slate-800 bg-slate-900/40 opacity-50 hover:opacity-90"
                      : "border-slate-700/60 bg-slate-800/60 hover:border-slate-500"
                }`}
              >
                <div className="relative aspect-square">
                  <DragonImage dragon={d} className="h-full w-full" />
                  {sel ? (
                    // 선택됨 → 슬롯 번호 배지 (#1/#2/#3)
                    <span className="vault-dot-fill absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-slate-950 shadow ring-2 ring-amber-300/50">
                      {slotIdx + 1}
                    </span>
                  ) : (
                    !dim && (
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-slate-300 opacity-0 ring-1 ring-slate-600 transition group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    )
                  )}
                  {sel && (
                    <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-950">
                      출전 #{slotIdx + 1}
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