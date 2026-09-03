import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin account bootstrap.
 *
 * - The FIRST signed-in user may claim the admin role while no admin exists.
 * - Once an admin exists, only an existing admin can grant the role to others.
 *
 * Role rows live in `public.user_roles` (never on profiles), and every write
 * here happens server-side after the caller's identity is verified.
 */

async function adminCount() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function isAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Whether the caller is an admin, and whether the project has any admin yet. */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [mine, total] = await Promise.all([isAdmin(context.userId), adminCount()]);
    return { isAdmin: mine, adminExists: total > 0, canBootstrap: total === 0 };
  });

/** Claim the admin role. Allowed only while the project has no admin at all. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await isAdmin(context.userId)) return { ok: true, alreadyAdmin: true };
    if ((await adminCount()) > 0) {
      throw new Error("이미 관리자 계정이 존재합니다. 기존 관리자에게 권한을 요청해 주세요.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true, alreadyAdmin: false };
  });

/** Existing admin promotes another user (by their sign-in email) to admin. */
export const grantAdminByEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) {
      throw new Error("관리자만 다른 사용자에게 권한을 부여할 수 있습니다.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = data.email.trim().toLowerCase();

    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      userId = list.users.find((u) => u.email?.toLowerCase() === target)?.id ?? null;
      if (list.users.length < 200) break;
    }
    if (!userId) throw new Error("해당 이메일로 가입된 사용자를 찾을 수 없습니다.");

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (insertError) throw new Error(insertError.message);
    return { ok: true, email: target };
  });

/* ------------------------------------------------------------------ *
 * Audit log + admin-only gate for admin server endpoints.
 * ------------------------------------------------------------------ */

type AuditEntry = {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  targetUserId?: string | null;
  targetEmail?: string | null;
  detail?: Record<string, unknown>;
  success?: boolean;
};

/** Best-effort audit write; never blocks the caller's operation. */
async function writeAudit(entry: AuditEntry) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_logs").insert({
      action: entry.action,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail ?? null,
      detail: entry.detail ?? {},
      success: entry.success ?? true,
    });
  } catch (err) {
    console.error("[audit] failed to record admin action:", err);
  }
}

/**
 * Gate for admin-only server endpoints: throws unless the verified caller
 * holds the `admin` role. Route guards protect UI only — every admin RPC
 * must call this itself.
 */
async function assertAdmin(userId: string, action: string, email?: string | null) {
  if (await isAdmin(userId)) return;
  await writeAudit({
    action: `denied:${action}`,
    actorId: userId,
    actorEmail: email ?? null,
    success: false,
  });
  throw new Error("관리자 권한이 필요합니다.");
}

async function emailOf(userId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Called by the admin sign-in screen once a session exists. */
export const recordAdminLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mine = await isAdmin(context.userId);
    await writeAudit({
      action: mine ? "admin_login" : "login_non_admin",
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string }).email ?? null,
      detail: { isAdmin: mine },
    });
    return { ok: true };
  });

/** Admin-only: recent admin activity, newest first. */
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string }).email ?? null;
    await assertAdmin(context.userId, "list_audit_logs", email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("id, action, actor_email, target_email, detail, success, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
