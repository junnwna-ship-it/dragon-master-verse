import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, HelpCircle, RotateCcw, XCircle } from "lucide-react";
import { parseStudioStory, type UgcNode } from "@/lib/studioStory";
import {
  clearUgcProgress,
  loadUgcProgress,
  resolveUgcProgress,
  saveUgcProgress,
} from "@/lib/ugcProgress";

type Props = {
  title: string;
  body: string | null | undefined;
  /** Story id — enables progress persistence across refresh / back navigation. */
  storyId?: string | null;
  /** Where the "나가기" button goes. */
  exitTo?: string;
  /** Author-only: surface parse warnings so the format can be fixed. */
  showErrors?: boolean;
  onExit?: () => void;
};

export function UgcStoryPlayer({
  title,
  body,
  storyId = null,
  exitTo = "/app",
  showErrors = false,
  onExit,
}: Props) {
  const { nodes, errors } = useMemo(() => parseStudioStory(body), [body]);
  const nodeMap = useMemo(() => {
    const map = new Map<string, UgcNode>();
    for (const n of nodes) map.set(n.key, n);
    return map;
  }, [nodes]);

  const startKey = nodes[0]?.key ?? null;
  const [currentKey, setCurrentKey] = useState<string | null>(startKey);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<"correct" | "wrong" | null>(null);
  const [restored, setRestored] = useState(false);
  const [syncedToCloud, setSyncedToCloud] = useState(false);
  const hydratedRef = useRef(false);

  // Restore the last node + quiz result once the story text has parsed.
  // Local storage answers instantly; the cloud row wins when it is newer,
  // which is what makes progress follow the player across devices.
  useEffect(() => {
    if (hydratedRef.current || !storyId || !nodes.length) return;
    hydratedRef.current = true;
    let cancelled = false;
    const keys = [...nodeMap.keys()];

    const apply = (saved: ReturnType<typeof resolveUgcProgress>) => {
      if (cancelled || !saved) return;
      setCurrentKey(saved.nodeKey);
      setFinished(saved.finished);
      setStats(saved.stats);
      setPicked(saved.picked);
      setQuizResult(saved.quizResult);
      setRestored(true);
    };

    const local = loadUgcProgress(storyId);
    apply(resolveUgcProgress(local, keys));

    void (async () => {
      const cloud = await fetchUgcProgress(storyId);
      if (cancelled) return;
      if (cloud) {
        setSyncedToCloud(true);
        apply(resolveUgcProgress(pickNewestProgress(local, cloud), keys));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storyId, nodes.length, nodeMap]);

  // Persist after every state change (skip the pre-hydration render).
  useEffect(() => {
    if (!storyId || !nodes.length || !hydratedRef.current) return;
    const snapshot = { nodeKey: currentKey, finished, stats, picked, quizResult };
    saveUgcProgress(storyId, snapshot);
    void persistUgcProgress(storyId, snapshot).then((ok) => {
      if (ok) setSyncedToCloud(true);
    });
  }, [storyId, nodes.length, currentKey, finished, stats, picked, quizResult]);

  const node = currentKey ? nodeMap.get(currentKey) ?? null : null;

  const reset = () => {
    setCurrentKey(startKey);
    setFinished(false);
    setStats({});
    setPicked(null);
    setQuizResult(null);
    setRestored(false);
    clearUgcProgress(storyId);
    void deleteUgcProgress(storyId);
  };

  const goTo = (key: string | null) => {
    setPicked(null);
    setQuizResult(null);
    setRestored(false);
    if (!key || !nodeMap.has(key)) {
      setFinished(true);
      setCurrentKey(null);
      return;
    }
    setCurrentKey(key);
  };


  const answerQuiz = (index: number) => {
    if (!node?.quiz || quizResult) return;
    const correct = index === node.quiz.answerIndex;
    setPicked(index);
    setQuizResult(correct ? "correct" : "wrong");
  };

  const continueAfterQuiz = () => {
    if (!node?.quiz) return;
    const target = quizResult === "correct" ? node.quiz.successNode : node.quiz.failNode;
    goTo(target);
  };

  const exit = onExit ? (
    <button
      type="button"
      onClick={onExit}
      className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
    >
      <ArrowLeft className="h-3 w-3" />
      나가기
    </button>
  ) : (
    <Link
      to={exitTo}
      className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
    >
      <ArrowLeft className="h-3 w-3" />
      나가기
    </Link>
  );

  const statEntries = Object.entries(stats).filter(([, v]) => v !== 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-black text-slate-100">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
          >
            <RotateCcw className="h-3 w-3" />
            처음부터
          </button>
          {exit}
        </div>
      </header>

      {showErrors && errors.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] text-amber-100">
          <p className="flex items-center gap-1 font-bold">
            <AlertTriangle className="h-3 w-3" />
            형식 확인이 필요한 부분
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {errors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {restored && (
        <p className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-100">
          이전에 진행하던 지점{currentKey ? ` (${currentKey})` : ""}에서 이어집니다.
        </p>
      )}

      {statEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statEntries.map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-100"
            >
              {k.replace(/_/g, " ")} {v > 0 ? `+${v}` : v}
            </span>
          ))}
        </div>
      )}

      {!nodes.length ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
          아직 재생할 장면이 없습니다. 스튜디오에서 <code>[장면 Node_1]</code> 블록을 추가해 주세요.
        </p>
      ) : finished || !node ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-center">
          <p className="text-sm font-bold text-emerald-100">이야기가 끝났습니다.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-100"
          >
            다시 플레이
          </button>
        </div>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70">
          {node.background && (
            <img
              src={node.background}
              alt=""
              loading="lazy"
              className="h-40 w-full object-cover sm:h-56"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="space-y-4 p-4">
            <p className="text-[11px] font-mono text-slate-500">{node.key}</p>
            {node.speaker && <p className="text-xs font-bold text-violet-200">{node.speaker}</p>}
            {node.body && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">{node.body}</p>}

            {node.quiz ? (
              <section className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
                <p className="flex items-center gap-1 text-xs font-bold text-amber-100">
                  <HelpCircle className="h-3.5 w-3.5" />
                  퀴즈
                </p>
                <p className="mt-1 text-sm text-slate-100">{node.quiz.question}</p>
                <ul className="mt-3 space-y-2">
                  {node.quiz.choices.map((choice, i) =>
                    choice && choice.trim() ? (
                      <li key={`${node.key}-q-${i}`}>
                        <button
                          type="button"
                          disabled={quizResult !== null}
                          onClick={() => answerQuiz(i)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                            quizResult !== null && i === node.quiz!.answerIndex
                              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                              : picked === i
                                ? "border-rose-400/60 bg-rose-500/20 text-rose-100"
                                : "border-slate-600 bg-slate-950/70 text-slate-200 hover:border-amber-300/60"
                          }`}
                        >
                          {i + 1}. {choice}
                        </button>
                      </li>
                    ) : null,
                  )}
                </ul>
                {quizResult && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p
                      className={`flex items-center gap-1 text-xs font-bold ${
                        quizResult === "correct" ? "text-emerald-200" : "text-rose-200"
                      }`}
                    >
                      {quizResult === "correct" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {quizResult === "correct" ? "정답입니다!" : "오답입니다."}
                    </p>
                    <button
                      type="button"
                      onClick={continueAfterQuiz}
                      className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-100"
                    >
                      계속하기
                    </button>
                  </div>
                )}
              </section>
            ) : node.isEnding && !node.choices.length ? (
              <button
                type="button"
                onClick={() => goTo(null)}
                className="w-full rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-100"
              >
                이야기 마치기
              </button>
            ) : (
              <ul className="space-y-2">
                {node.choices.map((c, i) => (
                  <li key={`${node.key}-c-${i}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (Object.keys(c.stats).length) {
                          setStats((prev) => {
                            const next = { ...prev };
                            for (const [k, v] of Object.entries(c.stats)) next[k] = (next[k] ?? 0) + v;
                            return next;
                          });
                        }
                        goTo(c.nextNode);
                      }}
                      className="w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2 text-left text-xs font-semibold text-slate-100 transition hover:border-violet-300/60"
                    >
                      {c.label || "(빈 선택지)"}
                      {Object.keys(c.stats).length > 0 && (
                        <span className="ml-2 text-[10px] text-violet-300">
                          {Object.entries(c.stats)
                            .map(([k, v]) => `${k.replace(/_/g, " ")} ${v > 0 ? `+${v}` : v}`)
                            .join(", ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
