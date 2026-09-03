/**
 * Text-block (markdown) format for authoring visual-novel nodes.
 *
 * Admins edit one readable block instead of raw JSON; this module converts it
 * to/from the DB shape (`body_text`, `options`, `state_changes`).
 *
 * ```md
 * # 본문
 * 동굴 깊은 곳에서 울음소리가 들린다.
 *
 * # 스탯
 * Courage: 1
 *
 * # 선택지
 * - 다가간다 -> approach
 *   스탯: Worm_Affinity +2, Courage +1
 *   퀴즈: 11111111-2222-3333-4444-555555555555 (필수, 실패: retry)
 * - 도망친다 -> flee
 * ```
 */

export interface StoryMdOption {
  label: string;
  next_node: string | null;
  state_changes: Record<string, number> | null;
  quiz_ids?: string[];
  quiz_required?: boolean;
  quiz_fail_node?: string | null;
}

export interface StoryMdData {
  body_text: string;
  state_changes: Record<string, number> | null;
  options: StoryMdOption[];
}

const BODY_HEADS = ["본문", "body", "text", "대사"];
const STAT_HEADS = ["스탯", "스탯 변화", "stats", "state_changes"];
const OPTION_HEADS = ["선택지", "options", "choices"];

function headingKind(line: string): "body" | "stats" | "options" | null {
  const name = line.replace(/^#+\s*/, "").trim().toLowerCase();
  if (BODY_HEADS.includes(name)) return "body";
  if (STAT_HEADS.includes(name)) return "stats";
  if (OPTION_HEADS.includes(name)) return "options";
  return null;
}

/** "Courage +1, Worm_Affinity: -2" → { Courage: 1, Worm_Affinity: -2 } */
export function parseStatList(raw: string): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const part of raw.split(/[,\n]/)) {
    const m = part.trim().match(/^([\w가-힣 .-]+?)\s*[:=]?\s*([+-]?\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const key = m[1]!.trim().replace(/\s+/g, "_");
    const value = Number(m[2]);
    if (!key || Number.isNaN(value)) continue;
    out[key] = (out[key] ?? 0) + value;
  }
  return Object.keys(out).length ? out : null;
}

function parseQuizLine(raw: string): Pick<StoryMdOption, "quiz_ids" | "quiz_required" | "quiz_fail_node"> {
  let rest = raw.trim();
  let required = false;
  let failNode: string | null = null;
  const paren = rest.match(/\(([^)]*)\)\s*$/);
  if (paren) {
    rest = rest.slice(0, paren.index).trim();
    for (const flag of paren[1]!.split(",")) {
      const f = flag.trim();
      if (/^(필수|required)$/i.test(f)) required = true;
      const fail = f.match(/^(?:실패|실패시|fail)\s*[:=]?\s*(.+)$/i);
      if (fail) failNode = fail[1]!.trim();
    }
  }
  const ids = rest
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { quiz_ids: ids, quiz_required: required, quiz_fail_node: failNode };
}

export function parseStoryMarkdown(md: string): StoryMdData {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let section: "body" | "stats" | "options" = "body";
  const bodyLines: string[] = [];
  const statLines: string[] = [];
  const options: StoryMdOption[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      const kind = headingKind(line);
      if (kind) {
        section = kind;
        continue;
      }
    }
    if (section === "body") {
      bodyLines.push(line);
      continue;
    }
    if (section === "stats") {
      statLines.push(line);
      continue;
    }
    // options section
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      const text = bullet[1]!.trim();
      const arrow = text.split(/->|=>|→/);
      options.push({
        label: arrow[0]!.trim(),
        next_node: arrow[1] ? arrow[1].trim() || null : null,
        state_changes: null,
      });
      continue;
    }
    const cur = options[options.length - 1];
    if (!cur) continue;
    const stat = line.trim().match(/^(?:스탯|stats?)\s*[:=]\s*(.+)$/i);
    if (stat) {
      cur.state_changes = parseStatList(stat[1]!);
      continue;
    }
    const quiz = line.trim().match(/^(?:퀴즈|quiz)\s*[:=]\s*(.+)$/i);
    if (quiz) {
      Object.assign(cur, parseQuizLine(quiz[1]!));
    }
  }

  return {
    body_text: bodyLines.join("\n").trim(),
    state_changes: parseStatList(statLines.join("\n")),
    options,
  };
}

function statsToText(stats: Record<string, number> | null | undefined): string {
  if (!stats) return "";
  return Object.entries(stats)
    .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
    .join(", ");
}

export function serializeStoryMarkdown(data: {
  body_text?: string | null;
  state_changes?: Record<string, number> | null;
  options?: StoryMdOption[] | null;
}): string {
  const out: string[] = ["# 본문", (data.body_text ?? "").trim(), ""];
  const enter = statsToText(data.state_changes);
  if (enter) out.push("# 스탯", enter, "");
  out.push("# 선택지");
  for (const o of data.options ?? []) {
    out.push(`- ${o.label}${o.next_node ? ` -> ${o.next_node}` : ""}`);
    const s = statsToText(o.state_changes);
    if (s) out.push(`  스탯: ${s}`);
    if (o.quiz_ids?.length) {
      const flags: string[] = [];
      if (o.quiz_required) flags.push("필수");
      if (o.quiz_fail_node) flags.push(`실패: ${o.quiz_fail_node}`);
      out.push(`  퀴즈: ${o.quiz_ids.join(", ")}${flags.length ? ` (${flags.join(", ")})` : ""}`);
    }
  }
  return out.join("\n");
}
