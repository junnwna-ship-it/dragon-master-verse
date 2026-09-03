import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, ShieldAlert, Store, Dumbbell, Map, Settings2, BookOpen, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { CmsStoreItems, CmsStoryNodes, CmsTrainingStats } from "@/components/game/cms/CmsSections";
import {
  useCmsList,
  useCmsMutations,
  type CmsTable,
  type GameSetting,
  type StoreItem,
  type StoryNode,
  type TrainingStat,
} from "@/hooks/useCms";

/**
 * Unified text-only admin CMS.
 *
 * Deliberately has NO file-upload inputs: every image/icon/background field is
 * a plain text input where the admin pastes an externally hosted URL. Writes
 * go straight to the CMS tables and are authorized by RLS (admin-only).
 */

type FieldKind = "text" | "textarea" | "number" | "url" | "uuidlist" | "json" | "boolean";

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
}

interface TabDef {
  /** Unique tab identity (two tabs may target the same table). */
  key: string;
  id: CmsTable;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  titleField: string;
  fields: FieldDef[];
  blank: Record<string, unknown>;
}

const TABS: TabDef[] = [
  {
    key: "store_items",
    id: "store_items",
    label: "1. 상점 관리",
    icon: Store,
    titleField: "name",
    fields: [
      { key: "name", label: "상품명", kind: "text", placeholder: "골드 1,000" },
      { key: "price_usd", label: "가격 (USD)", kind: "number", placeholder: "1.99" },
      { key: "gold_reward", label: "지급 골드", kind: "number", placeholder: "1000" },
      { key: "item_type", label: "아이템 타입", kind: "text", placeholder: "gold / potion / pass" },
      { key: "image_url", label: "이미지 URL (텍스트)", kind: "url", placeholder: "https://.../item.png" },
      { key: "sort_order", label: "정렬 순서", kind: "number", placeholder: "0" },
    ],
    blank: { name: "", price_usd: 0, gold_reward: 0, item_type: "gold", image_url: "", sort_order: 0, is_published: false },
  },
  {
    key: "training_stats",
    id: "training_stats",
    label: "2. 훈련 능력 관리",
    icon: Dumbbell,
    titleField: "stat_name",
    fields: [
      { key: "stat_name", label: "능력 이름", kind: "text", placeholder: "공격력" },
      { key: "stat_code", label: "능력 코드", kind: "text", placeholder: "atk / def / hp / mp" },
      { key: "base_cost", label: "기본 비용", kind: "number", placeholder: "100" },
      { key: "stat_increase", label: "상승치", kind: "number", placeholder: "10" },
      { key: "icon_url", label: "아이콘 URL (텍스트)", kind: "url", placeholder: "https://.../icon.png" },
      { key: "sort_order", label: "정렬 순서", kind: "number", placeholder: "0" },
    ],
    blank: { stat_name: "", stat_code: "", base_cost: 100, stat_increase: 10, icon_url: "", sort_order: 0, is_published: false },
  },
  {
    key: "story_nodes",
    id: "story_nodes",
    label: "3. 스토리 맵 관리",
    icon: Map,
    titleField: "title",
    fields: [
      { key: "title", label: "노드 제목", kind: "text", placeholder: "마법사 멀린의 시련" },
      { key: "stage_number", label: "스테이지 번호", kind: "number", placeholder: "1" },
      { key: "node_type", label: "노드 타입", kind: "text", placeholder: "battle / quiz / boss" },
      { key: "description", label: "설명", kind: "textarea", placeholder: "노드 소개 문구" },
      { key: "quiz_ids", label: "퀴즈 ID 목록 (콤마 구분)", kind: "uuidlist", placeholder: "uuid, uuid" },
      { key: "background_image_url", label: "배경 이미지 URL (텍스트)", kind: "url", placeholder: "https://.../bg.jpg" },
    ],
    blank: { title: "", stage_number: 1, node_type: "battle", description: "", quiz_ids: [], background_image_url: "", is_published: false },
  },
  {
    key: "game_settings",
    id: "game_settings",
    label: "4. 전역 설정",
    icon: Settings2,
    titleField: "key",
    fields: [
      { key: "key", label: "설정 키", kind: "text", placeholder: "eventBannerText" },
      { key: "value", label: "값", kind: "textarea", placeholder: "여름 이벤트 진행 중!" },
      { key: "description", label: "설명", kind: "text", placeholder: "로비 배너에 노출되는 문구" },
    ],
    blank: { key: "", value: "", description: "", is_published: false },
  },
  {
    key: "story_chapters",
    id: "story_nodes",
    label: "5. 스토리 챕터 관리",
    icon: BookOpen,
    titleField: "title",
    fields: [
      { key: "chapter_id", label: "챕터 ID", kind: "text", placeholder: "prologue" },
      { key: "node_key", label: "노드 키 (챕터 내 고유)", kind: "text", placeholder: "start" },
      { key: "is_start", label: "챕터 시작 노드", kind: "boolean" },
      { key: "title", label: "노드 제목", kind: "text", placeholder: "알에서 깨어난 소리" },
      { key: "stage_number", label: "정렬 번호", kind: "number", placeholder: "1" },
      { key: "speaker", label: "화자", kind: "text", placeholder: "내레이터" },
      { key: "body_text", label: "본문 텍스트", kind: "textarea", placeholder: "동굴 깊은 곳에서 울음소리가…" },
      {
        key: "options",
        label: '선택지 JSON [{ "label", "next_node", "state_changes" }]',
        kind: "json",
        placeholder: '[{"label":"다가간다","next_node":"approach","state_changes":{"Worm_Affinity":2}}]',
      },
      {
        key: "state_changes",
        label: "노드 진입 시 스탯 변화 JSON",
        kind: "json",
        placeholder: '{"Courage":1}',
      },
      { key: "background_image_url", label: "배경 이미지 URL (텍스트)", kind: "url", placeholder: "https://.../bg.jpg" },
    ],
    blank: {
      chapter_id: "prologue",
      node_key: "",
      is_start: false,
      title: "",
      stage_number: 1,
      node_type: "story",
      speaker: "내레이터",
      body_text: "",
      options: [],
      state_changes: {},
      background_image_url: "",
      is_published: false,
    },
  },
];

