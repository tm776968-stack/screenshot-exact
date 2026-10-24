import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Brand, PageLoading } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { errMsg } from "@/lib/manage";

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
  return (
    <div className="flex min-h-screen flex-col bg-pitch px-4">
      <div className="mx-auto w-full max-w-sm pt-6">
        <Brand />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        <h1 className="text-4xl uppercase">Definir senha</h1>
        {!session ? (
          <p className="mt-3 text-sm text-muted-foreground">
            O link expirou ou já foi usado. Volte para{" "}
            <Link to="/entrar" className="text-primary hover:underline">
              Entrar
            </Link>{" "}
            e peça um novo.
          </p>
        ) : (
          <form
            className="mt-6 space-y-4 rounded-xl border bg-card p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (p1 !== p2) return toast.error("As senhas não conferem.");
              setBusy(true);
              try {
                const { error } = await supabase.auth.updateUser({ password: p1 });
                if (error) throw error;
                toast.success("Senha definida!");
                navigate({ to: "/painel" });
              } catch (err) {
                toast.error(errMsg(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">Conta: {session.user.email}</p>
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
