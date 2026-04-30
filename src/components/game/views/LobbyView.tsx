import { useEffect, useState } from "react";
import { Package, Sparkles, ScanLine, LogOut } from "lucide-react";
import { useGameStore, type Dragon } from "@/store/dragons";
import { DragonCard } from "../DragonCard";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/game/auth/AuthDialog";
import { CardScanner } from "@/components/game/scan/CardScanner";
import { supabase } from "@/integrations/supabase/client";

export function LobbyView() {
  const dragons = useGameStore((s) => s.dragons);
  const setDragons = useGameStore((s) => s.setDragons);
  const inventory = useGameStore((s) => s.inventory);
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showScan, setShowScan] = useState(false);

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
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dragons.map((d) => (
          <DragonCard key={d.id} dragon={d} />
        ))}
      </div>
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
    </div>
  );
}