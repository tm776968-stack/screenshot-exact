import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { adminSetupStatus, loginWithLimit, sendAdminSetupLink } from "@/lib/admin.functions";
import { useSession } from "@/lib/auth";
import { errMsg } from "@/lib/manage";

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [{ title: "Entrar — Placar Pro" }] }),
  component: Entrar,
});

function Entrar() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; locked: boolean } | null>(null);
  const setup = useQuery({ queryKey: ["admin-setup"], queryFn: () => adminSetupStatus() });
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/painel" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await loginWithLimit({ data: { email, password } });
      if (r.ok) {
        const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
        if (error) throw error;
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
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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
          Não tem conta? Só o administrador do sistema pode cadastrar novos usuários. Peça a ele o seu acesso.
        </p>
        {setup.data?.needsSetup && (
          <div className="mt-4">
            {setupOpen ? (
              <AdminSetup />
            ) : (
              <button type="button" onClick={() => setSetupOpen(true)} className="text-sm text-primary hover:underline">
                Primeiro acesso do administrador
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminSetup() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <p className="rounded-lg border bg-card p-3 text-sm">
        Pronto! Abra o e-mail do administrador e clique no link para definir a senha.
      </p>
    );
  return (
    <form
      className="space-y-2 rounded-xl border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await sendAdminSetupLink({ data: { email, redirectTo: `${window.location.origin}/definir-senha` } });
          if (r.ok) setSent(true);
          else toast.error(r.message);
        } catch (err) {
          toast.error(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="admin-email">E-mail do administrador</Label>
      <Input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
        Enviar link para definir a senha
      </Button>
    </form>
  );
}
