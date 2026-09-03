import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildUgcChapterPayloads, ugcChapterId } from "@/lib/ugcImport";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Map as MapIcon, X, HelpCircle, Wand2, ScrollText } from "lucide-react";
import { CHAPTER_TEMPLATES, type ChapterTemplate } from "@/lib/chapterTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useCmsList, useCmsMutations, type StoryNode } from "@/hooks/useCms";

type OptionDraft = {
  label: string;
  next_node: string;
  stats: { key: string; value: number }[];
  quiz_ids: string[];
  quiz_required: boolean;
  quiz_fail_node: string;
};

type NodeDraft = {
  id: string | null;
  chapter_id: string;
  node_key: string;
  stage_number: number;
  node_type: string;
  title: string;
  speaker: string;
  description: string;
  body_text: string;
  background_image_url: string;
  is_start: boolean;
  is_published: boolean;
  stats: { key: string; value: number }[];
  reward_gold: number;
  reward_stat_points: number;
  reward_items: { key: string; value: number }[];
  options: OptionDraft[];
};

const blankOption = (): OptionDraft => ({
  label: "",
  next_node: "",
  stats: [],
  quiz_ids: [],
  quiz_required: false,
  quiz_fail_node: "",
});

const blankNode = (chapterId: string, stage: number): NodeDraft => ({
  id: null,
  chapter_id: chapterId,
  node_key: "",
  stage_number: stage,
  node_type: "story",
  title: "",
  speaker: "",
  description: "",
  body_text: "",
  background_image_url: "",
  is_start: false,
  is_published: false,
  stats: [],
  reward_gold: 0,
  reward_stat_points: 0,
  reward_items: [],
  options: [blankOption()],
});

function statsToRows(raw: unknown): { key: string; value: number }[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: Number(value) || 0,
  }));
}

function rowsToStats(rows: { key: string; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.key.trim().replace(/\s+/g, "_");
    if (key) out[key] = Number(r.value) || 0;
  }
  return out;
}

function nodeToDraft(node: StoryNode): NodeDraft {
  const n = node as StoryNode & Record<string, unknown>;
  const rawOptions = Array.isArray(n.options) ? (n.options as Record<string, unknown>[]) : [];
  return {
    id: node.id,
    chapter_id: String(n.chapter_id ?? "dragon_master"),
    node_key: String(n.node_key ?? ""),
    stage_number: Number(n.stage_number ?? 0),
    node_type: String(n.node_type ?? "story"),
    title: String(n.title ?? ""),
    speaker: String(n.speaker ?? ""),
    description: String(n.description ?? ""),
    body_text: String(n.body_text ?? ""),
    background_image_url: String(n.background_image_url ?? ""),
    is_start: Boolean(n.is_start),
    is_published: Boolean(n.is_published),
    stats: statsToRows(n.state_changes),
    reward_gold: Number((n.rewards as Record<string, unknown> | null)?.gold ?? 0) || 0,
    reward_stat_points: Number((n.rewards as Record<string, unknown> | null)?.stat_points ?? 0) || 0,
    reward_items: statsToRows((n.rewards as Record<string, unknown> | null)?.items),
    options: rawOptions.length
      ? rawOptions.map((o) => ({
          label: String(o.label ?? o.choice_text ?? ""),
          next_node: String(o.next_node ?? ""),
          stats: statsToRows(o.state_changes),
          quiz_ids: Array.isArray(o.quiz_ids) ? (o.quiz_ids as unknown[]).map(String) : [],
          quiz_required: Boolean(o.quiz_required),
          quiz_fail_node: String(o.quiz_fail_node ?? ""),
        }))
      : [blankOption()],
  };
}

