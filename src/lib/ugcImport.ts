import { supabase } from "@/integrations/supabase/client";
import { parseStudioStory, type UgcNode } from "@/lib/studioStory";

/** Chapter id used when a studio story is registered in the story map. */
export function ugcChapterId(storyId: string): string {
  return `ugc_${storyId.slice(0, 8)}`;
}

type NodePayload = Record<string, unknown>;

/**
 * Turn a Creator Studio story text into story_nodes payloads.
 *
 * Inline quizzes are materialised as rows in `quizzes` (category `ugc`) so the
 * regular story player can gate a choice with a real quiz and branch to the
 * success / fail node.
 */
export async function buildUgcChapterPayloads(opts: {
  storyId: string;
  title: string;
  body: string | null | undefined;
  publish: boolean;
}): Promise<{ chapterId: string; payloads: NodePayload[]; errors: string[] }> {
  const chapterId = ugcChapterId(opts.storyId);
  const { nodes, errors } = parseStudioStory(opts.body);
  const payloads: NodePayload[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as UgcNode;
    let options: Record<string, unknown>[] = n.choices.map((c) => ({
      label: c.label || "계속",
      next_node: c.nextNode,
      state_changes: Object.keys(c.stats).length ? c.stats : null,
    }));

    if (n.quiz) {
      const choices = n.quiz.choices.filter((c) => c && c.trim());
      let quizId: string | null = null;
      if (n.quiz.question && choices.length >= 2) {
        // Reuse an identical question so repeated imports don't pile up rows.
        const { data: existing } = await supabase
          .from("quizzes")
          .select("id")
          .eq("question", n.quiz.question)
          .eq("category", "ugc")
          .limit(1);
        quizId = existing?.[0]?.id ?? null;
        if (!quizId) {
          const { data: inserted, error } = await supabase
            .from("quizzes")
            .insert({
              question: n.quiz.question,
              choices,
              answer_index: n.quiz.answerIndex,
              category: "ugc",
            })
            .select("id")
            .single();
          if (error) throw error;
          quizId = inserted?.id ?? null;
        }
      }
      if (quizId) {
        options = [
          {
            label: "퀴즈에 도전한다",
            next_node: n.quiz.successNode,
            state_changes: null,
            quiz_ids: [quizId],
            quiz_required: true,
            quiz_fail_node: n.quiz.failNode,
          },
          ...options,
        ];
      }
    }

    payloads.push({
      chapter_id: chapterId,
      node_key: n.key,
      stage_number: i + 1,
      node_type: n.quiz ? "quiz" : "story",
      title: `${opts.title} — ${n.key}`,
      speaker: n.speaker,
      description: null,
      body_text: n.body || null,
      background_image_url: n.background,
      is_start: i === 0,
      is_published: opts.publish,
      state_changes: {},
      rewards: {},
      quiz_ids: [],
      options,
    });
  }

  return { chapterId, payloads, errors };
}
