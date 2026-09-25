/**
 * Bundled scene art for the visual-novel chapters.
 *
 * The CMS keeps `background_image_url` as a plain string, so authors can always
 * override these. When a node has no URL yet, we fall back to the bundled art
 * below (keyed by `chapter_id::node_key`) so every scene still shows an image.
 */
import introArt from "@/assets/story/player_meets_dragon.png";
import node1 from "@/assets/story/onion_field_messenger.png";
import growthArt from "@/assets/story/player_dragon_growth.png";
import companionsTraining from "@/assets/story/companions_training.png";
import castleHall from "@/assets/story/castle_hall.jpg";
import tunnel from "@/assets/story/tunnel.jpg";
import nightCastle from "@/assets/story/night_castle.jpg";

export const CHAPTER_INTRO_ART: Record<string, string> = {
  dragon_master: introArt,
  my_dragon: introArt,
  dragon_growth: growthArt,
};

export const SCENE_ART: Record<string, string> = {
  "dragon_master::Node_1": node1,
  "dragon_master::Node_2": companionsTraining,
  "dragon_master::Node_3": castleHall,
  "dragon_master::Node_4": castleHall,
  "dragon_master::Node_5": castleHall,
  "dragon_master::Node_6": castleHall,
  "dragon_master::Node_7": companionsTraining,
  "dragon_master::Node_8": companionsTraining,
  "dragon_master::Node_9": castleHall,
  "dragon_master::Node_10": castleHall,
  "dragon_master::Node_11": nightCastle,
  "dragon_master::Node_12": tunnel,
  "dragon_master::Node_13": tunnel,
  "dragon_master::Node_14": tunnel,
  "dragon_master::Node_15": tunnel,
  "dragon_master::Node_16": tunnel,
  "dragon_master::Node_17": tunnel,
  "dragon_master::Node_18": tunnel,
  "dragon_master::Node_19": tunnel,
  "dragon_master::Node_20": introArt,
  "dragon_master::Node_20_alone": nightCastle,
  "dragon_master::Node_20_lost": tunnel,
  "dragon_master::Node_20_two": introArt,
  // Branch scenes: they reuse the art of the place they happen in.
  "dragon_master::Node_A1_court": castleHall,
  "dragon_master::Node_A2_court": nightCastle,
  "dragon_master::Node_A1_field": node1,
  "dragon_master::Node_A2_field": node1,
  "dragon_master::Node_B1_alone": tunnel,
  "dragon_master::Node_B2_alone": tunnel,
  "dragon_master::Node_C_force": tunnel,
  "dragon_master::Node_C_setback": tunnel,
  "my_dragon::arrival": node1,
  "my_dragon::meeting": introArt,
  "my_dragon::trust": introArt,
  "my_dragon::training": growthArt,
  "my_dragon::discovery": growthArt,
  "my_dragon::promise": growthArt,
  "dragon_growth::check_in": introArt,
  "dragon_growth::practice": growthArt,
  "dragon_growth::setback": growthArt,
  "dragon_growth::breakthrough": growthArt,
  "dragon_growth::celebration": growthArt,
};

export const CHAPTER_TITLES: Record<string, string> = {
  dragon_master: "드래곤 마스터 · 1권 각색",
  my_dragon: "나와 내 드래곤의 첫 만남",
  dragon_growth: "내 드래곤의 성장 이야기",
};

export const CHAPTER_TAGLINES: Record<string, string> = {
  dragon_master: "양파밭에서 성으로, 나의 드래곤과 함께 시작하는 첫 모험.",
  my_dragon: "당신이 주인공이 되어 자신의 드래곤과 만나고 첫걸음을 내딛습니다.",
  dragon_growth: "서로를 알아가며 연습하고, 실패를 넘어 함께 성장합니다.",
};

export function sceneArt(chapterId: string, nodeKey: string | null | undefined) {
  if (!nodeKey) return null;
  return SCENE_ART[`${chapterId}::${nodeKey}`] ?? null;
}

export function introArtFor(chapterId: string) {
  return CHAPTER_INTRO_ART[chapterId] ?? introArt;
}
