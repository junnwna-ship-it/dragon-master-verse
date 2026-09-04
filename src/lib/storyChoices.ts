import type { VnOption } from "@/store/storyEngine";

/** True when every stat threshold in `requires` is met by the run's stats. */
export function meetsRequires(
  requires: Record<string, number> | null | undefined,
  stats: Record<string, number>,
): boolean {
  if (!requires) return true;
  return Object.entries(requires).every(([stat, min]) => (stats[stat] ?? 0) >= Number(min));
}

/**
 * Filter a node's choices against the run's accumulated stats.
 *
 * - No choice declares `requires` -> every choice is offered (normal scenes).
 * - Some choices declare `requires` -> only the qualifying ones are offered.
 * - Nothing qualifies -> the unconditional choices act as the fallback,
 *   so a branching ending node can never dead-end.
 */
export function visibleOptions(
  options: VnOption[],
  stats: Record<string, number>,
): VnOption[] {
  const gated = options.filter((o) => o.requires && Object.keys(o.requires).length > 0);
  if (gated.length === 0) return options;
  const qualified = gated.filter((o) => meetsRequires(o.requires, stats));
  if (qualified.length > 0) return qualified;
  return options.filter((o) => !o.requires || Object.keys(o.requires).length === 0);
}
