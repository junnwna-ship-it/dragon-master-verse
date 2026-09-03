import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { CmsDashboard } from "@/components/admin/CmsDashboard";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin CMS — Artiati Dragon Masters" },
      {
        name: "description",
        content: "Admin-only content dashboard for store items, training stats, story nodes and global game settings.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin CMS — Artiati Dragon Masters" },
      {
        property: "og:description",
        content: "Manage store items, training stats, story map nodes and global settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  const { isAdmin, loading } = useIsAdmin();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {loading ? (
        <p className="flex items-center gap-2 p-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> 권한 확인 중…
        </p>
      ) : isAdmin ? (
        <CmsDashboard />
      ) : (
        <div className="mx-auto max-w-md space-y-3 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-300" />
          <p className="text-sm font-bold text-slate-100">관리자 권한이 필요합니다.</p>
          <p className="text-xs text-slate-400">관리자 계정으로 로그인하거나 관리자 계정을 만들어 주세요.</p>
          <Link
            to="/admin/login"
            className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950"
          >
            관리자 로그인
          </Link>
        </div>
      )}
      <Toaster />
    </div>
  );
}