type AnyRow = (StoreItem | StoryNode | TrainingStat | GameSetting) & Record<string, unknown>;

export function CmsDashboard() {
  const { isAdmin, loading } = useIsAdmin();
  const [tabKey, setTabKey] = useState<string>("store_items");
  const tab = TABS.find((x) => x.key === tabKey)!;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 권한 확인 중…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-rose-300" />
        <h1 className="mt-3 text-lg font-bold text-slate-100">관리자 전용 페이지</h1>
        <p className="mt-1 text-sm text-slate-400">
          이 대시보드는 관리자 계정만 열 수 있습니다. 데이터 접근 자체도 DB 정책(RLS)으로 차단됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Admin CMS</p>
        <h1 className="text-2xl font-bold text-slate-100">통합 콘텐츠 관리</h1>
        <p className="mt-1 text-xs text-slate-400">
          이미지는 외부 서버에 올린 뒤 URL만 붙여넣으세요. 업로드 기능은 제공하지 않습니다.
        </p>
      </header>

      <nav className="-mx-4 mb-5 overflow-x-auto px-4">
        <div className="flex gap-2">
          {TABS.map((x) => {
            const Icon = x.icon;
            const active = x.key === tabKey;
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => setTabKey(x.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-amber-400 bg-amber-500/15 text-amber-200"
                    : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {x.label}
              </button>
            );
          })}
        </div>
      </nav>

      <CmsTableEditor key={tab.key} tab={tab} />
    </div>
  );
}

