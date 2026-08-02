import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, ShieldAlert, Store, Dumbbell, Map, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
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

type FieldKind = "text" | "textarea" | "number" | "url" | "uuidlist";

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
}

interface TabDef {
  id: CmsTable;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  titleField: string;
  fields: FieldDef[];
  blank: Record<string, unknown>;
}

const TABS: TabDef[] = [
  {
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
];

type AnyRow = (StoreItem | StoryNode | TrainingStat | GameSetting) & Record<string, unknown>;

export function CmsDashboard() {
  const { isAdmin, loading } = useIsAdmin();
  const [tabId, setTabId] = useState<CmsTable>("store_items");
  const tab = TABS.find((x) => x.id === tabId)!;

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
            const active = x.id === tabId;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setTabId(x.id)}
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

      <CmsTableEditor key={tab.id} tab={tab} />
    </div>
  );
}

function CmsTableEditor({ tab }: { tab: TabDef }) {
  const { data, isLoading, error } = useCmsList<AnyRow>(tab.id);
  const { create, update, remove } = useCmsMutations(tab.id);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...tab.blank }));

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
          onClick={submitNew}
          disabled={create.isPending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
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
    </div>
  );
}

function RowEditor({
  tab,
  row,
  onSave,
  onDelete,
}: {
  tab: TabDef;
  row: AnyRow;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
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
        onClick={() => void save()}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 py-2.5 text-sm font-semibold text-slate-100 hover:border-amber-400 disabled:opacity-50"
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
    field.kind === "uuidlist"
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
      {field.kind === "textarea" ? (
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