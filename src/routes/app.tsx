import { createFileRoute, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { Coins, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/store/dragons";
import { BottomNav } from "@/components/game/BottomNav";
import { LobbyView } from "@/components/game/views/LobbyView";
import { PvpView } from "@/components/game/views/PvpView";
import { VaultView } from "@/components/game/views/VaultView";
import { AdminView } from "@/components/game/views/AdminView";
import { DebugView } from "@/components/game/views/DebugView";
import { ShopView } from "@/components/game/views/ShopView";
import { SummonView } from "@/components/game/views/SummonView";
import { TrainingView } from "@/components/game/views/TrainingView";
import { useAuth } from "@/hooks/useAuth";
import { useProfileStats } from "@/hooks/useProfileStats";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageToggle } from "@/components/LanguageToggle";

const appSearchSchema = z.object({
  view: z
    .enum(["lobby", "story", "pvp", "vault", "shop", "summon", "training", "admin", "debug"])
    .optional(),
});

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Play — Artiati Dragon Masters" },
      {
        name: "description",
        content:
          "Your dragon lobby: vault, training, shop, PvP arena and story chapters in one mobile-first hub.",
      },
      { property: "og:title", content: "Play — Artiati Dragon Masters" },
      {
        property: "og:description",
        content:
          "Manage your dragons, train stats, shop for items and enter branching story chapters.",
      },
      { property: "og:url", content: "https://dragon-master-verse.lovable.app/app" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://dragon-master-verse.lovable.app/app" }],
  }),
  validateSearch: appSearchSchema,
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  const storedView = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const fetchDragons = useGameStore((s) => s.fetchDragons);
  const loadingDragons = useGameStore((s) => s.loadingDragons);
  const { user, loading: authLoading } = useAuth();
  const { stats: profileStats } = useProfileStats();
  const search = useSearch({ from: "/app" });
  const view = search.view ?? storedView;
  const navigate = useNavigate();

  // Honor `?view=story` deep-link from the landing page (and similar) once.
  useEffect(() => {
    if (search.view) {
      setView(search.view);
      // Strip the param so refresh keeps the chosen view via zustand only.
      void navigate({ to: "/app", search: {}, replace: true });
    }
  }, [search.view, setView, navigate]);

  // Initial cloud sync — re-fetch whenever the signed-in user changes so a
  // fresh login pulls the latest dragons list under the user's session.
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchDragons();
    }
  }, [user, authLoading, fetchDragons]);

  // Unauthenticated users get bounced to the landing page; the landing CTA
  // owns the signup flow now.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      void navigate({ to: "/", replace: true });
    }
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <a
        href="#game-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-amber-200 focus:p-3 focus:text-slate-950"
      >
        본문으로 이동
      </a>
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-900/95 px-4 py-3 backdrop-blur sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 text-slate-950 shadow-lg shadow-amber-900/40">
              <Flame className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Dragon</p>
              <h1 className="text-sm font-bold text-slate-100">MASTERS</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle />
            <div className="flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-amber-300">
              <Coins className="h-3.5 w-3.5" /> {profileStats.gold.toLocaleString()}
            </div>
            <div
              className="flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-xs font-semibold text-emerald-300"
              title="Worm Affinity"
            >
              🪱 {profileStats.worm_affinity}
            </div>
            <div
              className="flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-xs font-semibold text-rose-300"
              title="Courage"
            >
              🔥 {profileStats.courage}
            </div>
          </div>
        </header>
        <div className="flex flex-1 lg:gap-6 lg:px-6">
          <aside className="hidden w-48 shrink-0 border-r border-slate-800/60 py-8 pr-4 lg:block">
            <BottomNav desktop />
          </aside>
          <main
            id="game-content"
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-0 lg:py-8"
          >
            {loadingDragons && user && (
              <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-center text-xs text-slate-400">
                {t("app.syncingDragons")}
              </div>
            )}
            {view === "lobby" && <LobbyView />}
            {view === "vault" && <VaultView />}
            {view === "story" && (
              <Navigate
                to="/story/play/$chapterId"
                params={{ chapterId: "dragon_master" }}
                replace
              />
            )}
            {view === "pvp" && <PvpView />}
            {view === "shop" && (
              <ErrorBoundary label={t("app.shopLabel")}>
                <ShopView />
              </ErrorBoundary>
            )}
            {view === "summon" && (
              <ErrorBoundary label={t("summon.title")}>
                <SummonView />
              </ErrorBoundary>
            )}
            {view === "training" && (
              <ErrorBoundary label={t("app.trainingLabel")}>
                <TrainingView />
              </ErrorBoundary>
            )}
            {view === "admin" && <AdminView />}
            {view === "debug" && <DebugView />}
          </main>
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
