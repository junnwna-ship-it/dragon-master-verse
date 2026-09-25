import { createFileRoute } from "@tanstack/react-router";
import { VisualNovelPlayer } from "@/components/game/story/VisualNovelPlayer";
import { chapterShare, SITE_ORIGIN } from "@/data/chapterShare";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useGameStore } from "@/store/dragons";
import { useOwnedGrowth } from "@/hooks/useOwnedGrowth";
import { DragonImage } from "@/components/game/DragonImage";

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
  if (chapterId === "my_dragon" || chapterId === "dragon_growth") {
    return <PersonalStoryRoute chapterId={chapterId} dragonId={dragon ?? null} />;
  }
  return <VisualNovelPlayer chapterId={chapterId} companionId={dragon ?? null} />;
}

function PersonalStoryRoute({ chapterId, dragonId }: { chapterId: string; dragonId: number | null }) {
  const dragons = useGameStore((s) => s.dragons);
  const loadingDragons = useGameStore((s) => s.loadingDragons);
  const fetchDragons = useGameStore((s) => s.fetchDragons);
  const { byDragon, loading, userId } = useOwnedGrowth();

  useEffect(() => {
    if (dragons.length === 0) void fetchDragons();
  }, [dragons.length, fetchDragons]);

  if (loading || loadingDragons) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">드래곤을 불러오는 중…</div>;
  }

  const owned = dragons.filter((d) => d.uuid && byDragon.has(d.uuid));
  const selected = owned.find((d) => d.id === dragonId);
  if (selected) return <VisualNovelPlayer chapterId={chapterId} companionId={selected.id} />;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link to="/app" className="text-sm text-amber-200 hover:underline">← 로비로 돌아가기</Link>
        <h1 className="mt-6 text-3xl font-bold">{chapterId === "my_dragon" ? "나와 내 드래곤의 첫 만남" : "내 드래곤의 성장 이야기"}</h1>
        <p className="mt-2 text-sm text-slate-300">이야기를 함께할 내 드래곤을 선택하세요. 내가 선택하고 드래곤이 응답하는 이야기가 시작됩니다.</p>
        {!userId ? (
          <p className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">내 드래곤의 기록을 저장하려면 먼저 로그인해 주세요.</p>
        ) : owned.length === 0 ? (
          <div className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
            <p>아직 보유한 드래곤이 없습니다. 로비에서 드래곤을 얻은 뒤 이 이야기를 시작할 수 있습니다.</p>
            <Link to="/app" search={{ view: "summon" }} className="mt-4 inline-block rounded-lg bg-amber-300 px-4 py-2 font-semibold text-slate-950">드래곤 만나러 가기</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {owned.map((d) => (
              <Link key={d.uuid} to="/story/play/$chapterId" params={{ chapterId }} search={{ dragon: d.id }}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3 transition hover:border-amber-300/60 hover:bg-amber-300/10">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-900"><DragonImage dragon={d} className="h-full w-full" /></div>
                <div><p className="font-bold">{d.name}</p><p className="text-xs text-slate-400">Lv.{byDragon.get(d.uuid!)?.level ?? 1} · {d.element}</p></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
