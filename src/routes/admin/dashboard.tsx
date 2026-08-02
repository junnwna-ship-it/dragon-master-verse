import { createFileRoute } from "@tanstack/react-router";
import { CmsDashboard } from "@/components/admin/CmsDashboard";
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
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <CmsDashboard />
      <Toaster />
    </div>
  );
}