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

/** Redirects to /entrar when there is no logged-in organizer. */
export function useRequireAuth() {
  const s = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (!s.loading && !s.session) navigate({ to: "/entrar" });
  }, [s.loading, s.session, navigate]);
  return s;
}

export async function signOut() {
  await supabase.auth.signOut();
}
