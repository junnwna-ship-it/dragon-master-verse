import { useEffect, useRef, useState } from "react";
import { Package, Sparkles, ScanLine, LogOut } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { DragonCard } from "../DragonCard";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/game/auth/AuthDialog";
import { CardScanner } from "@/components/game/scan/CardScanner";
import { supabase } from "@/integrations/supabase/client";
import { DragonDetailModal } from "../DragonDetailModal";

export function LobbyView() {
  const dragons = useGameStore((s) => s.dragons);
  const setDragons = useGameStore((s) => s.setDragons);
  const inventory = useGameStore((s) => s.inventory);
  // Mirror lobby tap-selection into the global PvP selection so the user's
  // current pick is the same dragon that the PvP picker will pre-highlight.
  const pvpSelectedDragonId = useGameStore((s) => s.pvpSelectedDragonId);
  const setPvpSelectedDragonId = useGameStore((s) => s.setPvpSelectedDragonId);
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showScan, setShowScan] = useState(false);
  // Tracks which dragon card is currently centered in the snap-scroll row
  // (driven by IntersectionObserver) and which one is user-selected via tap.
  const [centeredId, setCenteredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Whether the detail modal is open. The dragon shown inside is ALWAYS
  // derived from the global PvP selection so that picking a different card
  // (or having the selection change from any other surface) instantly
  // refreshes the modal content without a close/reopen cycle.
  const [detailOpen, setDetailOpen] = useState(false);

  // Two-way sync with the global store:
  //  • If the global PvP selection changes elsewhere (e.g. PvP picker), the
  //    lobby card highlight should follow.
  //  • If the user taps a card here, push that id into the global store.
  useEffect(() => {
    setSelectedId(pvpSelectedDragonId);
  }, [pvpSelectedDragonId]);

  // If the globally selected dragon disappears (e.g. roster refresh) while
  // the modal is open, close it — there's nothing to show.
  useEffect(() => {
    if (detailOpen && pvpSelectedDragonId === null) {
      setDetailOpen(false);
    }
  }, [detailOpen, pvpSelectedDragonId]);
  // True while a touch/wheel scroll is active OR within ~140ms of the last
  // scroll event — drives the "live micro-hover" applied to the snapping
  // card during the swipe gesture. Once it flips back to false, the card
  // that ended up centered keeps a calmer "snapped" highlight.
  const [isScrolling, setIsScrolling] = useState(false);
  // The card that the scroller settled on after the most recent gesture.
  // Distinct from `centeredId` (live during swipe) and `selectedId` (tap).
  const [snappedId, setSnappedId] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Observe each card's intersection ratio inside the horizontal scroller and
  // mark the one closest to the viewport center as "centered" — this drives
  // the smooth hover-style scale/glow as the user swipes.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const ratios = new Map<number, number>();
    const recomputeCentered = () => {
      let bestId: number | null = null;
      let bestRatio = 0;
      ratios.forEach((r, id) => {
        if (r > bestRatio) {
          bestRatio = r;
          bestId = id;
        }
      });
      setCenteredId(bestRatio > 0.55 ? bestId : null);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idAttr = (e.target as HTMLElement).dataset.dragonId;
          if (!idAttr) continue;
          ratios.set(Number(idAttr), e.intersectionRatio);
        }
        recomputeCentered();
      },
      { root, threshold: [0.25, 0.5, 0.75, 1] },
    );
    cardRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dragons]);

  // Track active scrolling so we can split visual treatment into two
  // distinct phases:
  //   • during scroll → the centered card gets a live "micro-hover"
  //     (subtle lift + brightness boost) that follows the snap point.
  //   • after scroll  → the highlight settles on the snapped card and
  //     stays put even after the user lifts their finger.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        setIsScrolling(true);
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isScrollingRef.current = false;
        setIsScrolling(false);
        // Lock the snapped card to whatever was centered when motion stopped.
        setSnappedId(centeredIdRef.current);
      }, 140);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [dragons]);

  // Refs mirror state so the scroll handler (which doesn't re-bind on
  // every render) can read the latest values without stale closures.
  const isScrollingRef = useRef(false);
  const centeredIdRef = useRef<number | null>(null);
  useEffect(() => {
    centeredIdRef.current = centeredId;
  }, [centeredId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("scanned_cards")
        .select("id,name,element,hp,max_hp,mp,atk,def")
        .order("created_at", { ascending: true });
      if (cancelled || !data) return;
      const seed = useGameStore.getState().dragons.filter((d) => d.id <= 3);
      const remote: Dragon[] = data.map((r, i) => ({
        id: 1000 + i,
        name: r.name,
        element: r.element as Dragon["element"],
        hp: r.hp,
        maxHp: r.max_hp,
        mp: r.mp,
        atk: r.atk,
        def: r.def,
      }));
      setDragons([...seed, ...remote]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, setDragons]);

  const handleScanClick = () => {
    if (!user) setShowAuth(true);
    else setShowScan(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">My Collection</p>
          <h2 className="text-2xl font-bold text-slate-100">My Dragons</h2>
        </div>
        {!loading && user && (
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300"
          >
            <LogOut className="h-3 w-3" />
            로그아웃
          </button>
        )}
      </div>
      <button
        onClick={handleScanClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-rose-500/10 px-4 py-3 text-sm font-bold text-amber-200 hover:from-amber-500/25 hover:to-rose-500/20"
      >
        <ScanLine className="h-4 w-4" />
        {user ? "카드 스캔으로 등록" : "로그인하고 카드 스캔하기"}
      </button>
      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {dragons.map((d) => {
          const isCentered = centeredId === d.id;
          const isSelected = selectedId === d.id;
          const isSnapped = snappedId === d.id;
          // While a swipe is active, the centered card gets a quick,
          // springy micro-hover. This MUST NOT override an existing tap
          // selection — selectedId always wins visually.
          const liveHover = isScrolling && isCentered && !isSelected;
          // After the gesture ends, the snapped card keeps a soft persistent
          // highlight (only when the user hasn't already tapped one).
          const settledSnap = !isScrolling && isSnapped && !isSelected;
          return (
            <div
              key={d.id}
              data-dragon-id={d.id}
              ref={(el) => {
                if (el) cardRefs.current.set(d.id, el);
                else cardRefs.current.delete(d.id);
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => {
                setPvpSelectedDragonId(d.id);
                setDetailOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPvpSelectedDragonId(d.id);
                  setDetailOpen(true);
                }
              }}
              // Transition timing differs by phase:
              //  • live swipe → short 180ms ease-out (springy follow)
              //  • settled    → calmer 300ms ease-out (locks in place)
              className={`group cursor-pointer rounded-3xl will-change-transform ${
                isScrolling ? "transition-all duration-[180ms] ease-out" : "transition-all duration-300 ease-out"
              } ${
                isSelected
                  ? "scale-[1.04] opacity-100 ring-2 ring-amber-400/70 shadow-2xl shadow-amber-500/30 brightness-105"
                  : liveHover
                    ? "scale-[1.035] -translate-y-0.5 opacity-100 shadow-xl shadow-black/40 brightness-110"
                    : settledSnap
                      ? "scale-[1.02] opacity-100 shadow-lg shadow-black/40 ring-1 ring-slate-300/20"
                      : isCentered
                        ? "scale-[1.01] opacity-95 shadow-lg shadow-black/30"
                        : "scale-95 opacity-80 hover:scale-100 hover:opacity-100"
              }`}
            >
              <DragonCard dragon={d} />
            </div>
          );
        })}
      </div>
      {selectedId !== null && (
        <p className="-mt-2 px-1 text-[11px] text-amber-300/80 animate-in fade-in duration-200">
          선택됨: {dragons.find((d) => d.id === selectedId)?.name}
        </p>
      )}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-slate-100">Inventory</h2>
          <span className="text-[10px] font-mono text-slate-500">{inventory.length} items</span>
        </div>
        {inventory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-800/30 px-4 py-6 text-center text-xs text-slate-500">
            Story 스테이지를 클리어해 아이템을 모아보세요
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {inventory.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-2.5"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    it.kind === "equipment"
                      ? "bg-sky-500/15 text-sky-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {it.kind === "equipment" ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-100">{it.name}</p>
                  <p className="text-[10px] uppercase text-slate-500">×{it.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
      {showScan && user && (
        <CardScanner userId={user.id} onClose={() => setShowScan(false)} />
      )}
      {detailOpen && (() => {
        // Derived: always show the currently globally-selected dragon.
        const d = dragons.find((x) => x.id === pvpSelectedDragonId);
        return d ? (
          <DragonDetailModal dragon={d} onClose={() => setDetailOpen(false)} />
        ) : null;
      })()}
    </div>
  );
}