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
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Unified scroll/snap engine.
  //
  // Why one effect (not two): the previous split between an
  // IntersectionObserver-driven `centeredId` and a `scroll`-event-driven
  // settle timer caused velocity-dependent jitter — at fast flick speeds the
  // observer's coarse 0.25/0.5/0.75 thresholds would flip between two
  // adjacent cards, and the fixed 140ms idle could fire mid-inertia before
  // the browser's snap point was reached, locking onto the wrong card.
  //
  // The new approach picks `centeredId` from a precise center-distance
  // measurement on every scroll frame (cheap: only the card centers and the
  // viewport center), and the idle timeout adapts to scroll velocity so we
  // wait longer after a fast flick than after a gentle drag.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    let lastScrollLeft = root.scrollLeft;
    let lastScrollAt = performance.now();
    // Rolling estimate of |dx/dt| in px/ms, smoothed so a single fast frame
    // doesn't dominate the idle wait calculation.
    let velocityPxPerMs = 0;

    const pickCentered = () => {
      const rootRect = root.getBoundingClientRect();
      const viewportCenter = rootRect.left + rootRect.width / 2;
      let bestId: number | null = null;
      let bestDist = Infinity;
      cardRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        const center = r.left + r.width / 2;
        const dist = Math.abs(center - viewportCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
        }
      });
      // Hysteresis band: only consider a card "centered" if it's well within
      // the viewport. Half a viewport width is a wide tolerance because the
      // closest card always wins, but this guards the empty-scroller case.
      if (bestId !== null && bestDist < rootRect.width * 0.5) {
        if (centeredIdRef.current !== bestId) {
          centeredIdRef.current = bestId;
          setCenteredId(bestId);
        }
      }
    };

    // Adaptive idle: faster scrolls need longer settle waits because the
    // browser is still animating snap-back inertia after the user lifts.
    //   • <0.3 px/ms (slow drag)        → 110ms
    //   • 0.3–1.2 px/ms (normal swipe)  → 160ms
    //   • >1.2 px/ms (hard flick)       → 240ms
    const computeIdleDelay = () => {
      if (velocityPxPerMs < 0.3) return 110;
      if (velocityPxPerMs < 1.2) return 160;
      return 240;
    };

    const onScroll = () => {
      const now = performance.now();
      const dx = Math.abs(root.scrollLeft - lastScrollLeft);
      const dt = Math.max(1, now - lastScrollAt);
      // Exponential smoothing — alpha 0.4 keeps reactivity but kills jitter.
      velocityPxPerMs = velocityPxPerMs * 0.6 + (dx / dt) * 0.4;
      lastScrollLeft = root.scrollLeft;
      lastScrollAt = now;

      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        setIsScrolling(true);
      }

      // Recompute centered card on the next animation frame so we sample at
      // a stable rAF cadence (rather than once per scroll event, which can
      // fire dozens of times per frame on trackpads).
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          pickCentered();
        });
      }

      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Final pick after motion stops, in case the last rAF was throttled.
        pickCentered();
        isScrollingRef.current = false;
        setIsScrolling(false);
        velocityPxPerMs = 0;
        // Lock onto whatever card the snap engine actually settled at.
        setSnappedId(centeredIdRef.current);
      }, computeIdleDelay());
    };

    // Initial pick (also handles the case where the scroller is already
    // positioned on a card before any user interaction).
    pickCentered();
    setSnappedId(centeredIdRef.current);

    root.addEventListener("scroll", onScroll, { passive: true });
    // Re-measure on resize so center-distance stays accurate when the
    // viewport changes mid-session (rotation, devtools, etc.).
    const ro = new ResizeObserver(() => pickCentered());
    ro.observe(root);

    return () => {
      root.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (idleTimer) clearTimeout(idleTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
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
        role="region"
        aria-roledescription="carousel"
        aria-label="내 드래곤 목록 - 좌우로 스와이프하여 탐색"
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <ul role="list" className="contents">
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
          // Descriptive label so AT users hear name, element, and core
          // stats when focus reaches the card without opening the modal.
          const cardLabel =
            `${d.name}, ${d.element} 속성. ` +
            `ATK ${d.atk}, DEF ${d.def}, HP ${d.hp} of ${d.maxHp}, MP ${d.mp}.` +
            (isSelected ? " 현재 선택됨." : "") +
            " 누르면 상세 모달이 열립니다.";
          return (
            <li
              key={d.id}
              data-dragon-id={d.id}
              ref={(el) => {
                if (el) cardRefs.current.set(d.id, el);
                else cardRefs.current.delete(d.id);
              }}
              role="button"
              aria-roledescription="slide"
              aria-label={cardLabel}
              aria-current={isSelected ? "true" : undefined}
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
              // snap-always = `scroll-snap-stop: always`. Without this, a
              // single fast flick can blow past 2-3 cards before the snap
              // engine engages, making the resulting "centered" selection
              // feel random. With it, every card becomes a hard stop so
              // slow drags and fast flicks both land on the next card.
              className={`group block cursor-pointer snap-always rounded-3xl list-none will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
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
            </li>
          );
        })}
        </ul>
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
        // Derived: always show the currently globally-selected dragon, and
        // expose navigation hooks so the user can swipe / arrow-key through
        // the roster without closing the modal. Navigation cycles wrap
        // around for a smooth carousel feel.
        const idx = dragons.findIndex((x) => x.id === pvpSelectedDragonId);
        if (idx < 0) return null;
        const d = dragons[idx];
        const goTo = (nextIdx: number) => {
          const n = dragons.length;
          if (n === 0) return;
          const wrapped = ((nextIdx % n) + n) % n;
          const target = dragons[wrapped];
          if (target) setPvpSelectedDragonId(target.id);
        };
        return (
          <DragonDetailModal
            dragon={d}
            onClose={() => setDetailOpen(false)}
            onNext={dragons.length > 1 ? () => goTo(idx + 1) : undefined}
            onPrev={dragons.length > 1 ? () => goTo(idx - 1) : undefined}
            hasNext={dragons.length > 1}
            hasPrev={dragons.length > 1}
          />
        );
      })()}
    </div>
  );
}