/** Structured story-map editor: scenes, choices, stat effects and quiz gates. */
export function StoryMapEditor() {
  const { data, isLoading, error } = useCmsList<StoryNode>("story_nodes");
  const { create, update, remove } = useCmsMutations("story_nodes");
  const nodes = useMemo(() => data ?? [], [data]);

  const chapters = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      const c = (n as StoryNode & { chapter_id?: string }).chapter_id;
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [nodes]);

  const [chapterId, setChapterId] = useState("dragon_master");
  useEffect(() => {
    if (chapters.length && !chapters.includes(chapterId)) setChapterId(chapters[0]!);
  }, [chapters, chapterId]);

  const chapterNodes = useMemo(
    () =>
      nodes
        .filter((n) => String((n as StoryNode & { chapter_id?: string }).chapter_id ?? "") === chapterId)
        .sort((a, b) => Number(a.stage_number) - Number(b.stage_number)),
    [nodes, chapterId],
  );

  const nodeKeys = useMemo(
    () => chapterNodes.map((n) => String((n as StoryNode & { node_key?: string }).node_key ?? "")).filter(Boolean),
    [chapterNodes],
  );

  const { data: quizzes } = useQuery({
    queryKey: ["admin", "quizzes"],
    queryFn: async () => {
      const { data: rows, error: qErr } = await supabase
        .from("quizzes")
        .select("id,question,category")
        .order("created_at", { ascending: true });
      if (qErr) throw qErr;
      return rows ?? [];
    },
  });

  const [draft, setDraft] = useState<NodeDraft | null>(null);
  const patch = (p: Partial<NodeDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchOption = (i: number, p: Partial<OptionDraft>) =>
    setDraft((d) =>
      d ? { ...d, options: d.options.map((o, idx) => (idx === i ? { ...o, ...p } : o)) } : d,
    );

  const startNew = () =>
    setDraft(
      blankNode(
        chapterId,
        (chapterNodes.at(-1)?.stage_number ? Number(chapterNodes.at(-1)!.stage_number) : 0) + 1,
      ),
    );

  // ---- Build a whole chapter from a blueprint template ----
  // Every node is written through the normal CMS mutations, so the result is an
  // ordinary chapter that stays fully editable in the forms below.
  const [templateId, setTemplateId] = useState(CHAPTER_TEMPLATES[0]?.id ?? "");
  const [templateChapter, setTemplateChapter] = useState(
    CHAPTER_TEMPLATES[0]?.suggestedChapterId ?? "dragon_master",
  );
  const [templatePublish, setTemplatePublish] = useState(false);
  const [building, setBuilding] = useState(false);

  const buildTemplate = async () => {
    const tpl: ChapterTemplate | undefined = CHAPTER_TEMPLATES.find((t) => t.id === templateId);
    const target = templateChapter.trim();
    if (!tpl || !target) {
      toast.error("템플릿과 대상 챕터 ID를 확인해 주세요.");
      return;
    }
    const existing = new Map(
      nodes
        .filter((n) => String((n as StoryNode & { chapter_id?: string }).chapter_id ?? "") === target)
        .map((n) => [String((n as StoryNode & { node_key?: string }).node_key ?? ""), n.id] as const),
    );
    if (existing.size && !window.confirm(`"${target}" 챕터의 같은 노드 키 ${existing.size}개를 템플릿 내용으로 덮어씁니다. 계속할까요?`)) {
      return;
    }
    setBuilding(true);
    let created = 0;
    let updated = 0;
    try {
      for (const n of tpl.nodes) {
        const payload: Record<string, unknown> = {
          chapter_id: target,
          node_key: n.node_key,
          stage_number: n.stage_number,
          node_type: n.node_type || "story",
          title: n.title || n.node_key,
          speaker: n.speaker,
          body_text: n.body_text || null,
          background_image_url: n.background_image_url,
          is_start: n.is_start,
          is_published: templatePublish,
          state_changes: n.state_changes ?? {},
          rewards: n.rewards ?? {},
          quiz_ids: [],
          options: n.options.map((o) => ({
            label: o.label,
            next_node: o.next_node,
            state_changes: o.state_changes && Object.keys(o.state_changes).length ? o.state_changes : null,
            ...(o.quiz_ids?.length
              ? {
                  quiz_ids: o.quiz_ids,
                  quiz_required: !!o.quiz_required,
                  quiz_fail_node: o.quiz_fail_node ?? null,
                }
              : {}),
          })),
        };
        const id = existing.get(n.node_key);
        if (id) {
          await update.mutateAsync({ id, patch: payload });
          updated++;
        } else {
          await create.mutateAsync(payload);
          created++;
        }
      }
      toast.success(`템플릿 빌드 완료: 새 장면 ${created}개, 갱신 ${updated}개`);
      setChapterId(target);
    } catch (e) {
      toast.error(`템플릿 빌드 실패: ${(e as Error).message}`);
    } finally {
      setBuilding(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.chapter_id.trim() || !draft.node_key.trim()) {
      toast.error("챕터 ID와 노드 키는 필수입니다.");
      return;
    }
    const payload: Record<string, unknown> = {
      chapter_id: draft.chapter_id.trim(),
      node_key: draft.node_key.trim(),
      stage_number: Number(draft.stage_number) || 0,
      node_type: draft.node_type.trim() || "story",
      title: draft.title.trim() || draft.node_key.trim(),
      speaker: draft.speaker.trim() || null,
      description: draft.description.trim() || null,
      body_text: draft.body_text.trim() || null,
      background_image_url: draft.background_image_url.trim() || null,
      is_start: draft.is_start,
      is_published: draft.is_published,
      state_changes: rowsToStats(draft.stats),
      rewards: {
        gold: Math.max(Number(draft.reward_gold) || 0, 0),
        stat_points: Math.max(Number(draft.reward_stat_points) || 0, 0),
        items: rowsToStats(draft.reward_items),
      },
      quiz_ids: [],
      options: draft.options
        .filter((o) => o.label.trim())
        .map((o) => ({
          label: o.label.trim(),
          next_node: o.next_node.trim() || null,
          state_changes: Object.keys(rowsToStats(o.stats)).length ? rowsToStats(o.stats) : null,
          ...(o.quiz_ids.length
            ? {
                quiz_ids: o.quiz_ids,
                quiz_required: o.quiz_required,
                quiz_fail_node: o.quiz_fail_node.trim() || null,
              }
            : {}),
        })),
    };

    try {
      if (draft.id) await update.mutateAsync({ id: draft.id, patch: payload });
      else await create.mutateAsync(payload);
      toast.success("저장되었습니다.");
      setDraft(null);
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  };

  // ---- Studio (UGC) stories are auto-registered as editable chapters ----
  const { data: studioStories } = useQuery({
    queryKey: ["admin", "user_stories", "map"],
    queryFn: async () => {
      const { data: rows, error: sErr } = await (
        supabase as unknown as { from: (t: string) => any }
      )
        .from("user_stories")
        .select("id,title,body,is_published,updated_at,user_id")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (sErr) throw sErr;
      return (rows ?? []) as {
        id: string;
        title: string;
        body: string | null;
        is_published: boolean;
        updated_at: string;
      }[];
    },
  });

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const autoSynced = useRef(false);

  const syncStudioStory = useCallback(
    async (story: { id: string; title: string; body: string | null }, silent = false) => {
      setSyncingId(story.id);
      try {
        const { chapterId: target, payloads, errors } = await buildUgcChapterPayloads({
          storyId: story.id,
          title: story.title || "무제 스토리",
          body: story.body,
          publish: false,
        });
        if (!payloads.length) {
          if (!silent) toast.error("가져올 장면이 없습니다. 스튜디오 본문 형식을 확인해 주세요.");
          return;
        }
        const existing = new Map(
          nodes
            .filter((n) => String((n as StoryNode & { chapter_id?: string }).chapter_id ?? "") === target)
            .map((n) => [String((n as StoryNode & { node_key?: string }).node_key ?? ""), n.id] as const),
        );
        for (const payload of payloads) {
          const id = existing.get(String(payload.node_key));
          if (id) await update.mutateAsync({ id, patch: payload });
          else await create.mutateAsync(payload);
        }
        if (!silent) {
          toast.success(
            `"${story.title}" 챕터(${target}) 등록 완료: 장면 ${payloads.length}개` +
              (errors.length ? ` · 형식 경고 ${errors.length}건` : ""),
          );
        }
      } catch (e) {
        if (!silent) toast.error(`가져오기 실패: ${(e as Error).message}`);
      } finally {
        setSyncingId(null);
      }
    },
    [nodes, create, update],
  );

  // First load: register any studio story that has no chapter yet, so the map
  // list always shows user-created stories without a manual step.
  useEffect(() => {
    if (autoSynced.current) return;
    if (isLoading || !studioStories) return;
    autoSynced.current = true;
    const pending = studioStories.filter(
      (s) => (s.body ?? "").trim() && !chapters.includes(ugcChapterId(s.id)),
    );
    if (!pending.length) return;
    void (async () => {
      for (const s of pending) await syncStudioStory(s, true);
      toast.success(`스튜디오 스토리 ${pending.length}개를 스토리 맵에 등록했습니다.`);
    })();
  }, [isLoading, studioStories, chapters, syncStudioStory]);

  const del = async (node: StoryNode) => {
    if (!window.confirm(`"${node.title}" 장면을 삭제할까요?`)) return;
    try {
      await remove.mutateAsync(node.id);
      toast.success("삭제되었습니다.");
      if (draft?.id === node.id) setDraft(null);
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
          <MapIcon className="h-4 w-4 text-violet-300" /> 스토리 맵 편집기
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          장면 본문, 선택지, 스탯 변화, 퀴즈 관문을 폼으로 직접 입력하고 저장합니다.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">챕터</span>
            <input
              list="story-chapters"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <datalist id="story-chapters">
              {chapters.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-bold text-slate-950 hover:bg-violet-400"
          >
            <Plus className="h-4 w-4" /> 새 장면
          </button>
        </div>
      </section>

      {/* Studio (UGC) stories, auto-registered as chapters */}
      <section className="rounded-2xl border border-sky-400/40 bg-sky-400/5 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-sky-100">
          <ScrollText className="h-4 w-4 text-sky-300" /> 스튜디오 창작 스토리
        </h3>
        <p className="mt-0.5 text-[11px] text-sky-200/70">
          유저가 스튜디오에서 만든 스토리는 <code>ugc_…</code> 챕터로 자동 등록되어 아래 편집기에서 장면·선택지·퀴즈를
          바로 수정할 수 있습니다. 본문을 수정한 스토리는 "다시 등록"으로 갱신하세요.
        </p>
        {!studioStories?.length ? (
          <p className="mt-3 text-[11px] text-slate-400">등록된 창작 스토리가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {studioStories.map((s) => {
              const target = ugcChapterId(s.id);
              const registered = chapters.includes(target);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-100">{s.title || "무제 스토리"}</p>
                    <p className="text-[10px] font-mono text-slate-500">
                      {target} · {registered ? "등록됨" : "미등록"} · {s.is_published ? "공개" : "비공개"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {registered && (
                      <button
                        type="button"
                        onClick={() => setChapterId(target)}
                        className="rounded-lg border border-slate-600 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200"
                      >
                        편집
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={syncingId === s.id}
                      onClick={() => void syncStudioStory(s)}
                      className="flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-100 disabled:opacity-50"
                    >
                      {syncingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {registered ? "다시 등록" : "등록"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Chapter template builder */}
      <section className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-amber-100">
          <Wand2 className="h-4 w-4 text-amber-300" /> 템플릿으로 챕터 빌드
        </h3>
        <p className="mt-0.5 text-[11px] text-amber-200/70">
          완성된 챕터 템플릿을 story_nodes에 생성합니다. 빌드 후에는 아래 편집기에서 장면·선택지·퀴즈를
          그대로 수정할 수 있습니다.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">템플릿</span>
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                const t = CHAPTER_TEMPLATES.find((x) => x.id === e.target.value);
                if (t) setTemplateChapter(t.suggestedChapterId);
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {CHAPTER_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              대상 챕터 ID
            </span>
            <input
              value={templateChapter}
              onChange={(e) => setTemplateChapter(e.target.value)}
              placeholder="dragon_master_v2"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {CHAPTER_TEMPLATES.find((t) => t.id === templateId)?.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={templatePublish}
              onChange={(e) => setTemplatePublish(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            바로 공개(is_published)
          </label>
          <button
            type="button"
            onClick={() => void buildTemplate()}
            disabled={building}
            className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {building ? "빌드 중…" : `${CHAPTER_TEMPLATES.find((t) => t.id === templateId)?.nodes.length ?? 0}개 장면 빌드`}
          </button>
        </div>
      </section>

      {isLoading && (
        <p className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
          불러오기 실패: {(error as Error).message}
        </p>
      )}

      {/* Scene list */}
      <ul className="space-y-2">
        {chapterNodes.map((n) => {
          const key = String((n as StoryNode & { node_key?: string }).node_key ?? "");
          const optCount = Array.isArray((n as StoryNode & { options?: unknown }).options)
            ? ((n as StoryNode & { options: unknown[] }).options as unknown[]).length
            : 0;
          return (
            <li
              key={n.id}
              className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                draft?.id === n.id
                  ? "border-violet-400 bg-violet-500/10"
                  : "border-slate-700/70 bg-slate-800/40"
              }`}
            >
              <button
                type="button"
                onClick={() => setDraft(nodeToDraft(n))}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-bold text-slate-100">
                  #{n.stage_number} {n.title}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {key} · 선택지 {optCount}개 · {n.is_published ? "공개" : "비공개"}
                </p>
              </button>
              <button
                type="button"
                onClick={() => void del(n)}
                aria-label="삭제"
                className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-2 text-rose-200 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
        {!isLoading && chapterNodes.length === 0 && (
          <li className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 text-center text-xs text-slate-500">
            이 챕터에는 장면이 없습니다. "새 장면"으로 시작하세요.
          </li>
        )}
      </ul>

      {/* Editor form */}
      {draft && (
        <section className="space-y-3 rounded-2xl border border-violet-500/50 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              {draft.id ? "장면 편집" : "새 장면 추가"}
            </h3>
            <button
              type="button"
              onClick={() => setDraft(null)}
              aria-label="닫기"
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="챕터 ID">
              <input
                value={draft.chapter_id}
                onChange={(e) => patch({ chapter_id: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="노드 키 (고유)">
              <input
                value={draft.node_key}
                onChange={(e) => patch({ node_key: e.target.value })}
                placeholder="Node_3"
                className={inputCls}
              />
            </Field>
            <Field label="정렬 번호">
              <input
                type="number"
                value={draft.stage_number}
                onChange={(e) => patch({ stage_number: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="노드 타입">
              <input
                value={draft.node_type}
                onChange={(e) => patch({ node_type: e.target.value })}
                placeholder="story / quiz / boss"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="장면 제목">
            <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="화자">
            <input
              value={draft.speaker}
              onChange={(e) => patch({ speaker: e.target.value })}
              placeholder="내레이터"
              className={inputCls}
            />
          </Field>
          <Field label="본문 텍스트">
            <textarea
              rows={4}
              value={draft.body_text}
              onChange={(e) => patch({ body_text: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="요약 설명 (목록/미리보기용)">
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="배경 이미지 URL (텍스트)">
            <input
              value={draft.background_image_url}
              onChange={(e) => patch({ background_image_url: e.target.value })}
              placeholder="https://.../bg.jpg"
              className={inputCls}
            />
          </Field>

          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              🎁 클리어 보상 (플레이어당 1회 지급)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="골드">
                <input
                  type="number"
                  min={0}
                  value={draft.reward_gold}
                  onChange={(e) => patch({ reward_gold: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="드래곤 능력 포인트">
                <input
                  type="number"
                  min={0}
                  value={draft.reward_stat_points}
                  onChange={(e) => patch({ reward_stat_points: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>
            <StatRows
              title="아이템 (item_key / 수량 — 예: bonding_token)"
              rows={draft.reward_items}
              onChange={(reward_items) => patch({ reward_items })}
            />
          </div>

          <StatRows
            title="장면 진입 시 스탯 변화"
            rows={draft.stats}
            onChange={(stats) => patch({ stats })}
          />

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={draft.is_start}
                onChange={(e) => patch({ is_start: e.target.checked })}
              />
              챕터 시작 노드
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => patch({ is_published: e.target.checked })}
              />
              공개(is_published)
            </label>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300">선택지</h4>
              <button
                type="button"
                onClick={() => patch({ options: [...draft.options, blankOption()] })}
                className="flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[11px] font-bold text-violet-200"
              >
                <Plus className="h-3 w-3" /> 선택지 추가
              </button>
            </div>

            {draft.options.map((o, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    선택지 {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => patch({ options: draft.options.filter((_, idx) => idx !== i) })}
                    aria-label="선택지 삭제"
                    className="rounded p-1 text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Field label="선택지 문구">
                  <input
                    value={o.label}
                    onChange={(e) => patchOption(i, { label: e.target.value })}
                    placeholder="조심스럽게 다가간다"
                    className={inputCls}
                  />
                </Field>
                <Field label="다음 노드 키">
                  <input
                    list="story-node-keys"
                    value={o.next_node}
                    onChange={(e) => patchOption(i, { next_node: e.target.value })}
                    placeholder="Node_4 (비우면 엔딩)"
                    className={inputCls}
                  />
                </Field>

                <StatRows
                  title="선택 시 스탯 변화"
                  rows={o.stats}
                  onChange={(stats) => patchOption(i, { stats })}
                />

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    <HelpCircle className="h-3 w-3" /> 퀴즈 관문 (선택)
                  </p>
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {(quizzes ?? []).length === 0 && (
                      <p className="text-[11px] text-slate-500">등록된 퀴즈가 없습니다.</p>
                    )}
                    {(quizzes ?? []).map((q) => {
                      const checked = o.quiz_ids.includes(q.id);
                      return (
                        <label key={q.id} className="flex items-start gap-2 text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              patchOption(i, {
                                quiz_ids: e.target.checked
                                  ? [...o.quiz_ids, q.id]
                                  : o.quiz_ids.filter((id) => id !== q.id),
                              })
                            }
                          />
                          <span className="min-w-0">
                            <span className="line-clamp-2">{q.question}</span>
                            <span className="text-[10px] text-slate-500">{q.category}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {o.quiz_ids.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center gap-2 text-[11px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={o.quiz_required}
                          onChange={(e) => patchOption(i, { quiz_required: e.target.checked })}
                        />
                        정답을 맞혀야 통과 (필수)
                      </label>
                      <Field label="퀴즈 실패 시 이동 노드">
                        <input
                          list="story-node-keys"
                          value={o.quiz_fail_node}
                          onChange={(e) => patchOption(i, { quiz_fail_node: e.target.value })}
                          placeholder="Node_4"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <datalist id="story-node-keys">
            {nodeKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={() => void save()}
            disabled={create.isPending || update.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-50"
          >
            {create.isPending || update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            저장하기
          </button>
        </section>
      )}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StatRows({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: { key: string; value: number }[];
  onChange: (rows: { key: string; value: number }[]) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
        <button
          type="button"
          onClick={() => onChange([...rows, { key: "", value: 0 }])}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-800"
        >
          <Plus className="h-3 w-3" /> 추가
        </button>
      </div>
      {rows.length === 0 && <p className="mt-1 text-[11px] text-slate-600">변화 없음</p>}
      {rows.map((r, i) => (
        <div key={i} className="mt-1 flex items-center gap-2">
          <input
            value={r.key}
            onChange={(e) =>
              onChange(rows.map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))
            }
            placeholder="Courage"
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          />
          <input
            type="number"
            value={r.value}
            onChange={(e) =>
              onChange(rows.map((x, idx) => (idx === i ? { ...x, value: Number(e.target.value) } : x)))
            }
            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            aria-label="스탯 삭제"
            className="rounded p-1 text-rose-300 hover:bg-rose-500/10"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
