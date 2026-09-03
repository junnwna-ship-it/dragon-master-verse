import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useStoryEngine, type VnNode, type VnOption } from "@/store/storyEngine";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronLeft, Sparkles } from "lucide-react";

/** Coerce raw jsonb into a safe options array — never trust the shape. */
function parseOptions(raw: unknown): VnOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => ({
      label: typeof o.label === "string" ? o.label : "…",
      next_node: typeof o.next_node === "string" ? o.next_node : null,
      state_changes:
        o.state_changes && typeof o.state_changes === "object"
          ? (o.state_changes as Record<string, number>)
          : null,
    }));
}

function useChapterNodes(chapterId: string) {
  return useQuery({
    queryKey: ["vn", "chapter", chapterId],
    queryFn: async (): Promise<VnNode[]> => {
      // `chapter_id` / `node_key` / `options` are new CMS columns not yet in the
      // generated types, so query through a loosely typed view of the table.
      const table = supabase.from("story_nodes") as unknown as {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
      const { data, error } = await table
        .select("*")
        .eq("chapter_id", chapterId)
        .order("stage_number", { ascending: true });
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
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
      }));
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
  const { data: nodes, isLoading, error } = useChapterNodes(chapterId);
  const { nodeKey, stats, finished, start, choose, enter, reset } = useStoryEngine();

  const byKey = useMemo(() => {
    const map = new Map<string, VnNode>();
    for (const n of nodes ?? []) if (n.node_key) map.set(n.node_key, n);
    return map;
  }, [nodes]);

  const startKey = useMemo(() => {
    const explicit = (nodes ?? []).find((n) => n.is_start && n.node_key)?.node_key;
    return explicit ?? (nodes ?? []).find((n) => n.node_key)?.node_key ?? null;
  }, [nodes]);

  useEffect(() => {
    if (startKey) start(chapterId, startKey);
  }, [startKey, chapterId, start]);

  const node = nodeKey ? byKey.get(nodeKey) ?? null : null;

  useEffect(() => {
    if (node) enter(node);
  }, [node, enter]);

  const statEntries = Object.entries(stats).filter(([, v]) => v !== 0);

  if (isLoading) {
    return <Shell><p className="text-slate-300">불러오는 중…</p></Shell>;
  }
  if (error || !nodes?.length) {
    return (
      <Shell>
        <p className="text-slate-300">이 챕터에는 공개된 스토리 노드가 없습니다.</p>
        <BackLink />
      </Shell>
    );
  }

  const body = node?.body_text ?? node?.description ?? "";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
      {/* Background from DB (plain URL string) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={node?.background_image_url ?? "bg"}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-cover bg-center"
          style={
            node?.background_image_url
              ? { backgroundImage: `url(${node.background_image_url})` }
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => startKey && start(chapterId, startKey, { reset: true })}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> 처음부터
          </Button>
        </div>
      </div>

      {/* Dialog box */}
      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] flex-col justify-end p-4 pb-8">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {finished || !node ? (
            <div className="rounded-2xl border border-white/15 bg-black/70 p-5 backdrop-blur-md">
              <p className="flex items-center gap-2 text-lg font-semibold text-amber-300">
                <Sparkles className="h-5 w-5" /> 챕터 완료
              </p>
              <p className="mt-2 text-sm text-slate-200">
                누적 스탯이 저장되었습니다. 다시 플레이하면 다른 선택으로 다른 결과를 볼 수 있어요.
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => startKey && start(chapterId, startKey, { reset: true })}>
                  다시 플레이
                </Button>
                <Button variant="secondary" onClick={reset} asChild={false}>
                  기록 초기화
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
                    onClick={() => choose(opt)}
                    className="w-full rounded-xl border border-amber-300/30 bg-black/55 px-4 py-3 text-left text-sm text-slate-50 backdrop-blur transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    {opt.label}
                  </motion.button>
                ))}
                {node.options.length === 0 && (
                  <Button
                    onClick={() => choose({ label: "계속", next_node: null })}
                    className="w-full"
                  >
                    계속
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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

function BackLink() {
  return (
    <Link
      to="/app"
      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-slate-100 backdrop-blur hover:bg-black/60"
    >
      <ChevronLeft className="h-3.5 w-3.5" /> 돌아가기
    </Link>
  );
}
