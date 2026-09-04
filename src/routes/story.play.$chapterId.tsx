import { createFileRoute } from "@tanstack/react-router";
import { VisualNovelPlayer } from "@/components/game/story/VisualNovelPlayer";
import { chapterShare, SITE_ORIGIN } from "@/data/chapterShare";

export const Route = createFileRoute("/story/play/$chapterId")({
  validateSearch: (search: Record<string, unknown>): { dragon?: number } => {
    const raw = Number(search.dragon);
    return Number.isFinite(raw) && raw > 0 ? { dragon: raw } : {};
  },
  ssr: false,
  head: ({ params }) => {
    const share = chapterShare(params.chapterId);
    const url = `${SITE_ORIGIN}/story/play/${params.chapterId}`;
    return {
      meta: [
        { title: share.title },
        { name: "description", content: share.description },
        { property: "og:title", content: share.title },
        { property: "og:description", content: share.description },
        { property: "og:image", content: share.image },
        { name: "twitter:image", content: share.image },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: StoryPlayRoute,
});

function StoryPlayRoute() {
  const { chapterId } = Route.useParams();
  const { dragon } = Route.useSearch();
  return <VisualNovelPlayer chapterId={chapterId} companionId={dragon ?? null} />;
}
