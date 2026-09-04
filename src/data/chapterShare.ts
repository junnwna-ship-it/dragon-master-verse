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
    title: "The Dragon Master — Artiati Dragon Masters",
    description:
      "An onion field, a whispering worm, and a king who needs a dragon tamed. 20 scenes, quiz gates and choices that shape the legend.",
    image: `${SITE_ORIGIN}/og/dragon_master.jpg`,
  },
  dragon_growth: {
    title: "Enhance · Train · Bond — Artiati Dragon Masters",
    description:
      "Step into the Growth Chamber: enhance stats, train at the grounds and bond at the altar to power up your own dragon.",
    image: `${SITE_ORIGIN}/og/dragon_growth.jpg`,
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
