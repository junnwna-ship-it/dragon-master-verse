import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useStoryEngine, type VnNode, type VnOption } from "@/store/storyEngine";
import { useGameStore } from "@/store/dragons";
import { useVnSave } from "@/hooks/useVnSave";

import { toast } from "sonner";
import { QuizModal } from "@/components/game/quiz/QuizModal";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronLeft, Sparkles, Play, Home } from "lucide-react";
import {
  sceneArt,
  introArtFor,
  CHAPTER_TITLES,
  CHAPTER_TAGLINES,
} from "@/data/storyArt";

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && !!x.trim());
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return null;
}

/** Coerce raw jsonb into a safe options array — never trust the shape. */
function parseOptions(raw: unknown): VnOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => {
      const quizIds = [
        ...asStringList(o.quiz_ids ?? o.Quiz_Ids),
        ...asStringList(o.quiz_id ?? o.Quiz_Id),
      ];
      const rawCount = o.quiz_count ?? o.Quiz_Count;
      return {
        label: pickString(o, ["label", "choice_text", "Choice_Text"]) ?? "…",
        next_node: pickString(o, ["next_node", "Next_Node"]),
        state_changes:
          o.state_changes && typeof o.state_changes === "object"
            ? (o.state_changes as Record<string, number>)
            : o.State_Changes && typeof o.State_Changes === "object"
              ? (o.State_Changes as Record<string, number>)
              : null,
        quiz_ids: quizIds,
        quiz_count: Number.isFinite(Number(rawCount)) ? Number(rawCount) : 0,
        quiz_required: Boolean(o.quiz_required ?? o.Quiz_Required),
        quiz_fail_node: pickString(o, ["quiz_fail_node", "Quiz_Fail_Node"]),
      } satisfies VnOption;
    });
}


