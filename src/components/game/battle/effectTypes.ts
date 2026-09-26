import type { Element } from "@/store/dragons";
import type { EffectType } from "./EffectOverlay";

/** Element → EffectType 매핑 (공격 타격 시 사용) */
export function elementToEffect(el: Element | string): EffectType {
  switch (el) {
    case "Fire":
      return "fire";
    case "Water":
      return "water";
    case "Wood":
      return "wood";
    case "Earth":
      return "earth";
    case "Light":
    case "Metal":
      return "metal";
    default:
      return "slash";
  }
}
