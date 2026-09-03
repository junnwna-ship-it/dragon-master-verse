import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, ScrollText, ShieldAlert } from "lucide-react";
import { listAuditLogs } from "@/lib/admin.functions";

type LogRow = {
  id: string;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  detail: unknown;
  success: boolean;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  admin_login: "관리자 로그인",
  login_non_admin: "일반 계정 로그인 시도",
  admin_account_created: "관리자 계정 생성",
  role_granted: "관리자 권한 부여",
  role_revoked: "관리자 권한 해제",
};

function label(action: string) {
  if (action.startsWith("denied:")) return `차단됨 · ${action.slice(7)}`;
  return ACTION_LABEL[action] ?? action;
}

/** Admin-only audit trail: logins, role changes, account creation, blocked calls. */
export function AuditLogPanel() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await fetchLogs()) as LogRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "감사 로그를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <ScrollText className="h-4 w-4 text-amber-300" />
          관리자 감사 로그
        </h2>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </button>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
        </p>
      ) : error ? (
        <p className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
          <ShieldAlert className="h-4 w-4" /> {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-400">
          기록된 관리자 활동이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border p-3 text-xs ${
                r.success
                  ? "border-slate-700 bg-slate-900/60 text-slate-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-100"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-100">{label(r.action)}</span>
                <time className="text-[11px] text-slate-500">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </time>
              </div>
              <p className="mt-1 text-[11px]">
                수행: {r.actor_email ?? "알 수 없음"}
                {r.target_email ? ` → 대상: ${r.target_email}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