function useChapterNodes(chapterId: string) {
  return useQuery({
    queryKey: ["vn", "chapter", chapterId],
    queryFn: async (): Promise<{ nodes: VnNode[]; schemaReady: boolean }> => {
      // `chapter_id` / `node_key` / `options` are newer CMS columns that may not
      // exist yet, so select everything and filter in JS instead of in SQL —
      // a missing-column filter would make the whole request fail.
      const table = supabase.from("story_nodes") as unknown as {
        select: (cols: string) => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
      const { data, error } = await table.select("*");
      if (error) throw new Error(error.message);

      const raw = (data ?? []) as unknown as Record<string, unknown>[];
      const schemaReady = raw.length === 0 || Object.hasOwn(raw[0]!, "chapter_id");

      const nodes = raw
        .filter((row) => String(row.chapter_id ?? "") === chapterId)
        .map((row) => ({
          id: String(row.id),
          chapter_id: String(row.chapter_id ?? chapterId),
          node_key: (row.node_key as string | null) ?? null,
          title: String(row.title ?? ""),
          speaker: (row.speaker as string | null) ?? null,
          body_text: (row.body_text as string | null) ?? null,
          description: (row.description as string | null) ?? null,
          background_image_url: (row.background_image_url as string | null) ?? null,
          options: parseOptions(row.options),
          state_changes: (row.state_changes as Record<string, number> | null) ?? null,
          is_start: Boolean(row.is_start),
          stage_number: Number(row.stage_number ?? 0),
        }))
        .sort((a, b) => a.stage_number - b.stage_number);

      return { nodes, schemaReady };
    },
  });
}


/** Typewriter output with click-to-skip. */
function Typewriter({ text, speed = 28 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  const doneRef = useRef(false);
  useEffect(() => {
    setShown("");
    doneRef.current = false;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <p
      className="whitespace-pre-wrap text-base leading-relaxed text-slate-50 md:text-lg"
      onClick={() => setShown(text)}
    >
      {shown}
      {shown.length < text.length && <span className="ml-0.5 animate-pulse">▌</span>}
    </p>
  );
}

export function VisualNovelPlayer({ chapterId }: { chapterId: string }) {
  const { data, isLoading, error } = useChapterNodes(chapterId);
  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const schemaReady = data?.schemaReady ?? true;
  const { nodeKey, stats, visited, applied, finished, start, choose, enter, reset, hydrate } =
    useStoryEngine();
  const { remote, loading: saveLoading, saving, persist, clear, signedIn } = useVnSave(chapterId);
  const hydratedRef = useRef(false);
  const [quizOption, setQuizOption] = useState<VnOption | null>(null);
  const [introDone, setIntroDone] = useState(false);

  const byKey = useMemo(() => {
    const map = new Map<string, VnNode>();
    for (const n of nodes) if (n.node_key) map.set(n.node_key, n);
    return map;
  }, [nodes]);

  const startKey = useMemo(() => {
    const explicit = nodes.find((n) => n.is_start && n.node_key)?.node_key;
    return explicit ?? nodes.find((n) => n.node_key)?.node_key ?? null;
  }, [nodes]);

  // Resume from the cloud save first; otherwise begin at the chapter's start node.
  useEffect(() => {
    if (saveLoading || hydratedRef.current) return;
    if (remote && remote.nodeKey && byKey.has(remote.nodeKey)) {
      hydratedRef.current = true;
      hydrate(remote);
      return;
    }
    if (startKey) {
      hydratedRef.current = true;
      start(chapterId, startKey);
    }
  }, [saveLoading, remote, byKey, startKey, chapterId, start, hydrate]);

  const node = nodeKey ? byKey.get(nodeKey) ?? null : null;

  useEffect(() => {
    if (node) enter(node);
  }, [node, enter]);

  // Persist every progress change so a logout / reconnect resumes exactly here.
  useEffect(() => {
    if (!hydratedRef.current || !nodeKey) return;
    persist({ chapterId, nodeKey, stats, visited, applied, finished });
  }, [chapterId, nodeKey, stats, visited, applied, finished, persist]);

  const restart = () => {
    if (!startKey) return;
    void clear();
    setQuizOption(null);
    setIntroDone(false);
    start(chapterId, startKey, { reset: true });
  };

  /** Choices may gate progression behind a quiz — ask first, then advance. */
  const handleChoose = (opt: VnOption) => {
    const hasQuiz = (opt.quiz_ids?.length ?? 0) > 0 || (opt.quiz_count ?? 0) > 0;
    if (hasQuiz) {
      setQuizOption(opt);
      return;
    }
    choose(opt);
  };

  const handleQuizClose = (result: { correct: number; total: number }) => {
    const opt = quizOption;
    setQuizOption(null);
    if (!opt) return;
    const passed = result.total > 0 ? result.correct === result.total : true;
    if (passed || !opt.quiz_required) {
      choose(opt);
      return;
    }
    // Failed a required quiz: branch to the fail node, or stay on this node.
    if (opt.quiz_fail_node) {
      choose({ ...opt, next_node: opt.quiz_fail_node, state_changes: null });
    } else {
      toast.error("Answer every question correctly to move on!");
    }
  };

  const statEntries = Object.entries(stats).filter(([, v]) => v !== 0);




  if (isLoading) {
    return <Shell><p className="text-slate-300">Loading…</p></Shell>;
  }
  if (!schemaReady) {
    return (
      <Shell>
        <p className="text-slate-100">The story mode update has not been applied yet.</p>
        <p className="mt-2 text-sm text-slate-400">
          Accept this draft to load the story data and start playing.
        </p>
        <BackLink />
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <p className="text-slate-100">Failed to load the story.</p>
        <p className="mt-2 text-sm text-slate-400">{(error as Error).message}</p>
        <BackLink />
      </Shell>
    );
  }
  if (!nodes.length) {
    return (
      <Shell>
        <p className="text-slate-300">This chapter has no published scenes yet.</p>
        <BackLink />
      </Shell>
    );
  }

  const body = node?.body_text ?? node?.description ?? "";
  const background = node?.background_image_url ?? sceneArt(chapterId, node?.node_key) ?? null;
  const introImage = introArtFor(chapterId);
  const chapterTitle = CHAPTER_TITLES[chapterId] ?? chapterId.replace(/_/g, " ");
  const tagline = CHAPTER_TAGLINES[chapterId] ?? "Your choices shape the legend.";

  if (!introDone) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
        <motion.img
          src={introImage}
          alt={`${chapterTitle} chapter cover art`}
          width={1536}
          height={1024}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/30 to-slate-950/95" />
        <div className="relative z-10 flex min-h-screen flex-col justify-between p-4">
          <BackLink />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 220, damping: 24 }}
            className="mx-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-black/60 p-6 text-center backdrop-blur-md"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300/90">Story Mode</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-50 md:text-4xl">{chapterTitle}</h1>
            <p className="mt-3 text-sm text-slate-200 md:text-base">{tagline}</p>
            <Button className="mt-6 w-full" size="lg" onClick={() => setIntroDone(true)}>
              <Play className="mr-2 h-4 w-4" /> Begin the story
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }


  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
      {/* Background from DB (plain URL string) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={background ?? "bg"}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-cover bg-center"
          style={
            background
              ? { backgroundImage: `url(${background})` }
              : {
                  backgroundImage:
                    "radial-gradient(circle at 30% 20%, hsl(262 60% 30%), transparent 60%), radial-gradient(circle at 70% 80%, hsl(200 70% 25%), transparent 60%)",
                }
          }
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/20 to-slate-950/90" />

      {/* HUD */}
      <div className="relative z-10 flex items-center justify-between gap-2 p-4">
        <BackLink />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {statEntries.map(([key, value]) => (
            <span
              key={key}
              className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-slate-100 backdrop-blur"
            >
              {key.replace(/_/g, " ")} <b className="text-amber-300">{value}</b>
            </span>
          ))}
          <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-slate-300 backdrop-blur">
            {signedIn ? (saving ? "Saving…" : "Saved to cloud") : "Sign in to save your progress"}
          </span>
          <Button size="sm" variant="secondary" onClick={restart}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restart
          </Button>

        </div>
      </div>

      {/* Dialog box */}
      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] flex-col justify-end p-4 pb-8">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {finished || !node ? (
            <div className="rounded-2xl border border-white/15 bg-black/70 p-5 backdrop-blur-md">
              <p className="flex items-center gap-2 text-lg font-semibold text-amber-300">
                <Sparkles className="h-5 w-5" /> Chapter complete
              </p>
              <p className="mt-2 text-sm text-slate-200">
                Your stats have been saved. Replay and choose differently to see another outcome.
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={restart}>Play again</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void clear();
                    reset();
                  }}
                  asChild={false}
                >
                  Clear save
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/">
                    <Home className="mr-1 h-4 w-4" /> Home
                  </Link>
                </Button>
              </div>

            </div>
          ) : (
            <>
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="rounded-2xl border border-white/15 bg-black/70 p-5 shadow-2xl backdrop-blur-md"
              >
                <p className="text-xs uppercase tracking-widest text-amber-300/90">
                  {node.speaker || node.title}
                </p>
                <div className="mt-2">
                  <Typewriter text={body} />
                </div>
              </motion.div>

              <div className="flex flex-col gap-2">
                {node.options.map((opt, i) => (
                  <motion.button
                    key={`${node.id}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    onClick={() => handleChoose(opt)}
                    className="w-full rounded-xl border border-amber-300/30 bg-black/55 px-4 py-3 text-left text-sm text-slate-50 backdrop-blur transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    {opt.label}
                    {((opt.quiz_ids?.length ?? 0) > 0 || (opt.quiz_count ?? 0) > 0) && (
                      <span className="ml-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-200">
                        Quiz
                      </span>
                    )}
                  </motion.button>
                ))}
                {node.options.length === 0 && (
                  <Button
                    onClick={() => choose({ label: "Continue", next_node: null })}
                    className="w-full"
                  >
                    Continue
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {quizOption && (
        <QuizModal
          title="Trial of Wisdom"
          count={quizOption.quiz_count && quizOption.quiz_count > 0 ? quizOption.quiz_count : 1}
          quizIds={quizOption.quiz_ids}
          onClose={handleQuizClose}
        />
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
      {children}
    </div>
  );
}

/**
 * Exit controls: "Back" returns to the game lobby, "Home" leaves story mode
 * entirely and lands on the landing page.
 */
function BackLink() {
  const setView = useGameStore((state) => state.setView);
  const cls =
    "inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-slate-100 backdrop-blur hover:bg-black/60";
  return (
    <div className="flex items-center gap-2">
      <Link to="/app" search={{}} onClick={() => setView("lobby")} className={cls}>
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <Link to="/" onClick={() => setView("lobby")} className={cls} aria-label="Exit story mode and go home">
        <Home className="h-3.5 w-3.5" /> Home
      </Link>
    </div>
  );
}

