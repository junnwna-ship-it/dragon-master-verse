import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Map as MapIcon, X, HelpCircle } from "lucide-react";
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
