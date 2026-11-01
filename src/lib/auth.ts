import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Current Supabase session (client side only; null while loading on the server). */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { session, user: session?.user ?? null, loading };
}

/** True while the account still uses a temporary password that must be replaced. */
export function mustChangePassword(user: Session["user"] | null | undefined) {
  return !!user?.app_metadata?.["must_change_password"];
}

/** Redirects to /entrar when there is no logged-in organizer, and to /definir-senha while the password is temporary. */
export function useRequireAuth() {
  const s = useSession();
  const navigate = useNavigate();
  const mustChange = mustChangePassword(s.user);
  useEffect(() => {
    if (s.loading) return;
    if (!s.session) navigate({ to: "/entrar" });
    else if (mustChange) navigate({ to: "/definir-senha" });
  }, [s.loading, s.session, mustChange, navigate]);
  return mustChange ? { ...s, user: null, loading: true } : s;
}

export async function signOut() {
  await supabase.auth.signOut();
}
