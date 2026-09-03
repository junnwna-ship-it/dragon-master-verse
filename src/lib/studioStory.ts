/**
 * Parser for Creator Studio story text.
 *
 * Studio stories are plain text (no DB rows per scene), so the player parses
 * them at runtime. Inline quizzes are authored right inside a scene block and
 * branch to a success/fail node, which makes UGC quizzes really playable
 * without touching the shared `quizzes` table.
 *
 * ```text
 * [장면 Node_1]
 * 배경: https://example.com/a.jpg
 * 화자: 수호자
 * 대사: 석문 앞에서 수호자가 너를 시험한다.
 * 선택지1: 시험을 받아들인다 -> Node_2 (Courage +1)
 *
 * [장면 Node_2]
 * 대사: "정답을 맞혀 보아라."
 * [퀴즈]
 * 질문: 용의 브레스를 막는 가장 좋은 방법은?
 * 보기1: 방패를 든다
 * 보기2: 물속으로 뛰어든다
 * 정답: 2
 * 성공 -> Node_3
 * 실패 -> Node_4
 *
 * [장면 Node_3]
 * 대사: 문이 열렸다.
 * 엔딩: true
 * ```
 */

export type UgcQuiz = {
  question: string;
  choices: string[];
  /** 0-based index of the correct choice. */
  answerIndex: number;
  successNode: string | null;
  failNode: string | null;
};

export type UgcChoice = {
  label: string;
  nextNode: string | null;
  stats: Record<string, number>;
};

export type UgcNode = {
  key: string;
  background: string | null;
  speaker: string | null;
  body: string;
  choices: UgcChoice[];
  quiz: UgcQuiz | null;
  isEnding: boolean;
};

export type ParsedUgcStory = {
  nodes: UgcNode[];
  /** Author-facing problems; the story can still be played when non-empty. */
  errors: string[];
};

const STAT_RE = /^([\w가-힣 .-]+?)\s*([+-]?\d+)$/;

/** "(Courage +1, Social 2)" → { Courage: 1, Social: 2 } */
function parseStats(raw: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const m = part.trim().replace(/[:=]/g, " ").match(STAT_RE);
    if (!m) continue;
    const key = m[1]!.trim().replace(/\s+/g, "_");
    const value = Number(m[2]);
    if (!key || Number.isNaN(value)) continue;
    out[key] = (out[key] ?? 0) + value;
  }
  return out;
}

function parseTarget(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^(END|엔딩|끝)$/i.test(t)) return null;
  return t;
}

