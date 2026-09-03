import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { claimFirstAdmin, getAdminStatus, grantAdminByEmail, recordAdminLogin } from "@/lib/admin.functions";

type Status = { isAdmin: boolean; adminExists: boolean; canBootstrap: boolean };

/**
 * Admin sign-in / admin account creation.
 *
 * The role itself is never granted from the browser: `claimFirstAdmin` runs
 * server-side and only succeeds while the project has no admin yet. After that,
 * an existing admin promotes teammates by email.
 */
export function AdminLogin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fetchStatus = useServerFn(getAdminStatus);
  const claim = useServerFn(claimFirstAdmin);
  const grant = useServerFn(grantAdminByEmail);
  const logLogin = useServerFn(recordAdminLogin);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");

  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      setStatus((await fetchStatus()) as Status);
    } catch (err) {
      console.error("[AdminLogin] status failed:", err);
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus(null);
      return;
    }
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin/login` },
        });
        if (error) throw error;
        toast.success("계정이 생성되었습니다.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("로그인되었습니다.");
        try {
          await logLogin();
        } catch (logErr) {
          console.error("[AdminLogin] audit log failed:", logErr);
        }
      }
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "요청을 처리할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  };

  const claimAdmin = async () => {
    setBusy(true);
    try {
      await claim();
      toast.success("관리자 권한이 부여되었습니다.");
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "권한 부여에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const promote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await grant({ data: { email: grantEmail } });
      toast.success(`${grantEmail} 계정에 관리자 권한을 부여했습니다.`);
      setGrantEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "권한 부여에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStatus(null);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-black text-slate-100">
          <ShieldCheck className="h-5 w-5 text-amber-300" />
          관리자 로그인
        </h1>
        <Link
          to="/app"
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
        >
          <ArrowLeft className="h-3 w-3" />
          게임으로
        </Link>
      </header>

      {authLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> 확인 중…
        </p>
      ) : !user ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs text-slate-400">
            {mode === "signin"
              ? "관리자 계정 이메일로 로그인하세요."
              : "새 계정을 만든 뒤 관리자 권한을 받을 수 있습니다."}
          </p>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "signin" ? "로그인" : "관리자 계정 만들기"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            {mode === "signin" ? "계정이 없으신가요? 새로 만들기" : "이미 계정이 있어요. 로그인"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs text-slate-400">로그인 계정</p>
            <p className="text-sm font-bold text-slate-100">{user.email}</p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  status?.isAdmin
                    ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border border-slate-600 bg-slate-800 text-slate-300"
                }`}
              >
                {statusLoading ? "확인 중…" : status?.isAdmin ? "관리자" : "일반 사용자"}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                로그아웃
              </button>
            </div>
          </div>

          {status?.isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => navigate({ to: "/admin/dashboard" })}
                className="w-full rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-950"
              >
                관리자 대시보드로 이동
              </button>
              <form onSubmit={promote} className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-200">다른 계정에 관리자 권한 부여</p>
                <input
                  type="email"
                  required
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-50"
                >
                  관리자로 지정
                </button>
              </form>
            </>
          ) : status?.canBootstrap ? (
            <div className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
              <p className="text-xs text-amber-100">
                아직 관리자가 없습니다. 이 계정을 첫 번째 관리자로 등록할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={claimAdmin}
                disabled={busy}
                className="w-full rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                이 계정을 관리자로 등록
              </button>
            </div>
          ) : (
            <p className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-xs text-slate-400">
              이 계정에는 관리자 권한이 없습니다. 이미 등록된 관리자에게 권한 부여를 요청해 주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
