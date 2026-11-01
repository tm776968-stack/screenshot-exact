/**
 * Logins are user names ("Admin", "joao.silva"). Supabase Auth only knows e-mails, so each
 * user name is stored as a plus-address of the system owner's mailbox. Any message the
 * auth service might send to such an address lands in the owner's own inbox.
 */
const MAILBOX = { local: "tm776968", domain: "gmail.com" };
const PREFIX = "u-";

export const ADMIN_USERNAME = "Admin";
export const ADMIN_TEMP_PASSWORD = "12345678";

/** Lowercase user name, or null when it has characters an e-mail address can't carry. */
export function normalizeUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(u)) return null;
  return u;
}

export function usernameToEmail(username: string): string {
  return `${MAILBOX.local}+${PREFIX}${username.trim().toLowerCase()}@${MAILBOX.domain}`;
}

/** Accepts a user name or a real e-mail and returns the e-mail Supabase Auth knows. */
export function loginToEmail(login: string): string | null {
  const v = login.trim().toLowerCase();
  if (v.includes("@")) return v;
  const u = normalizeUsername(v);
  return u ? usernameToEmail(u) : null;
}

/** User name behind a generated address, or null for a real e-mail. */
export function emailToUsername(email: string | null | undefined): string | null {
  if (!email) return null;
  const m = email.toLowerCase().match(new RegExp(`^${MAILBOX.local}\\+${PREFIX}([a-z0-9._-]+)@${MAILBOX.domain.replace(".", "\\.")}$`));
  return m ? m[1]! : null;
}

/** What to show for an account: the user name when there is one, otherwise the e-mail. */
export function accountLabel(email: string | null | undefined, username?: unknown): string {
  if (typeof username === "string" && username) return username;
  return emailToUsername(email) ?? email ?? "";
}

export const ADMIN_EMAIL = usernameToEmail(ADMIN_USERNAME);
