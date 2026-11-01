import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_EMAIL, ADMIN_TEMP_PASSWORD, ADMIN_USERNAME, emailToUsername, loginToEmail, normalizeUsername, usernameToEmail } from "@/lib/usernames";

/**
 * Server functions for login limits and user administration.
 * The service-role client is imported inside each handler so it never reaches the browser bundle.
 */

export const MAX_LOGIN_ATTEMPTS = 5;
/** The administrator is never locked out for good: after this long the lock lifts on its own. */
const ADMIN_LOCK_MINUTES = 30;

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

/** Built-in administrators, valid even before the app_admins table exists. */
const BOOTSTRAP_ADMINS = [ADMIN_EMAIL, "tm776968@gmail.com"];

async function isAdminEmail(db: Db, email: string | undefined) {
  if (!email) return false;
  if (BOOTSTRAP_ADMINS.includes(norm(email))) return true;
  const { data } = await db.from("app_admins").select("email").ilike("email", norm(email)).maybeSingle();
  return !!data;
}

async function findUserByEmail(db: Db, email: string) {
  const { data } = await db.from("profiles").select("id").ilike("email", norm(email)).maybeSingle();
  return (data as { id: string } | null) ?? null;
}

/* ---------------- login with attempt limit ---------------- */

export type LoginResult =
  | { ok: true; access_token: string; refresh_token: string; mustChangePassword: boolean }
  | { ok: false; locked: boolean; remaining: number; message: string };

const LOCKED_MSG = "Conta bloqueada após 5 tentativas erradas. Peça ao administrador para desbloquear.";

/**
 * Creates the "Admin" account the first time someone signs in as Admin.
 * Supabase refuses weak passwords such as the temporary 12345678, so the account gets a random
 * password nobody knows; the temporary password is checked here instead (see loginWithLimit)
 * until the administrator chooses a real one.
 */
async function ensureAdminAccount(db: Db): Promise<{ id: string; temporary: boolean }> {
  let found = await findUserByEmail(db, ADMIN_EMAIL);
  if (!found) {
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: `${crypto.randomUUID()}Aa1!`, // 40 characters; Supabase accepts at most 72
      email_confirm: true,
      app_metadata: { created_by_admin: true, must_change_password: true },
      user_metadata: { full_name: "Administrador", username: ADMIN_USERNAME },
    });
    if (error && !/already/i.test(error.message)) throw new Error(ptAuthError(error.message));
    found = data?.user ? { id: data.user.id as string } : await findUserByEmail(db, ADMIN_EMAIL);
  }
  await db.from("app_admins").upsert({ email: ADMIN_EMAIL }, { onConflict: "email" });
  if (!found) throw new Error("Não foi possível preparar a conta Admin. Tente de novo.");
  const { data: u } = await db.auth.admin.getUserById(found.id);
  return { id: found.id, temporary: !!u?.user?.app_metadata?.["must_change_password"] };
}

/** Opens a session for an account without its password (server only, used for the temporary admin password). */
async function sessionFor(db: Db, email: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const auth = await publicAuthClient();
  const { data: v, error: e2 } = await auth.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (e2 || !v.session) throw new Error(e2?.message ?? "Não foi possível abrir a sessão.");
  return v.session as { access_token: string; refresh_token: string };
}

/** Supabase Auth messages in Portuguese. */
function ptAuthError(msg: string) {
  if (/weak|easy to guess|pwned/i.test(msg)) return "Senha muito fraca ou conhecida. Escolha outra, misturando letras, números e símbolos.";
  if (/at least \d+ characters|too short/i.test(msg)) return "A senha é curta demais.";
  return msg;
}