export function parseStudioStory(text: string | null | undefined): ParsedUgcStory {
  const errors: string[] = [];
  const nodes: UgcNode[] = [];
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");

  let node: UgcNode | null = null;
  let quiz: UgcQuiz | null = null;
  const bodyParts: string[] = [];

  const flushBody = () => {
    if (node) node.body = bodyParts.join("\n").trim();
    bodyParts.length = 0;
  };
  const closeNode = () => {
    if (!node) return;
    flushBody();
    node.quiz = quiz;
    nodes.push(node);
    node = null;
    quiz = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const scene = line.match(/^\[\s*(?:장면|scene)\s+([^\]]+)\]$/i);
    if (scene) {
      closeNode();
      node = {
        key: scene[1]!.trim(),
        background: null,
        speaker: null,
        body: "",
        choices: [],
        quiz: null,
        isEnding: false,
      };
      continue;
    }

    if (/^\[\s*(?:퀴즈|quiz)\s*\]$/i.test(line)) {
      if (!node) {
        errors.push("퀴즈 블록이 장면 밖에 있습니다. [장면 Node_N] 아래에 넣어주세요.");
        continue;
      }
      flushBody();
      quiz = { question: "", choices: [], answerIndex: 0, successNode: null, failNode: null };
      continue;
    }

    if (!node) continue;

    const bg = line.match(/^(?:배경|background)\s*[:=]\s*(.+)$/i);
    if (bg) {
      node.background = bg[1]!.trim() || null;
      continue;
    }
    const speaker = line.match(/^(?:화자|speaker)\s*[:=]\s*(.+)$/i);
    if (speaker) {
      node.speaker = speaker[1]!.trim() || null;
      continue;
    }
    const ending = line.match(/^(?:엔딩|ending)\s*[:=]\s*(.+)$/i);
    if (ending) {
      node.isEnding = /^(true|예|yes|1|y)$/i.test(ending[1]!.trim());
      continue;
    }

    if (quiz) {
      const q = line.match(/^(?:질문|question)\s*[:=]\s*(.+)$/i);
      if (q) {
        quiz.question = q[1]!.trim();
        continue;
      }
      const opt = line.match(/^(?:보기|선택|option)\s*(\d+)\s*[:=]\s*(.+)$/i);
      if (opt) {
        quiz.choices[Number(opt[1]) - 1] = opt[2]!.trim();
        continue;
      }
      const ans = line.match(/^(?:정답|answer)\s*[:=]\s*(\d+)$/i);
      if (ans) {
        quiz.answerIndex = Math.max(0, Number(ans[1]) - 1);
        continue;
      }
      const ok = line.match(/^(?:성공|정답시|success)\s*(?:->|=>|→|[:=])\s*(.+)$/i);
      if (ok) {
        quiz.successNode = parseTarget(ok[1]);
        continue;
      }
      const bad = line.match(/^(?:실패|오답시|fail)\s*(?:->|=>|→|[:=])\s*(.+)$/i);
      if (bad) {
        quiz.failNode = parseTarget(bad[1]);
        continue;
      }
    }

    const choice = line.match(/^(?:선택지|choice)\s*\d*\s*[:=]\s*(.+)$/i);
    if (choice) {
      let rest = choice[1]!.trim();
      let stats: Record<string, number> = {};
      const paren = rest.match(/\(([^)]*)\)\s*$/);
      if (paren) {
        stats = parseStats(paren[1]);
        if (Object.keys(stats).length) rest = rest.slice(0, paren.index).trim();
      }
      const [label, target] = rest.split(/->|=>|→/);
      node.choices.push({
        label: (label ?? "").trim(),
        nextNode: parseTarget(target),
        stats,
      });
      continue;
    }

    const body = line.match(/^(?:대사|본문|text|body)\s*[:=]\s*(.+)$/i);
    bodyParts.push(body ? body[1]!.trim() : line);
  }
  closeNode();

  // ---- Validation: author-facing warnings, never hard failures ----
  const keys = new Set(nodes.map((n) => n.key));
  if (!nodes.length) errors.push("장면이 없습니다. [장면 Node_1] 블록으로 시작해 주세요.");
  for (const n of nodes) {
    for (const c of n.choices) {
      if (c.nextNode && !keys.has(c.nextNode)) {
        errors.push(`${n.key}: 선택지 "${c.label}"의 이동 대상 ${c.nextNode}이(가) 없습니다.`);
      }
    }
    if (n.quiz) {
      const q = n.quiz;
      if (!q.question) errors.push(`${n.key}: 퀴즈 질문이 비어 있습니다.`);
      const filled = q.choices.filter((c) => c && c.trim());
      if (filled.length < 2) errors.push(`${n.key}: 퀴즈 보기를 2개 이상 입력해 주세요.`);
      if (!q.choices[q.answerIndex]) errors.push(`${n.key}: 퀴즈 정답 번호가 보기 범위를 벗어났습니다.`);
      for (const [labelKr, target] of [
        ["성공", q.successNode],
        ["실패", q.failNode],
      ] as const) {
        if (target && !keys.has(target)) {
          errors.push(`${n.key}: 퀴즈 ${labelKr} 대상 ${target}이(가) 없습니다.`);
        }
      }
    }
    if (!n.choices.length && !n.quiz && !n.isEnding) {
      errors.push(`${n.key}: 선택지·퀴즈·엔딩이 없어 이야기가 멈춥니다.`);
    }
  }
  return { nodes, errors };
}
