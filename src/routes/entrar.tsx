import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Brand } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { errMsg } from "@/lib/manage";

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [{ title: "Entrar — Placar Pro" }] }),
  component: Entrar,
});

function translate(msg: string) {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Use a opção Entrar.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/at least 6/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}

function Entrar() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/painel" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/painel` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Conta criada! Enviamos um link de confirmação para o seu e-mail.");
          setMode("login");
        }
      }
    } catch (err) {
      toast.error(translate(errMsg(err)));
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
        <h1 className="text-4xl uppercase">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Área do organizador. Quem só acompanha o torneio não precisa de conta.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border bg-card p-5">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 text-sm text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
        <p className="mt-6 text-xs text-muted-foreground">
          Foi convidado como co-organizador? Crie a conta com o mesmo e-mail do convite e o torneio aparece no seu painel.
        </p>
      </div>
    </div>
  );
}
