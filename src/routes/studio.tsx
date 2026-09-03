import { createFileRoute } from "@tanstack/react-router";
import { CreatorStudio } from "@/components/game/studio/CreatorStudio";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/studio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Creator Studio — Artiati Dragon Masters" },
      {
        name: "description",
        content: "Write and manage up to five of your own dragon stories, then publish them for other players.",
      },
      { property: "og:title", content: "Creator Studio — Artiati Dragon Masters" },
      {
        property: "og:description",
        content: "Create, edit and delete your own dragon stories — five slots per player.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioRoute,
});

function StudioRoute() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CreatorStudio />
      <Toaster />
    </div>
  );
}
