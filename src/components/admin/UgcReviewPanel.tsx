import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Eye, EyeOff, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type UgcStory = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  cover_image_url: string | null;
  body: string | null;
  is_published: boolean;
  is_hall_of_fame: boolean;
  is_lobby_visible: boolean;
  created_at: string;
};

const db = () => (supabase as unknown as { from: (t: string) => any }).from("user_stories");
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => any }).rpc(fn, args);

/** Admin review queue for user-generated stories + Hall of Fame promotion. */
export function UgcReviewPanel() {
  const [rows, setRows] = useState<UgcStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db()
      .select("id,user_id,title,summary,cover_image_url,body,is_published,is_hall_of_fame,is_lobby_visible,created_at")
      .order("is_hall_of_fame", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(`불러오기 실패: ${error.message}`);
    setRows((data ?? []) as UgcStory[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleVisibility = async (story: UgcStory) => {
    setBusyId(story.id);
    const next = !story.is_lobby_visible;
    const { error } = await rpc("set_story_lobby_visibility", {
      _story_id: story.id,
      _visible: next,
    });
    setBusyId(null);
    if (error) {
      toast.error(`변경 실패: ${error.message}`);
      return;
    }
    toast.success(next ? "로비에 노출됩니다." : "로비에서 숨겼습니다.");
    setRows((prev) =>
      prev.map((r) => (r.id === story.id ? { ...r, is_lobby_visible: next } : r)),
    );
  };

  const promote = async (story: UgcStory) => {
    setBusyId(story.id);
    const { data, error } = await rpc("promote_story_to_hall_of_fame", { _story_id: story.id });
    setBusyId(null);
    if (error) {
      toast.error(`승격 실패: ${error.message}`);
      return;
    }
    const result = (data ?? {}) as { promoted?: boolean; bonus_story_slots?: number };
    if (result.promoted) {
      toast.success(
        `👑 명예의 전당에 등록했습니다. 작가의 보너스 슬롯: ${result.bonus_story_slots ?? "?"}개`,
      );
    } else {
      toast.info("이미 명예의 전당에 등록된 스토리입니다.");
    }
    void load();
  };

  const demote = async (story: UgcStory) => {
    if (!window.confirm(`"${story.title}" 승격을 취소하고 보너스 슬롯을 회수할까요?`)) return;
    setBusyId(story.id);
    const { error } = await rpc("demote_story_from_hall_of_fame", { _story_id: story.id });
    setBusyId(null);
    if (error) {
      toast.error(`취소 실패: ${error.message}`);
      return;
    }
    toast.success("승격을 취소했습니다.");
    void load();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
              <Crown className="h-4 w-4 text-amber-300" /> 유저 창작 스토리 심사
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              승격하면 스토리가 공개 처리되고, 작가의 창작 슬롯이 1개 늘어납니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs font-bold text-slate-300 hover:border-amber-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 새로고침
          </button>
        </div>
      </section>

      {loading && (
        <p className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
        </p>
      )}

      {!loading && rows.length === 0 && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 text-center text-xs text-slate-500">
          아직 유저가 만든 스토리가 없습니다.
        </p>
      )}

      {rows.map((s) => (
        <article
          key={s.id}
          className={`space-y-2 rounded-2xl border p-4 ${
            s.is_hall_of_fame
              ? "border-amber-400/70 bg-amber-500/10"
              : "border-slate-700/70 bg-slate-800/40"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-100">
                {s.is_hall_of_fame && <Crown className="h-4 w-4 shrink-0 text-amber-300" />}
                {s.title || "(제목 없음)"}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                {s.summary || "소개가 없습니다."}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                작가 ID: {s.user_id.slice(0, 8)}… · 작가 설정:{" "}
                {s.is_published ? "공개" : "비공개"} · 로비 노출:{" "}
                <span className={s.is_lobby_visible ? "text-emerald-300" : "text-slate-400"}>
                  {s.is_lobby_visible ? "ON" : "OFF"}
                </span>{" "}
                · {new Date(s.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {s.body && (
            <details className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-3">
              <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">
                본문 검토
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
                {s.body}
              </p>
            </details>
          )}

          <button
            type="button"
            onClick={() => void toggleVisibility(s)}
            disabled={busyId === s.id}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition disabled:opacity-50 ${
              s.is_lobby_visible
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                : "border-slate-600 bg-slate-900/60 text-slate-300 hover:border-emerald-400/50"
            }`}
          >
            {busyId === s.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : s.is_lobby_visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            {s.is_lobby_visible ? "로비 노출 중 · 숨기기" : "로비에 노출하기"}
          </button>

          {s.is_hall_of_fame ? (
            <button
              type="button"
              onClick={() => void demote(s)}
              disabled={busyId === s.id}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/50 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              승격 취소 (보너스 슬롯 회수)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void promote(s)}
              disabled={busyId === s.id}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              👑 명예의 전당 승격
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