export const loginWithLimit = createServerFn({ method: "POST" })
  .inputValidator((d: { login: string; password: string }) => ({ login: String(d.login ?? ""), password: String(d.password ?? "") }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const email = loginToEmail(data.login);
    if (!email) return { ok: false, locked: false, remaining: MAX_LOGIN_ATTEMPTS, message: "Usuário inválido. Use letras, números, ponto, hífen ou sublinhado." };
    const db = await adminDb();
    const admin = email === ADMIN_EMAIL ? await ensureAdminAccount(db) : null;

    let { data: row } = await db.from("login_attempts").select("*").eq("email", email).maybeSingle();
    if (row?.locked && (await isAdminEmail(db, email))) {
      const since = Date.now() - new Date(row.last_attempt_at).getTime();
      if (since > ADMIN_LOCK_MINUTES * 60000) {
        await db.from("login_attempts").delete().eq("email", email);
        row = null;
      }
    }
    if (row?.locked) return { ok: false, locked: true, remaining: 0, message: LOCKED_MSG };

    // Temporary password of the Admin account, valid only until a real one is chosen.
    if (admin?.temporary && data.password === ADMIN_TEMP_PASSWORD) {
      const session = await sessionFor(db, email);
      await db.from("login_attempts").delete().eq("email", email);
      return { ok: true, access_token: session.access_token, refresh_token: session.refresh_token, mustChangePassword: true };
    }

    const auth = await publicAuthClient();
    const { data: res, error } = await auth.auth.signInWithPassword({ email, password: data.password });
    if (!error && res.session) {
      await db.from("login_attempts").delete().eq("email", email);
      return {
        ok: true,
        access_token: res.session.access_token,
        refresh_token: res.session.refresh_token,
        mustChangePassword: !!res.user?.app_metadata?.["must_change_password"],
      };
    }
    const failed = (row?.failed ?? 0) + 1;
    const locked = failed >= MAX_LOGIN_ATTEMPTS;
    await db.from("login_attempts").upsert({ email, failed, locked, last_attempt_at: new Date().toISOString() }, { onConflict: "email" });
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - failed);
    return {
      ok: false,
      locked,
      remaining,
      message: locked ? LOCKED_MSG : `Usuário ou senha incorretos. Restam ${remaining} tentativa${remaining === 1 ? "" : "s"}.`,
    };
  });

/* ---------------- temporary password ---------------- */

/** Saves the user's new password and clears the "change on next sign-in" flag. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { password: string }) => ({ password: String(d.password ?? "") }))
  .handler(async ({ data, context }) => {
    if (data.password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    if (data.password === ADMIN_TEMP_PASSWORD) throw new Error("Escolha uma senha diferente da senha temporária.");
    const db = await adminDb();
    const { data: u, error: e1 } = await db.auth.admin.getUserById(context.userId);
    if (e1) throw new Error(e1.message);
    const { error } = await db.auth.admin.updateUserById(context.userId, {
      password: data.password,
      app_metadata: { ...(u.user?.app_metadata ?? {}), must_change_password: false },
    });
    if (error) throw new Error(ptAuthError(error.message));
    return { ok: true };
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
  /** Login name, or null for accounts that sign in with an e-mail. */
  username: string | null;
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
    const adminSet = new Set([...BOOTSTRAP_ADMINS, ...((admins ?? []) as { email: string }[]).map((a) => norm(a.email))]);
    const att = new Map(((attempts ?? []) as { email: string; failed: number; locked: boolean }[]).map((a) => [a.email, a]));
    return (data.users as { id: string; email?: string; created_at: string; last_sign_in_at?: string; user_metadata?: Record<string, unknown> }[])
      .map((u) => {
        const email = norm(u.email ?? "");
        const a = att.get(email);
        return {
          id: u.id,
          email,
          username: emailToUsername(email),
          name: (u.user_metadata?.["full_name"] as string | undefined) ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          is_admin: adminSet.has(email),
          locked: !!a?.locked,
          failed: a?.failed ?? 0,
        };
      })
      .sort((x, y) => Number(y.is_admin) - Number(x.is_admin) || (x.username ?? x.email).localeCompare(y.username ?? y.email));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; name: string; password: string; admin: boolean }) => ({
    username: String(d.username ?? ""),
    name: String(d.name ?? "").trim(),
    password: String(d.password ?? ""),
    admin: !!d.admin,
  }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    const username = normalizeUsername(data.username);
    if (!username) throw new Error("Nome de usuário inválido. Use de 2 a 31 letras, números, ponto, hífen ou sublinhado, sem espaços.");
    if (data.password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const email = usernameToEmail(username);
    const { error } = await db.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      app_metadata: { created_by_admin: true },
      user_metadata: { full_name: data.name || username, username },
    });
    if (error) throw new Error(/already/i.test(error.message) ? "Já existe uma conta com este nome de usuário." : ptAuthError(error.message));
    if (data.admin) await db.from("app_admins").upsert({ email }, { onConflict: "email" });
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
    if (error) throw new Error(ptAuthError(error.message));
    await db.from("login_attempts").delete().eq("email", data.email);
    return { ok: true };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; admin: boolean }) => ({ email: norm(String(d.email ?? "")), admin: !!d.admin }))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.claims as Record<string, unknown>);
    if (!data.admin && data.email === norm(String(context.claims["email"] ?? ""))) throw new Error("Você não pode remover seu próprio acesso de administrador.");
    if (!data.admin && data.email === ADMIN_EMAIL) throw new Error("A conta Admin é sempre administradora.");
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
    if (data.email === ADMIN_EMAIL) throw new Error("A conta Admin não pode ser excluída.");
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await Promise.all([db.from("login_attempts").delete().eq("email", data.email), db.from("app_admins").delete().eq("email", data.email)]);
    return { ok: true };
  });
