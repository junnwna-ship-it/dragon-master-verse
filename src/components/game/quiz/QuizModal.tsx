import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, CheckCircle2, XCircle, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { fetchQuizSet, gradeAndReward } from "@/server/quiz.functions";
import { emitInventoryChanged } from "@/hooks/useInventory";

interface QuizItem {
  id: string;
  question: string;
  choices: string[];
}

interface Props {
  /** Heading shown above the question (e.g. "지혜의 시련"). */
  title?: string;
  count?: number;
  onClose: (result: { correct: number; total: number; rewarded: boolean }) => void;
}

/**
 * 퀴즈 모달 — 서버에서 N문제 랜덤으로 받아 순차 출제.
 * 정답 채점 + 보상 지급은 모두 서버에서 처리 (변조 방지).
 * 모두 맞히면 화려한 불꽃놀이 VFX, 틀리면 슬럼프 연출.
 */
export function QuizModal({ title = "지혜의 시련", count = 3, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [picks, setPicks] = useState<{ quizId: string; pick: number }[]>([]);
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; rewarded: boolean } | null>(null);
  const [answerKey, setAnswerKey] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetchQuizSet({ data: { count } })
      .then((r) => {
        if (cancelled) return;
        setQuizzes(r.quizzes);
        setAnswerKey(r.answerKey);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(`퀴즈 불러오기 실패: ${err.message ?? err}`);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [count]);

  const cur = quizzes[step];

  const handlePick = async (i: number) => {
    if (!cur || feedback) return;
    const isRight = answerKey[cur.id] === i;
    setFeedback(isRight ? "right" : "wrong");
    const next = [...picks, { quizId: cur.id, pick: i }];
    setPicks(next);
    // hold 800ms for VFX
    setTimeout(async () => {
      setFeedback(null);
      if (step + 1 < quizzes.length) {
        setStep(step + 1);
        return;
      }
      // last one — grade
      setGrading(true);
      try {
        const res = await gradeAndReward({ data: { picks: next } });
        const reward = (res.reward as { rewarded?: boolean }) ?? {};
        setResult({ correct: res.correct, total: res.total, rewarded: !!reward.rewarded });
        if (reward.rewarded) {
          // 보상 지급 성공 → 모든 인벤토리 구독자(MerlinStage, BondingSection 등) 갱신
          emitInventoryChanged({ itemKey: "bonding_token", delta: 1 });
        }
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        toast.error(`채점 실패: ${m}`);
        setResult({ correct: 0, total: quizzes.length, rewarded: false });
      } finally {
        setGrading(false);
      }
    }, 800);
  };

  // ── Result screen ──
  if (result) {
    const allRight = result.correct === result.total;
    return (
      <Backdrop>
        <div className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 text-center shadow-2xl">
          {allRight && <FireworksVFX />}
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            allRight ? "bg-amber-500/20 ring-4 ring-amber-500/40" : "bg-rose-500/20 ring-4 ring-rose-500/40"
          }`}>
            {allRight ? <Sparkles className="h-8 w-8 text-amber-300" /> : <XCircle className="h-8 w-8 text-rose-300" />}
          </div>
          <h3 className={`mt-3 text-2xl font-extrabold ${allRight ? "text-amber-200" : "text-rose-200"}`}>
            {allRight ? "완벽해요!" : "아쉬워요..."}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            정답 <span className="font-bold text-slate-100">{result.correct}/{result.total}</span>
          </p>
          {result.rewarded && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <Gift className="h-4 w-4" />
              <span className="font-bold">교감의 증표</span> +1 획득!
            </div>
          )}
          <button
            onClick={() => onClose(result)}
            className="mt-5 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400"
          >
            계속하기
          </button>
        </div>
      </Backdrop>
    );
  }

  if (loading) {
    return (
      <Backdrop>
        <div className="flex flex-col items-center gap-2 text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">퀴즈 불러오는 중...</p>
        </div>
      </Backdrop>
    );
  }

  if (quizzes.length === 0) {
    return (
      <Backdrop>
        <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center text-slate-300">
          <p className="font-bold">아직 등록된 퀴즈가 없습니다</p>
          <p className="mt-1 text-xs text-slate-500">관리자가 문제를 등록한 뒤 다시 도전해 주세요.</p>
          <button onClick={() => onClose({ correct: 0, total: 0, rewarded: false })}
            className="mt-4 w-full rounded-xl bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600">
            닫기
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <div className="relative w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{title}</p>
          <p className="text-[10px] text-slate-400">문제 {step + 1} / {quizzes.length}</p>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full bg-amber-400"
            animate={{ width: `${((step + 1) / quizzes.length) * 100}%` }}
          />
        </div>

        <h3 className="mt-4 min-h-[3.5rem] text-xl font-extrabold leading-snug text-slate-100">
          {cur?.question}
        </h3>

        <div className="mt-5 grid gap-2">
          {cur?.choices.map((c, i) => {
            const tone =
              feedback && i === answerKey[cur.id]
                ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                : feedback === "wrong" && picks[picks.length - 1]?.pick === i
                  ? "border-rose-400/70 bg-rose-500/15 text-rose-100"
                  : "border-slate-700/60 bg-slate-800/70 text-slate-100 hover:border-amber-500/60";
            return (
              <button
                key={i}
                disabled={!!feedback || grading}
                onClick={() => handlePick(i)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-base font-bold transition disabled:cursor-not-allowed ${tone}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950/60 text-xs">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{c}</span>
              </button>
            );
          })}
        </div>

        {/* feedback overlay */}
        <AnimatePresence>
          {feedback === "right" && <CorrectFlash />}
          {feedback === "wrong" && <WrongFlash />}
        </AnimatePresence>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function CorrectFlash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.4, 1], rotate: [-20, 8, 0] }}
        transition={{ duration: 0.5 }}
      >
        <CheckCircle2 className="h-32 w-32 text-emerald-400 drop-shadow-[0_0_24px_rgba(16,185,129,0.9)]" />
      </motion.div>
      <Sparks color="emerald" />
    </motion.div>
  );
}

function WrongFlash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, -10, 10, -8, 8, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <X className="h-32 w-32 text-rose-500 drop-shadow-[0_0_24px_rgba(244,63,94,0.9)]" />
    </motion.div>
  );
}

function Sparks({ color }: { color: "emerald" | "amber" }) {
  const c = color === "emerald" ? "bg-emerald-300" : "bg-amber-300";
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className={`absolute h-2 w-2 rounded-full ${c}`}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * 120, y: Math.sin(a) * 120, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

function FireworksVFX() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[0, 1, 2].map((burst) => (
        <motion.div
          key={burst}
          className="absolute"
          style={{ left: `${20 + burst * 30}%`, top: `${20 + (burst % 2) * 30}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, delay: burst * 0.25, repeat: Infinity, repeatDelay: 0.6 }}
        >
          <Sparks color={burst % 2 === 0 ? "amber" : "emerald"} />
        </motion.div>
      ))}
    </div>
  );
}