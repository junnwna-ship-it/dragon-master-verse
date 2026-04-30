import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns N random quizzes (default 3) without revealing the correct answer
 * to the client until grading is done. The client posts back its picks via
 * `gradeQuiz` which then calls `claim_quiz_reward` if all correct.
 */
export const fetchQuizSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { count?: number };
    return { count: Math.min(10, Math.max(1, Number(d.count ?? 3))) };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("quizzes")
      .select("id, question, choices, answer_index");
    if (error) throw new Error(error.message);
    const all = rows ?? [];
    if (all.length === 0) return { quizzes: [], answerKey: {} as Record<string, number> };
    // Fisher-Yates shuffle, slice N
    const arr = [...all];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const picked = arr.slice(0, data.count);
    const answerKey: Record<string, number> = {};
    for (const q of picked) answerKey[q.id] = q.answer_index;
    return {
      quizzes: picked.map((q) => ({
        id: q.id,
        question: q.question,
        choices: q.choices as string[],
      })),
      answerKey,
    };
  });

/**
 * Post-grade the player's picks; if all correct, claim the reward.
 */
export const gradeAndReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { picks?: { quizId: string; pick: number }[] };
    if (!Array.isArray(d.picks)) throw new Error("picks required");
    return { picks: d.picks };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ids = data.picks.map((p) => p.quizId);
    const { data: rows, error } = await supabase
      .from("quizzes")
      .select("id, answer_index")
      .in("id", ids);
    if (error) throw new Error(error.message);
    let correct = 0;
    for (const p of data.picks) {
      const row = rows?.find((r) => r.id === p.quizId);
      if (row && row.answer_index === p.pick) correct++;
    }
    const { data: rewardData, error: rewardErr } = await supabase.rpc("claim_quiz_reward", {
      _correct: correct,
    });
    if (rewardErr) throw new Error(rewardErr.message);
    return { correct, total: data.picks.length, reward: rewardData };
  });