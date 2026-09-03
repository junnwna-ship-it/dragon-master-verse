import { useEffect, useState } from "react";
import { Crown, Loader2, ScrollText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PublicStory = {
  id: string;
  title: string;
  summary: string | null;
  cover_image_url: string | null;
  body: string | null;
  is_hall_of_fame: boolean;
};

const db = () => (supabase as unknown as { from: (t: string) => any }).from("user_stories");

/**
 * Player-facing story picker: Hall of Fame ("official chapter") entries are
 * pinned to the very top with a golden frame + crown, community stories below.
 */
export function HallOfFameStories() {
  const [rows, setRows] = useState<PublicStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<PublicStory | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await db()
        .select("id,title,summary,cover_image_url,body,is_hall_of_fame")
        .eq("is_published", true)
        .order("is_hall_of_fame", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(30);
      if (!alive) return;
      setRows((data ?? []) as PublicStory[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-4 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> 스토리 목록 불러오는 중…
      </p>
    );
  }

  if (rows.length === 0) return null;

  const hall = rows.filter((r) => r.is_hall_of_fame);
  const community = rows.filter((r) => !r.is_hall_of_fame);

  return (
    <section className="space-y-3">
      {hall.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-widest text-amber-300">
            <Crown className="h-3.5 w-3.5" /> 명예의 전당 · 공식 챕터
          </h3>
          {hall.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpen(s)}
              className="relative w-full overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/25 via-amber-400/10 to-transparent p-4 text-left shadow-[0_0_24px_-6px_rgba(251,191,36,0.7)] transition hover:from-amber-500/35"
            >
              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                <Crown className="h-3 w-3" /> OFFICIAL
              </span>
              <p className="pr-24 text-base font-black text-amber-100">{s.title}</p>
              <p className="mt-1 line-clamp-2 pr-20 text-[11px] text-amber-200/80">
                {s.summary || "관리자가 공식 콘텐츠로 승격한 챕터입니다."}
              </p>
            </button>
          ))}
        </div>
      )}

      {community.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">
            <ScrollText className="h-3.5 w-3.5" /> 유저 창작 스토리
          </h3>
          {community.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpen(s)}
              className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-left hover:border-slate-500"
            >
              <p className="text-sm font-bold text-slate-200">{s.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{s.summary || " "}</p>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(null)}
        >
          <div
            className={`max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 ${
              open.is_hall_of_fame
                ? "border-amber-400 bg-slate-900 shadow-[0_0_30px_-8px_rgba(251,191,36,0.8)]"
                : "border-slate-700 bg-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="flex items-center gap-2 text-lg font-black text-slate-100">
                {open.is_hall_of_fame && <Crown className="h-5 w-5 text-amber-300" />}
                {open.title}
              </h4>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="닫기"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {open.summary && <p className="mt-1 text-xs text-slate-400">{open.summary}</p>}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {open.body || "본문이 아직 작성되지 않았습니다."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
