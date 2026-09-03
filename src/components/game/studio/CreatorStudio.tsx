import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowLeft, ScrollText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BASE_STORIES = 5;

type UserStory = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  cover_image_url: string | null;
  body: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

// The table is fresh, so the generated types may not include it yet.
const table = () => (supabase as unknown as {
  from: (t: string) => any;
}).from("user_stories");

export function CreatorStudio() {
  const { user, loading: authLoading } = useAuth();
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Bonus slots are earned when an admin promotes one of the user's stories
  // to the Hall of Fame, so the cap is dynamic: 5 + bonus_story_slots.
  const [bonusSlots, setBonusSlots] = useState(0);

  const count = stories.length;
  const maxStories = BASE_STORIES + bonusSlots;
  const atLimit = count >= maxStories;
  const limitMessage = `최대 ${maxStories}개의 스토리만 만들 수 있습니다. 기존 스토리를 수정하거나 삭제 후 다시 시도해 주세요.`;
  const progress = useMemo(
    () => Math.min(100, (count / Math.max(1, maxStories)) * 100),
    [count, maxStories],
  );

  const load = useCallback(async () => {
    if (!user) {
      setStories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: profile } = await (supabase as unknown as { from: (t: string) => any })
      .from("profiles")
      .select("bonus_story_slots")
      .eq("user_id", user.id)
      .maybeSingle();
    setBonusSlots(Number(profile?.bonus_story_slots ?? 0));

    const { data, error } = await table()
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(`불러오기 실패: ${error.message}`);
    setStories((data ?? []) as UserStory[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const handleCreate = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    if (atLimit) {
      toast.error(limitMessage);
      return;
    }
    setCreating(true);
    const { error } = await table().insert({
      user_id: user.id,
      title: `새 스토리 ${count + 1}`,
      summary: "",
      body: "",
    });
    setCreating(false);
    if (error) {
      toast.error(
        error.message?.includes("STORY_LIMIT_REACHED") ? limitMessage : `생성 실패: ${error.message}`,
      );
      return;
    }
    toast.success("새 스토리를 만들었습니다.");
    void load();
  };

  const handleSave = async (story: UserStory) => {
    setSavingId(story.id);
    const { error } = await table()
      .update({
        title: story.title,
        summary: story.summary,
        cover_image_url: story.cover_image_url,
        body: story.body,
        is_published: story.is_published,
      })
      .eq("id", story.id);
    setSavingId(null);
    if (error) toast.error(`저장 실패: ${error.message}`);
    else toast.success("저장되었습니다.");
  };

  const handleDelete = async (story: UserStory) => {
    if (!window.confirm(`"${story.title}" 스토리를 삭제할까요? 삭제하면 슬롯 1개가 확보됩니다.`)) return;
    const { error } = await table().delete().eq("id", story.id);
    if (error) {
      toast.error(`삭제 실패: ${error.message}`);
      return;
    }
    toast.success("삭제했습니다. 새 슬롯이 확보되었습니다.");
    void load();
  };

  const patch = (id: string, next: Partial<UserStory>) =>
    setStories((prev) => prev.map((s) => (s.id === id ? { ...s, ...next } : s)));

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link to="/app" className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <Link to="/" className="text-xs text-slate-400 hover:text-slate-200">
          Home
        </Link>
      </div>

      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-violet-400">Creator Studio</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <ScrollText className="h-5 w-5 text-violet-300" />
          내 스토리 만들기
        </h1>
      </header>

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-200">
            내 창작 슬롯{bonusSlots > 0 ? " 👑" : ""}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              atLimit ? "bg-rose-500/20 text-rose-300" : "bg-violet-500/20 text-violet-200"
            }`}
          >
            {count} / {maxStories}
            {bonusSlots > 0 && (
              <span className="ml-1 text-amber-300">(+{bonusSlots} 보너스)</span>
            )}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxStories}
          aria-valuenow={count}
          aria-label={`창작 현황: ${count} / ${maxStories}`}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className={`h-full rounded-full transition-all ${atLimit ? "bg-rose-400" : "bg-violet-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {bonusSlots > 0 && (
            <span className="mr-1 font-bold text-amber-300">
              명예의 전당 보상으로 +{bonusSlots} 슬롯 획득!
            </span>
          )}
          {atLimit
            ? "슬롯이 모두 찼습니다. 기존 스토리를 삭제하면 새로 만들 수 있습니다."
            : `${maxStories - count}개의 슬롯이 남아 있습니다.`}
        </p>

        <button
          type="button"
          aria-disabled={atLimit}
          disabled={atLimit || creating || !user}
          onClick={handleCreate}
          onClickCapture={(e) => {
            if (atLimit) {
              e.preventDefault();
              toast.error(limitMessage);
            }
          }}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
            atLimit || !user
              ? "cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500"
              : "border border-violet-400/40 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
          }`}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          새 스토리 만들기
        </button>
        {atLimit && (
          <button
            type="button"
            onClick={() => toast.error(limitMessage)}
            className="mt-2 w-full text-[11px] text-rose-300/80 underline-offset-2 hover:underline"
          >
            왜 만들 수 없나요?
          </button>
        )}
      </section>

      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : !user ? (
        <p className="text-sm text-slate-400">로그인하면 나만의 스토리를 만들 수 있습니다.</p>
      ) : stories.length === 0 ? (
        <p className="text-sm text-slate-400">아직 만든 스토리가 없습니다. 위 버튼으로 시작해 보세요.</p>
      ) : (
        <ul className="space-y-4">
          {stories.map((s) => (
            <li key={s.id} className="space-y-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
              <input
                value={s.title}
                onChange={(e) => patch(s.id, { title: e.target.value })}
                placeholder="스토리 제목"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100"
              />
              <input
                value={s.summary ?? ""}
                onChange={(e) => patch(s.id, { summary: e.target.value })}
                placeholder="한 줄 소개"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
              <input
                value={s.cover_image_url ?? ""}
                onChange={(e) => patch(s.id, { cover_image_url: e.target.value })}
                placeholder="커버 이미지 URL (텍스트)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
              <textarea
                value={s.body ?? ""}
                onChange={(e) => patch(s.id, { body: e.target.value })}
                rows={5}
                placeholder="스토리 본문"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={s.is_published}
                    onChange={(e) => patch(s.id, { is_published: e.target.checked })}
                  />
                  공개(is_published)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave(s)}
                    disabled={savingId === s.id}
                    className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    className="flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
                  >
                    <Trash2 className="h-3 w-3" />
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
