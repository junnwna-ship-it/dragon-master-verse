import { useEffect, useState } from "react";
import { Loader2, Receipt, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Row {
  paddle_transaction_id: string;
  gold_credited: number;
  environment: string;
  created_at: string;
}

export function PaymentHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("processed_payments")
        .select("paddle_transaction_id, gold_credited, environment, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as Row[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-amber-300" />
        <h2 className="text-lg font-bold text-slate-100">결제 내역</h2>
      </div>

      {!user && (
        <p className="text-xs text-slate-500">로그인 후 확인할 수 있습니다.</p>
      )}

      {user && rows === null && !error && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-400">불러오기 실패: {error}</p>
      )}

      {rows && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
          아직 결제 내역이 없습니다.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => {
            const isSandbox = r.environment === "sandbox";
            const date = new Date(r.created_at).toLocaleString();
            return (
              <li
                key={r.paddle_transaction_id}
                className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-100">
                    골드 {r.gold_credited.toLocaleString()}G
                  </p>
                  <p className="truncate font-mono text-[10px] text-slate-500">
                    {r.paddle_transaction_id}
                  </p>
                  <p className="text-[10px] text-slate-500">{date}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    완료
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isSandbox
                        ? "bg-orange-500/20 text-orange-300"
                        : "bg-slate-700/60 text-slate-300"
                    }`}
                  >
                    {isSandbox ? "테스트" : "라이브"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}