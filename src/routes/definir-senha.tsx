import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Brand, PageLoading } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { changeOwnPassword } from "@/lib/admin.functions";
import { mustChangePassword, useSession } from "@/lib/auth";
import { errMsg } from "@/lib/manage";
import { accountLabel } from "@/lib/usernames";

export const Route = createFileRoute("/definir-senha")({
  head: () => ({ meta: [{"title": "Definir senha — Placar Pro"}, {"name": "description", "content": "Defina uma nova senha para sua conta no Placar Pro."}, {"property": "og:title", "content": "Definir senha — Placar Pro"}, {"property": "og:description", "content": "Defina uma nova senha para sua conta no Placar Pro."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: DefinirSenha,
});

function DefinirSenha() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const checked = useRef(false);
  const temporary = mustChangePassword(session?.user);

  // The browser may still hold an old token that says the password is temporary.
  // Ask for a fresh one once; if the password was already changed, go straight to the panel.
  useEffect(() => {
    if (loading || !session || !temporary || checked.current) return;
    checked.current = true;
    supabase.auth.refreshSession().then(({ data }) => {
      if (data.session && !mustChangePassword(data.session.user)) navigate({ to: "/painel" });
    });
  }, [loading, session, temporary, navigate]);

  if (loading) return <PageLoading />;
  return (
    <div className="flex min-h-screen flex-col bg-pitch px-4">
      <div className="mx-auto w-full max-w-sm pt-6">
        <Brand />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        <h1 className="text-4xl uppercase">{temporary ? "Crie sua senha" : "Trocar senha"}</h1>
        {!session ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sua sessão expirou.{" "}
            <Link to="/entrar" className="text-primary hover:underline">
              Entre de novo
            </Link>
            .
          </p>
        ) : (
          <form
            className="mt-6 space-y-4 rounded-xl border bg-card p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (p1 !== p2) {
                toast.error("As senhas não conferem.");
                return;
              }
              setBusy(true);
              try {
                await changeOwnPassword({ data: { password: p1 } });
                // Start over with the new password, so the session no longer carries the "temporary" mark.
                await supabase.auth.signOut();
                toast.success("Senha salva! Entre com a nova senha.");
                navigate({ to: "/entrar" });
              } catch (err) {
                toast.error(errMsg(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {temporary && (
              <p className="rounded-lg bg-warning/15 p-3 text-sm text-warning">
                Você entrou com uma senha temporária. Defina uma senha nova para continuar.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Usuário: <b className="text-foreground">{accountLabel(session.user.email, session.user.user_metadata?.["username"])}</b>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="p1">Nova senha</Label>
              <Input id="p1" type="password" minLength={6} required value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2">Repita a senha</Label>
              <Input id="p2" type="password" minLength={6} required value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
            </div>
            <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres misturando letras, números e símbolos. Senhas comuns, como 12345678, são recusadas.</p>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              Salvar senha
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-primary"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/entrar" });
              }}
            >
              Sair e entrar de novo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
