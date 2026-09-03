/**
 * Bundled scene art for the visual-novel chapters.
 *
 * The CMS keeps `background_image_url` as a plain string, so authors can always
 * override these. When a node has no URL yet, we fall back to the bundled art
 * below (keyed by `chapter_id::node_key`) so every scene still shows an image.
 */
import introArt from "@/assets/story/intro.jpg";
import node1 from "@/assets/story/node1.jpg";
import node2 from "@/assets/story/node2.jpg";
import node12 from "@/assets/story/node12.jpg";
import node19 from "@/assets/story/node19.jpg";
import node20 from "@/assets/story/node20.jpg";

export const CHAPTER_INTRO_ART: Record<string, string> = {
  dragon_master: introArt,
};

export const SCENE_ART: Record<string, string> = {
  "dragon_master::Node_1": node1,
  "dragon_master::Node_2": node2,
  "dragon_master::Node_12": node12,
  "dragon_master::Node_19": node19,
  "dragon_master::Node_20": node20,
};

export const CHAPTER_TITLES: Record<string, string> = {
  dragon_master: "The Dragon Master",
};

export const CHAPTER_TAGLINES: Record<string, string> = {
  dragon_master:
    "An onion field, a whispering worm, and a king who needs a dragon tamed. Your choices shape the legend.",
};

export function sceneArt(chapterId: string, nodeKey: string | null | undefined) {
  if (!nodeKey) return null;
  return SCENE_ART[`${chapterId}::${nodeKey}`] ?? null;
}

export function introArtFor(chapterId: string) {
  return CHAPTER_INTRO_ART[chapterId] ?? introArt;
}
