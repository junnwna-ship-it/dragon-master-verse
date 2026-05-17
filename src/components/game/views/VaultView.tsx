import { useMemo } from "react";
import { X, Swords, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameStore, type Dragon } from "@/store/dragons";
import { DragonImage } from "../DragonImage";
import { GlassDragonCard } from "../GlassDragonCard";

/**
 * 내 카드 저장소 — 보유 드래곤 그리드와 출전 덱(0/3) 슬롯.
 * 카드 탭 토글로 덱에 추가/해제. 정확히 3마리가 채워져야 PvP 진입 가능.
 */
export function VaultView() {
  const { t } = useTranslation();
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
        <h2 className="text-xl font-bold text-slate-100">{t("vault.title")}</h2>
        <p className="text-xs text-slate-400">{t("vault.subtitle")}</p>
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
              {t("vault.deckLabel")}
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
              {t("vault.clear")}
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
                  aria-label={t("vault.removeFromDeck", { name: d.name })}
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
                  <span className="text-[9px] font-semibold uppercase tracking-wider">{t("vault.empty")}</span>
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
          {ready ? t("vault.enterPvp") : t("vault.needDeck", { count: deck.length })}
        </button>
      </section>

      {/* 보유 드래곤 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t("vault.ownedTitle", { count: owned.length })}
          </p>
          {full && (
            <p className="text-[10px] text-amber-300">{t("vault.deckFullHint")}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {owned.map((d) => {
            const slotIdx = selectedDeck.indexOf(d.id);
            const sel = slotIdx >= 0;
            const dim = full && !sel;
            return (
              <GlassDragonCard
                key={d.id}
                dragon={d}
                onClick={() => toggleDeckMember(d.id)}
                selected={sel}
                dim={dim}
                slotIndex={sel ? slotIdx + 1 : undefined}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}