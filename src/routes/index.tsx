import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2, Loader2, ArrowRight, X } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: i18n.t("landing.metaTitle") },
      { name: "description", content: i18n.t("landing.metaDesc") },
      { property: "og:title", content: i18n.t("landing.ogTitle") },
      { property: "og:description", content: i18n.t("landing.ogDesc") },
    ],
  }),
  component: LandingPage,
});

const SAMPLE_IMAGES = [
  "https://mcwafbwjpkjtvqfenqys.supabase.co/storage/v1/object/public/dragon-images/seed/elia.webp",
  "https://mcwafbwjpkjtvqfenqys.supabase.co/storage/v1/object/public/dragon-images/seed/bella.webp",
  "https://mcwafbwjpkjtvqfenqys.supabase.co/storage/v1/object/public/dragon-images/seed/comi.webp",
  "https://mcwafbwjpkjtvqfenqys.supabase.co/storage/v1/object/public/dragon-images/seed/snowy.webp",
  "https://mcwafbwjpkjtvqfenqys.supabase.co/storage/v1/object/public/dragon-images/seed/caminont.webp",
  "https://mcwafbwjpkjtvqfenqys.supabase.co/storage/v1/object/public/dragon-images/seed/younigon.webp",
];

interface ShowcaseDragon { name: string; image_url: string | null }

function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showSignup, setShowSignup] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseDragon[]>([]);

  // 의도적으로 자동 리다이렉트 없음 — 랜딩은 CTA 클릭 전까지 항상 표시.

  // 게임 속 드래곤들을 마퀴에 노출 — RLS상 비로그인은 못 읽으니 실패 시 샘플 사용.
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("dragons")
        .select("name, image_url")
        .not("image_url", "is", null)
        .limit(20);
      if (cancel) return;
      if (data && data.length > 0) {
        setShowcase(data as ShowcaseDragon[]);
      } else {
        setShowcase(SAMPLE_IMAGES.map((u, i) => ({ name: `Dragon ${i + 1}`, image_url: u })));
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-100">
      {/* 배경: 별이 박힌 신비한 밤하늘 */}
      <StarryBackdrop />
      <div className="absolute right-4 top-4 z-20">
        <LanguageToggle />
      </div>

      {/* 히어로 */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-220px)] max-w-3xl flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        <FloatingDragonCard />

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-10 bg-gradient-to-br from-amber-200 via-purple-200 to-rose-300 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent drop-shadow-[0_0_30px_rgba(168,85,247,0.4)] sm:text-6xl"
        >
          {t("landing.h1")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-4 max-w-md text-base text-slate-300 sm:text-lg"
        >
          {t("landing.tagline")}
        </motion.p>

        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowSignup(true)}
          className="group relative mt-10 inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-rose-500 px-8 py-4 text-base font-extrabold text-white shadow-[0_10px_40px_-10px_rgba(217,70,239,0.7)] transition sm:text-lg"
        >
          <Wand2 className="h-5 w-5" />
          {t("landing.cta")}
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </motion.button>

        <p className="mt-3 text-xs text-slate-500">
          {t("landing.loginHint")}{" "}
          <Link to="/app" className="text-purple-300 underline-offset-2 hover:underline">
            {t("landing.loginLink")}
          </Link>
        </p>
      </section>

      {/* 마퀴 — 쇼케이스 */}
      <section className="relative z-10 border-t border-slate-800/60 bg-slate-950/40 py-8 backdrop-blur">
        <div className="mb-4 px-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-300">
            {t("landing.showcaseKicker")}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-100 sm:text-xl">{t("landing.showcaseTitle")}</h2>
        </div>
        <Marquee items={showcase.length ? showcase : SAMPLE_IMAGES.map((u, i) => ({ name: `D${i}`, image_url: u }))} />
      </section>

      <AnimatePresence>
        {showSignup && (
          <NicknameSignupModal
            onClose={() => setShowSignup(false)}
            onSuccess={() => {
              void navigate({ to: "/app", search: { view: "story" }, replace: true });
            }}
          />
        )}
      </AnimatePresence>
      <Toaster />
    </div>
  );
}

/* -------------------- Floating Glassmorphism Card -------------------- */

