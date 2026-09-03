import { createFileRoute } from "@tanstack/react-router";
import { VisualNovelPlayer } from "@/components/game/story/VisualNovelPlayer";

export const Route = createFileRoute("/story/play/$chapterId")({
  validateSearch: (search: Record<string, unknown>): { dragon?: number } => {
    const raw = Number(search.dragon);
    return Number.isFinite(raw) && raw > 0 ? { dragon: raw } : {};
  },
  ssr: false,
  head: () => ({
    meta: [
      { title: "스토리 플레이 — Artiati Dragon Masters" },
      {
        name: "description",
        content: "선택에 따라 갈라지고 다시 합쳐지는 비주얼 노벨 스토리 모드를 플레이하세요.",
      },
      { property: "og:title", content: "스토리 플레이 — Artiati Dragon Masters" },
      {
        property: "og:description",
        content: "드래곤과 함께하는 분기형 비주얼 노벨 스토리 모드.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoryPlayRoute,
});

function StoryPlayRoute() {
  const { chapterId } = Route.useParams();
  const { dragon } = Route.useSearch();
  return <VisualNovelPlayer chapterId={chapterId} companionId={dragon ?? null} />;
}
