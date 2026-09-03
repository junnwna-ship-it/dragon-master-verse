import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sprout, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DRAGON_MASTER_SEED, DRAGON_MASTER_CHAPTER_ID } from "@/data/storySeed";

/**
 * Admin-only utility: injects the initial visual-novel chapter into `story_nodes`.
 * Existing nodes with the same (chapter_id, node_key) are refreshed, never duplicated.
 */
export function StorySeedButton() {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const run = async () => {
    setBusy(true);
    try {
      // Loosely typed table view: VN columns are newer than the generated types.
      const table = supabase.from("story_nodes") as unknown as {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
        insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
        update: (patch: unknown) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };

      const { data, error } = await table.select("id, node_key").eq("chapter_id", DRAGON_MASTER_CHAPTER_ID);
      if (error) throw new Error(error.message);

      const existing = new Map<string, string>();
      for (const row of (data ?? []) as { id: string; node_key: string | null }[]) {
        if (row.node_key) existing.set(row.node_key, row.id);
      }

      let created = 0;
      let updated = 0;
      const toInsert: unknown[] = [];

      for (const node of DRAGON_MASTER_SEED) {
        const id = existing.get(node.node_key);
        if (id) {
          const { error: upErr } = await table.update(node).eq("id", id);
          if (upErr) throw new Error(upErr.message);
          updated += 1;
        } else {
          toInsert.push(node);
          created += 1;
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await table.insert(toInsert);
        if (insErr) throw new Error(insErr.message);
      }

      await qc.invalidateQueries({ queryKey: ["cms", "story_nodes"] });
      await qc.invalidateQueries({ queryKey: ["vn"] });
      toast.success(`초기 스토리 주입 완료 — 신규 ${created}건, 갱신 ${updated}건`);
    } catch (e) {
      toast.error(`주입 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <Sprout className="h-4 w-4 text-emerald-300" /> 초기 스토리 데이터 주입
      </h2>
      <p className="mt-0.5 text-[11px] text-slate-400">
        “{DRAGON_MASTER_CHAPTER_ID}” 챕터의 기본 노드 {DRAGON_MASTER_SEED.length}개를 공개 상태로 넣습니다.
        같은 노드 키는 덮어쓰기 되므로 여러 번 눌러도 중복되지 않습니다.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 py-2.5 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
        {busy ? "주입 중…" : "스토리 시드 주입하기"}
      </button>
    </section>
  );
}
