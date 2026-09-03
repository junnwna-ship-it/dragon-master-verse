import { createFileRoute } from "@tanstack/react-router";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Login — Artiati Dragon Masters" },
      {
        name: "description",
        content: "Sign in with an admin account to manage store items, story maps and game settings.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin Login — Artiati Dragon Masters" },
      { property: "og:description", content: "Admin sign-in and admin account setup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLoginRoute,
});

function AdminLoginRoute() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <AdminLogin />
      <Toaster />
    </div>
  );
}
