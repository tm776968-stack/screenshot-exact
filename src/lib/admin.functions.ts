import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server functions for login limits and user administration.
 * The service-role client is imported inside each handler so it never reaches the browser bundle.
 */

export const MAX_LOGIN_ATTEMPTS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function publicAuthClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const norm = (e: string) => e.trim().toLowerCase();

async function isAdminEmail(db: Db, email: string | undefined) {
  if (!email) return false;
  const { data } = await db.from("app_admins").select("email").ilike("email", norm(email)).maybeSingle();
  return !!data;
}

async function findUserByEmail(db: Db, email: string) {
  const { data } = await db.from("profiles").select("id").ilike("email", norm(email)).maybeSingle();
  return (data as { id: string } | null) ?? null;
}

/* ---------------- login with attempt limit ---------------- */

export type LoginResult =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; locked: boolean; remaining: number; message: string };

export const loginWithLimit = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => ({ email: norm(String(d.email ?? "")), password: String(d.password ?? "") }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const db = await adminDb();
    const { data: row } = await db.from("login_attempts").select("*").eq("email", data.email).maybeSingle();
    if (row?.locked) {
      return {
        ok: false,
        locked: true,
        remaining: 0,
        message: "Conta bloqueada após 5 tentativas erradas. Peça ao administrador para desbloquear.",
      };
    }
    const auth = await publicAuthClient();
    const { data: res, error } = await auth.auth.signInWithPassword({ email: data.email, password: data.password });
    if (!error && res.session) {
      await db.from("login_attempts").delete().eq("email", data.email);
      return { ok: true, access_token: res.session.access_token, refresh_token: res.session.refresh_token };
    }
    const failed = (row?.failed ?? 0) + 1;
    const locked = failed >= MAX_LOGIN_ATTEMPTS;
    await db
      .from("login_attempts")
      .upsert({ email: data.email, failed, locked, last_attempt_at: new Date().toISOString() }, { onConflict: "email" });
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - failed);
    return {
      ok: false,
      locked,
      remaining,
      message: locked
        ? "Conta bloqueada após 5 tentativas erradas. Peça ao administrador para desbloquear."
        : `E-mail ou senha incorretos. Restam ${remaining} tentativa${remaining === 1 ? "" : "s"}.`,
    };
  });

/* ---------------- first access of the administrator ---------------- */

/** True when an administrator e-mail still has no account. */
export const adminSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const db = await adminDb();
  const { data } = await db.from("app_admins").select("email");
  for (const a of (data ?? []) as { email: string }[]) {
    if (!(await findUserByEmail(db, a.email))) return { needsSetup: true };
  }
  return { needsSetup: false };
});

/**
 * Creates the administrator account (if it doesn't exist yet) and e-mails a link to set the password.
 * Only works for e-mails listed in app_admins, so it can only ever send mail to the administrator.
 */
export const sendAdminSetupLink = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; redirectTo: string }) => ({ email: norm(String(d.email ?? "")), redirectTo: String(d.redirectTo ?? "") }))
  .handler(async ({ data }) => {
    const db = await adminDb();
    if (!(await isAdminEmail(db, data.email))) return { ok: false, message: "Este e-mail não é de um administrador." };
    if (!(await findUserByEmail(db, data.email))) {
      const tmp = crypto.randomUUID() + crypto.randomUUID();
      const { error } = await db.auth.admin.createUser({
        email: data.email,
        password: tmp,
        email_confirm: true,
        app_metadata: { created_by_admin: true },
        user_metadata: { full_name: "Administrador" },
      });
      if (error) return { ok: false, message: error.message };
    }
    const auth = await publicAuthClient();
    const { error } = await auth.auth.resetPasswordForEmail(data.email, { redirectTo: data.redirectTo });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Enviamos um link para o e-mail do administrador definir a senha." };
  });

/* ---------------- user administration (admin only) ---------------- */

async function requireAdmin(claims: Record<string, unknown>) {
  const db = await adminDb();
  if (!(await isAdminEmail(db, claims["email"] as string | undefined))) throw new Error("Apenas o administrador pode fazer isso.");
  return db;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  locked: boolean;
  failed: number;
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    return { admin: await isAdminEmail(db, context.claims["email"] as string | undefined) };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const [{ data: admins }, { data: attempts }] = await Promise.all([db.from("app_admins").select("email"), db.from("login_attempts").select("*")]);
    const adminSet = new Set(((admins ?? []) as { email: string }[]).map((a) => norm(a.email)));
    const att = new Map(((attempts ?? []) as { email: string; failed: number; locked: boolean }[]).map((a) => [a.email, a]));
    return (data.users as { id: string; email?: string; created_at: string; last_sign_in_at?: string; user_metadata?: Record<string, unknown> }[])
      .map((u) => {
        const email = norm(u.email ?? "");
        const a = att.get(email);
        return {
          id: u.id,
          email,
          name: (u.user_metadata?.["full_name"] as string | undefined) ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          is_admin: adminSet.has(email),
          locked: !!a?.locked,
          failed: a?.failed ?? 0,
        };
      })
      .sort((x, y) => Number(y.is_admin) - Number(x.is_admin) || x.email.localeCompare(y.email));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; name: string; password: string; admin: boolean }) => ({
    email: norm(String(d.email ?? "")),
    name: String(d.name ?? "").trim(),
    password: String(d.password ?? ""),
    admin: !!d.admin,
  }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    if (!data.email.includes("@")) throw new Error("Informe um e-mail válido.");
    if (data.password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const { error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      app_metadata: { created_by_admin: true },
      user_metadata: { full_name: data.name || data.email.split("@")[0] },
    });
    if (error) throw new Error(/already/i.test(error.message) ? "Já existe uma conta com este e-mail." : error.message);
    if (data.admin) await db.from("app_admins").upsert({ email: data.email }, { onConflict: "email" });
    return { ok: true };
  });

export const unlockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => ({ email: norm(String(d.email ?? "")) }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    await db.from("login_attempts").delete().eq("email", data.email);
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; email: string; password: string }) => ({
    id: String(d.id ?? ""),
    email: norm(String(d.email ?? "")),
    password: String(d.password ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    if (data.password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const { error } = await db.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);
    await db.from("login_attempts").delete().eq("email", data.email);
    return { ok: true };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; admin: boolean }) => ({ email: norm(String(d.email ?? "")), admin: !!d.admin }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    if (!data.admin && data.email === norm(String(context.claims["email"] ?? ""))) throw new Error("Você não pode remover seu próprio acesso de administrador.");
    if (data.admin) await db.from("app_admins").upsert({ email: data.email }, { onConflict: "email" });
    else await db.from("app_admins").delete().eq("email", data.email);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; email: string }) => ({ id: String(d.id ?? ""), email: norm(String(d.email ?? "")) }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    if (data.id === context.userId) throw new Error("Você não pode excluir a própria conta.");
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await Promise.all([db.from("login_attempts").delete().eq("email", data.email), db.from("app_admins").delete().eq("email", data.email)]);
    return { ok: true };
  });
