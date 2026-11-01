import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loginWithLimit } from "@/lib/admin.functions";
import { mustChangePassword, useSession } from "@/lib/auth";
import { errMsg } from "@/lib/manage";

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [{ title: "Entrar — Placar Pro" }] }),
  component: Entrar,
});

function Entrar() {
  const { session, user } = useSession();
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; locked: boolean } | null>(null);

  useEffect(() => {
    if (session) navigate({ to: mustChangePassword(user) ? "/definir-senha" : "/painel" });
  }, [session, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await loginWithLimit({ data: { login, password } });
      if (r.ok) {
        const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
        if (error) throw error;
        if (r.mustChangePassword) navigate({ to: "/definir-senha" });
      } else {
        setNotice({ text: r.message, locked: r.locked });
        setPassword("");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-pitch px-4">
      <div className="mx-auto w-full max-w-sm pt-6">
        <Brand />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        <h1 className="text-4xl uppercase">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Área do organizador. Quem só acompanha o torneio não precisa de conta.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="login">Nome de usuário</Label>
            <Input
              id="login"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {notice && (
            <p className={notice.locked ? "flex gap-2 rounded-lg bg-destructive/15 p-3 text-sm text-destructive" : "text-sm text-warning"}>
              {notice.locked && <Lock className="mt-0.5 h-4 w-4 shrink-0" />}
              {notice.text}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Aguarde..." : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Não tem conta ou esqueceu a senha? Só o administrador do sistema cadastra usuários e define novas senhas. Fale com ele.
        </p>
      </div>
    </div>
  );
}
