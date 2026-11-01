import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, GitBranch, Radio, Trophy, Tv } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

const FEATURES = [
  { icon: GitBranch, title: "Chaveamento automático", text: "Mata-mata, pontos corridos, grupos ou dupla eliminação, com sorteio e cabeças de chave." },
  { icon: Radio, title: "Placar ao vivo", text: "Súmula no celular e placar atualizado na hora para todo mundo, sem recarregar." },
  { icon: CalendarClock, title: "Próximos jogos", text: "Tabela com horários, locais e contagem regressiva para cada partida." },
  { icon: Tv, title: "Modo telão", text: "Tela cheia alternando placar, próximos jogos e classificação." },
];

function Index() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  return (
    <div className="min-h-screen bg-pitch">
      <AppHeader>
        {session ? (
          <Button asChild size="sm">
            <Link to="/painel">Meus torneios</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/entrar">Entrar</Link>
          </Button>
        )}
      </AppHeader>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:pt-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="live-dot" /> Torneios em tempo real
          </span>
          <h1 className="mt-4 text-5xl font-extrabold uppercase leading-[0.95] sm:text-7xl">
            Organize. Jogue. <span className="text-primary">Acompanhe ao vivo.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Crie seu torneio, gere a tabela em segundos e compartilhe o link. Participantes e torcida acompanham placar,
            chaveamento e estatísticas sem precisar de login.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to={session ? "/painel" : "/entrar"}>
                <Trophy /> {session ? "Ir para meus torneios" : "Entrar como organizador"}
              </Link>
            </Button>
          </div>
          <form
            className="mt-8 flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const slug = code.trim().replace(/^.*\/t\//, "").replace(/\/$/, "");
              if (slug) navigate({ to: "/t/$slug", params: { slug } });
            }}
          >
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tem um link? Cole aqui o código do torneio" />
            <Button type="submit" variant="secondary">
              Abrir
            </Button>
          </form>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card/80 p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-xl">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
