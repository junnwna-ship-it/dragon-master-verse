/**
 * Per-chapter share metadata (og:title / og:description / og:image).
 *
 * Share images live in `public/og/*.jpg` as 1200x630 crops of the same scene
 * art the chapter renders, so social crawlers get an absolute, share-sized URL.
 */
export const SITE_ORIGIN = "https://dragon-master-verse.lovable.app";

export interface ChapterShare {
  title: string;
  description: string;
  image: string;
}

const DEFAULT_SHARE: ChapterShare = {
  title: "Story Mode — Artiati Dragon Masters",
  description:
    "Play branching visual-novel chapters, clear quiz gates and grow your dragon with every choice.",
  image: `${SITE_ORIGIN}/og/story-default.jpg`,
};

export const CHAPTER_SHARE: Record<string, ChapterShare> = {
  dragon_master: {
    title: "드래곤 마스터 · 1권 각색 — Artiati Dragon Masters",
    description:
      "양파밭에서 성으로 향해 웜과 동료들을 만나는 1권 기반 이야기.",
    image: `${SITE_ORIGIN}/og/player_meets_dragon.png`,
  },
  my_dragon: {
    title: "나와 내 드래곤의 첫 만남 — Artiati Dragon Masters",
    description: "플레이어가 자신의 드래곤을 만나고 함께 첫 훈련을 시작합니다.",
    image: `${SITE_ORIGIN}/og/player_meets_dragon.png`,
  },
  dragon_growth: {
    title: "내 드래곤의 성장 이야기 — Artiati Dragon Masters",
    description:
      "선택한 드래곤과 연습하고 작은 실패를 넘으며 함께 성장합니다.",
    image: `${SITE_ORIGIN}/og/player_dragon_growth.png`,
  },
};

export function chapterShare(chapterId: string): ChapterShare {
  const known = CHAPTER_SHARE[chapterId];
  if (known) return known;
  // Studio (UGC) chapters: derive a readable title from the chapter id.
  const label = chapterId
    .replace(/^ugc[_-]/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!label) return DEFAULT_SHARE;
  return {
    title: `${label} — Player Story · Artiati Dragon Masters`,
    description: `Play "${label}", a player-created dragon story with its own scenes, quizzes and endings.`,
    image: DEFAULT_SHARE.image,
  };
}