function CmsTableEditor({ tab }: { tab: TabDef }) {
  const { data, isLoading, error } = useCmsList<AnyRow>(tab.id);
  const { create, update, remove } = useCmsMutations(tab.id);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...tab.blank }));
  const [previewAll, setPreviewAll] = useState(false);
  const [previewRow, setPreviewRow] = useState<Record<string, unknown> | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const submitNew = async () => {
    try {
      await create.mutateAsync(draft);
      setDraft({ ...tab.blank });
      toast.success("추가되었습니다.");
    } catch (e) {
      toast.error(`추가 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Preview mode — see unpublished / unsaved content exactly as players will */}
      <section className="rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
              <Eye className="h-4 w-4 text-sky-300" /> 프리뷰 모드
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              공개 토글을 켜기 전에, 저장된 비공개 항목까지 플레이어 화면과 동일한 UI로 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreviewAll((v) => !v)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition ${
              previewAll
                ? "border-sky-400 bg-sky-500/20 text-sky-200"
                : "border-slate-600 bg-slate-900/60 text-slate-300 hover:border-sky-400"
            }`}
          >
            {previewAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewAll ? "닫기" : "열기"}
          </button>
        </div>

        {previewAll && (
          <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/80 p-3">
            <PreviewLegend />
            <CmsPreviewSurface tab={tab} rows={[...rows, ...(isDraftFilled(tab, draft) ? [draft] : [])]} />
          </div>
        )}
      </section>

      {/* Create */}
      <section className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-100">
          <Plus className="h-4 w-4 text-amber-300" /> 새 항목 추가
        </h2>
        <div className="grid gap-3">
          {tab.fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={draft[f.key]}
              onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
            />
          ))}
          <PublishToggle
            checked={Boolean(draft["is_published"])}
            onChange={(v) => setDraft((d) => ({ ...d, is_published: v }))}
          />
        </div>
        <button
          type="button"
          onClick={() => setPreviewRow({ ...draft })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
        >
          <Eye className="h-4 w-4" /> 이 항목만 미리보기
        </button>
        <button
          type="button"
          onClick={submitNew}
          disabled={create.isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          추가하기
        </button>
      </section>

      {/* List */}
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
      {!isLoading && rows.length === 0 && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 text-center text-xs text-slate-500">
          등록된 항목이 없습니다.
        </p>
      )}

      {rows.map((row) => (
        <RowEditor
          key={String(row.id)}
          tab={tab}
          row={row}
          onPreview={(snapshot) => setPreviewRow(snapshot)}
          onSave={(patch) =>
            update
              .mutateAsync({ id: String(row.id), patch })
              .then(() => toast.success("저장되었습니다."))
              .catch((e: Error) => toast.error(`저장 실패: ${e.message}`))
          }
          onDelete={() =>
            remove
              .mutateAsync(String(row.id))
              .then(() => toast.success("삭제되었습니다."))
              .catch((e: Error) => toast.error(`삭제 실패: ${e.message}`))
          }
        />
      ))}

      {previewRow && (
        <PreviewModal tab={tab} row={previewRow} onClose={() => setPreviewRow(null)} />
      )}
    </div>
  );
}

/** True once the "new item" draft has enough content to be worth previewing. */
function isDraftFilled(tab: TabDef, draft: Record<string, unknown>) {
  return String(draft[tab.titleField] ?? "").trim().length > 0;
}

function PreviewLegend() {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sky-300">
      Preview · 비공개 항목 포함 (실제 플레이어에게는 공개된 항목만 보입니다)
    </p>
  );
}

/** Renders CMS rows through the exact player-facing components. */
function CmsPreviewSurface({ tab, rows }: { tab: TabDef; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="py-2 text-center text-[11px] text-slate-500">미리볼 항목이 없습니다.</p>;
  }

  if (tab.key === "story_chapters") return <VnNodePreview rows={rows} />;
  if (tab.id === "store_items") return <CmsStoreItems rows={rows as unknown as StoreItem[]} />;
  if (tab.id === "training_stats") return <CmsTrainingStats rows={rows as unknown as TrainingStat[]} />;
  if (tab.id === "story_nodes") return <CmsStoryNodes rows={rows as unknown as StoryNode[]} />;

  // game_settings has no dedicated player component — show the resolved values.
  return (
    <div className="space-y-2">
      {(rows as unknown as GameSetting[]).map((s, i) => (
        <div
          key={String(s.id ?? i)}
          className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.key}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{s.value || "(빈 값)"}</p>
          {s.description && <p className="mt-1 text-[11px] text-slate-500">{s.description}</p>}
        </div>
      ))}
    </div>
  );
}

