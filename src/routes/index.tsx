import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Flame } from "lucide-react";
import { useGameStore } from "@/store/dragons";
import { BottomNav } from "@/components/game/BottomNav";
import { LobbyView } from "@/components/game/views/LobbyView";
import { StoryView } from "@/components/game/views/StoryView";
import { PvpView } from "@/components/game/views/PvpView";
import { VaultView } from "@/components/game/views/VaultView";
import { AdminView } from "@/components/game/views/AdminView";
import { DebugView } from "@/components/game/views/DebugView";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/game/auth/AuthDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dragon Masters — 드래곤 마스터즈" },
      { name: "description", content: "Collect and battle mystical dragons in the mobile fantasy arena." },
    ],
  }),
  component: Index,
});

function Index() {
  const view = useGameStore((s) => s.view);
  const gold = useGameStore((s) => s.gold);
  const fetchDragons = useGameStore((s) => s.fetchDragons);
  const loadingDragons = useGameStore((s) => s.loadingDragons);
  const { user, loading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  // Initial cloud sync — re-fetch whenever the signed-in user changes so a
  // fresh login pulls the latest dragons list under the user's session.
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchDragons();
    }
  }, [user, authLoading, fetchDragons]);

  // Force unauthenticated users to sign in — RLS denies all dragon reads
  // without a session, so we gate the entire app on auth.
  useEffect(() => {
    if (!authLoading && !user) setShowAuth(true);
    if (user) setShowAuth(false);
  }, [user, authLoading]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/60 bg-slate-900/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 text-slate-950 shadow-lg shadow-amber-900/40">
              <Flame className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Dragon</p>
              <h1 className="text-sm font-bold text-slate-100">MASTERS</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-amber-300">
            <Coins className="h-3.5 w-3.5" /> {gold.toLocaleString()}
          </div>
        </header>
        <main className="flex-1 px-4 py-5">
          {loadingDragons && user && (
            <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-center text-xs text-slate-400">
              드래곤 목록 동기화 중…
            </div>
          )}
          {view === "lobby" && <LobbyView />}
          {view === "vault" && <VaultView />}
          {view === "story" && <StoryView />}
          {view === "pvp" && <PvpView />}
          {view === "admin" && <AdminView />}
          {view === "debug" && <DebugView />}
        </main>
        <BottomNav />
      </div>
      <Toaster />
      {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
    </div>
  );
}
