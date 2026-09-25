import type { Dragon } from "@/store/dragons";

/** Replace legacy scan entries without discarding cloud-backed personal dragons. */
export function mergeScannedDragons(current: Dragon[], scanned: Dragon[]): Dragon[] {
  const retained = current.filter((dragon) => dragon.uuid || dragon.id < 1000);
  const firstScanId = retained.reduce((next, dragon) => Math.max(next, dragon.id + 1), 1000);
  return [...retained, ...scanned.map((dragon, index) => ({ ...dragon, id: firstScanId + index }))];
}