/** Text-only visual-novel node preview: dialog box + option buttons. */
function VnNodePreview({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const options = Array.isArray(r.options) ? (r.options as Record<string, unknown>[]) : [];
        return (
          <div key={String(r.id ?? i)} className="rounded-xl border border-slate-700/60 bg-slate-950/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
              {String(r.chapter_id ?? "?")} / {String(r.node_key ?? "?")}
              {r.is_start ? " · START" : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">{String(r.speaker ?? r.title ?? "")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">
              {String(r.body_text ?? r.description ?? "(본문 없음)")}
            </p>
            <div className="mt-2 space-y-1.5">
              {options.map((o, oi) => (
                <div
                  key={oi}
                  className="rounded-lg border border-amber-300/30 bg-black/40 px-3 py-2 text-xs text-slate-100"
                >
                  {String(o.label ?? "…")}
                  <span className="ml-2 text-[10px] text-slate-400">
                    → {String(o.next_node ?? "(챕터 종료)")}
                    {o.state_changes ? ` · ${JSON.stringify(o.state_changes)}` : ""}
                  </span>
                </div>
              ))}
              {options.length === 0 && (
                <p className="text-[11px] text-slate-500">선택지 없음 — “계속” 버튼으로 진행됩니다.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewModal({
  tab,
  row,
  onClose,
}: {
  tab: TabDef;
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const published = Boolean(row["is_published"]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300">
              Preview · {published ? "공개 예정 상태: 공개" : "현재 비공개"}
            </p>
            <h3 className="text-base font-bold text-slate-100">
              {String(row[tab.titleField] ?? "(제목 없음)")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:border-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
          <CmsPreviewSurface tab={tab} rows={[row]} />
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          저장하지 않은 편집 내용까지 그대로 반영된 미리보기입니다. 공개 토글을 켜면 플레이어 화면에
          동일하게 노출됩니다.
        </p>
      </div>
    </div>
  );
}

function RowEditor({
  tab,
  row,
  onSave,
  onDelete,
  onPreview,
}: {
  tab: TabDef;
  row: AnyRow;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onPreview: (snapshot: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => ({ ...row }));
  const [busy, setBusy] = useState(false);
  const published = Boolean(form["is_published"]);
  const preview = String(form["image_url"] ?? form["icon_url"] ?? form["background_image_url"] ?? "");

  const save = async (patch?: Record<string, unknown>) => {
    const next = { ...form, ...(patch ?? {}) };
    setForm(next);
    setBusy(true);
    const payload: Record<string, unknown> = {};
    for (const f of tab.fields) payload[f.key] = next[f.key];
    payload.is_published = Boolean(next["is_published"]);
    await onSave(payload);
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-800/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {preview ? (
            <img
              src={preview}
              alt=""
              className="h-12 w-12 rounded-lg border border-slate-700 bg-slate-900 object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg border border-dashed border-slate-700 bg-slate-900" />
          )}
          <div>
            <p className="text-sm font-bold text-slate-100">
              {String(form[tab.titleField] ?? "(제목 없음)")}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              {published ? "공개 중" : "비공개"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PublishToggle checked={published} onChange={(v) => void save({ is_published: v })} compact />
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
            aria-label="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {tab.fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={form[f.key]}
            onChange={(v) => setForm((d) => ({ ...d, [f.key]: v }))}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPreview({ ...form })}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
      >
        <Eye className="h-4 w-4" /> 미리보기
      </button>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 py-2.5 text-sm font-semibold text-slate-100 hover:border-amber-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        변경사항 저장
      </button>
    </section>
  );
}

function PublishToggle({
  checked,
  onChange,
  compact,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      {!compact && (
        <span className="text-xs font-semibold text-slate-300">공개 (is_published)</span>
      )}
      <Switch checked={checked} onCheckedChange={onChange} />
      {compact && (
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {checked ? "ON" : "OFF"}
        </span>
      )}
    </label>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base =
    "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400 focus:outline-none";

  const display =
    field.kind === "json"
      ? typeof value === "string"
        ? value
        : JSON.stringify(value ?? null, null, 0)
      : field.kind === "uuidlist"
      ? Array.isArray(value)
        ? (value as string[]).join(", ")
        : String(value ?? "")
      : value == null
        ? ""
        : String(value);

  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {field.label}
      </label>
      {field.kind === "boolean" ? (
        <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />
      ) : field.kind === "json" ? (
        <JsonField value={display} placeholder={field.placeholder} onChange={onChange} />
      ) : field.kind === "textarea" ? (
        <textarea
          className={`${base} min-h-[72px]`}
          value={display}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={base}
          type={field.kind === "number" ? "number" : "text"}
          inputMode={field.kind === "number" ? "decimal" : undefined}
          value={display}
          placeholder={field.placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            if (field.kind === "number") {
              onChange(raw === "" ? 0 : Number(raw));
            } else if (field.kind === "uuidlist") {
              onChange(
                raw
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              );
            } else {
              onChange(raw);
            }
          }}
        />
      )}
    </div>
  );
}
/** JSON textarea that keeps invalid text locally and surfaces a parse hint. */
function JsonField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);

  return (
    <div>
      <textarea
        className={`w-full rounded-lg border bg-slate-900/70 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none ${
          invalid ? "border-rose-500" : "border-slate-700 focus:border-amber-400"
        } min-h-[88px]`}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw.trim() === "") {
            setInvalid(false);
            onChange(null);
            return;
          }
          try {
            onChange(JSON.parse(raw));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && (
        <p className="mt-1 text-[10px] text-rose-300">JSON 형식이 올바르지 않습니다 — 저장되지 않습니다.</p>
      )}
    </div>
  );
}