function FloatingDragonCard() {
  return (
    <motion.div
      animate={{ y: [-10, 10, -10] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="relative"
    >
      {/* 외곽 광채 */}
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-purple-500/30 via-fuchsia-500/20 to-amber-400/20 blur-3xl" />
      <div className="relative flex h-72 w-52 items-center justify-center rounded-[1.75rem] border border-white/15 bg-white/5 shadow-[0_25px_80px_-20px_rgba(168,85,247,0.5)] backdrop-blur-xl sm:h-80 sm:w-60">
        {/* 카드 내부 실루엣 */}
        <div className="absolute inset-3 rounded-[1.4rem] border border-white/10 bg-gradient-to-b from-slate-900/40 to-slate-950/60" />
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative text-7xl drop-shadow-[0_0_25px_rgba(217,70,239,0.7)] sm:text-8xl"
        >
          🐉
        </motion.div>
        <Sparkles className="absolute right-4 top-4 h-5 w-5 text-amber-300/80" />
        <Sparkles className="absolute bottom-5 left-5 h-4 w-4 text-purple-300/70" />
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300/70">
          ??? · Locked
        </p>
      </div>
    </motion.div>
  );
}

/* -------------------- Starry Backdrop -------------------- */

function StarryBackdrop() {
  // 결정적인(deterministic) 별 좌표 — SSR/CSR 일치를 위해 시드 기반으로 고정.
  const stars = Array.from({ length: 60 }, (_, i) => {
    const seed = (i + 1) * 9301;
    const x = (seed % 1000) / 10;
    const y = ((seed * 7) % 1000) / 10;
    const size = ((seed * 13) % 30) / 10 + 0.5;
    const delay = ((seed * 17) % 50) / 10;
    return { x, y, size, delay, key: i };
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(88,28,135,0.45),_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(15,23,42,0.9),_transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950" />
      {stars.map((s) => (
        <span
          key={s.key}
          className="absolute rounded-full bg-white/80 animate-pulse"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${3 + (s.key % 4)}s`,
          }}
        />
      ))}
    </div>
  );
}

/* -------------------- Marquee -------------------- */

function Marquee({ items }: { items: ShowcaseDragon[] }) {
  // 두 번 반복해서 끊김 없는 무한 스크롤.
  const doubled = [...items, ...items];
  return (
    <div className="group relative w-full overflow-hidden">
      <div
        className="flex w-max gap-4 px-4 [animation:marquee_40s_linear_infinite] group-hover:[animation-play-state:paused]"
      >
        {doubled.map((d, i) => (
          <div
            key={`${d.name}-${i}`}
            className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 shadow-[0_10px_30px_-15px_rgba(168,85,247,0.6)]"
          >
            {d.image_url ? (
              <img
                src={d.image_url}
                alt={d.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                {d.name}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-2 py-1.5 text-[10px] font-bold text-slate-100">
              {d.name}
            </div>
          </div>
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-950 to-transparent" />
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* -------------------- Nickname Signup Modal -------------------- */

const buildNicknameSchema = () =>
  z
    .string()
    .trim()
    .min(2, i18n.t("landing.modal.errorMin"))
    .max(20, i18n.t("landing.modal.errorMax"))
    .regex(/^[\p{L}\p{N}_\- ]+$/u, i18n.t("landing.modal.errorChars"));

function generateGuestEmail(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `guest_${ts}_${rand}@artiati.local`;
}
function generateGuestPassword(): string {
  // 36자 random — 사용자에게는 노출되지 않음.
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    "Aa1!"
  );
}

function NicknameSignupModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const parsed = buildNicknameSchema().safeParse(nickname);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("landing.modal.errorCheck"));
      return;
    }
    const cleaned = parsed.data;

    setSubmitting(true);
    try {
      // 1) 기존 게스트 세션이 있으면 그대로 재사용해서 닉네임만 덮어쓴다.
      //    없으면 자동 생성 이메일/비번으로 새로 가입.
      const { data: existing } = await supabase.auth.getSession();
      let userId = existing.session?.user?.id ?? null;

      if (!userId) {
        const email = generateGuestEmail();
        const password = generateGuestPassword();
        const { data: signup, error: signErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: cleaned } },
        });
        if (signErr) throw signErr;
        userId = signup.user?.id ?? null;
        if (!userId) throw new Error(t("landing.modal.errorUserCreate"));

        if (!signup.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
        }
      }

      // 2) 프로필에 닉네임/스테이지 덮어쓰기 (기존 게스트면 nickname만 갱신, gold는 보존)
      const { error: upErr } = await supabase
        .from("profiles")
        .upsert(
          { user_id: userId, nickname: cleaned, current_stage: 1 },
          { onConflict: "user_id" },
        );
      if (upErr) {
        // 닉네임 중복 등은 친절한 메시지로
        if (upErr.code === "23505") {
          throw new Error(t("landing.modal.errorDup"));
        }
        throw upErr;
      }

      toast.success(t("landing.modal.welcome", { name: cleaned }));
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("landing.modal.errorGeneric");
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-purple-400/30 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 shadow-[0_20px_60px_-20px_rgba(168,85,247,0.6)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("landing.modal.ariaClose")}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-3xl shadow-lg">
            🧙‍♂️
          </div>
        </div>
        <h3 className="text-center text-xl font-extrabold text-slate-100">
          {t("landing.modal.askName")}
        </h3>
        <p className="mt-1 text-center text-xs text-slate-400">
          {t("landing.modal.askHint")}
        </p>

        <div className="mt-5">
          <label htmlFor="nickname" className="sr-only">
            {t("landing.modal.nicknameLabel")}
          </label>
          <input
            id="nickname"
            autoFocus
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) submit();
            }}
            disabled={submitting}
            maxLength={20}
            placeholder={t("landing.modal.placeholder")}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-center text-base font-bold text-slate-100 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40 disabled:opacity-60"
          />
          {error && (
            <p className="mt-2 text-center text-xs font-bold text-rose-300">{error}</p>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || nickname.trim().length === 0}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-purple-900/40 transition hover:from-purple-400 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t("landing.modal.submitting")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> {t("landing.modal.submit")}
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[10px] text-slate-500">
          {t("landing.modal.fineprint")}
        </p>
      </motion.div>
    </motion.div>
  );
}
