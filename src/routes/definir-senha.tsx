import { useState } from "react";
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
  head: () => ({ meta: [{ title: "Definir senha — Placar Pro" }] }),
  component: DefinirSenha,
});

function DefinirSenha() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <PageLoading />;
  const temporary = mustChangePassword(session?.user);
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
              if (p1 !== p2) return toast.error("As senhas não conferem.");
              setBusy(true);
              try {
                await changeOwnPassword({ data: { password: p1 } });
                // Pick up the cleared flag in a fresh token.
                await supabase.auth.refreshSession();
                toast.success("Senha salva!");
                navigate({ to: "/painel" });
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
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              Salvar senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
