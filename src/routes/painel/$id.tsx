import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronLeft, ExternalLink } from "lucide-react";
import { AppHeader, PageLoading } from "@/components/app-header";
import { StepChave } from "@/components/manage/step-chave";
import { StepDados } from "@/components/manage/step-dados";
import { StepEquipes } from "@/components/manage/step-equipes";
import { StepFormato } from "@/components/manage/step-formato";
import { StepJogos } from "@/components/manage/step-jogos";
import { StepPublicar } from "@/components/manage/step-publicar";
import { LiveBadge } from "@/components/sport";
import { Empty } from "@/components/views";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/lib/auth";
import { bundleById, useTournamentRealtime } from "@/lib/data";
import { STATUS_LABEL } from "@/lib/tournament";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "dados", label: "Dados" },
  { key: "equipes", label: "Equipes" },
  { key: "formato", label: "Formato e regras" },
  { key: "chave", label: "Chaveamento" },
  { key: "jogos", label: "Jogos" },
  { key: "publicar", label: "Publicar" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export const Route = createFileRoute("/painel/$id")({
  validateSearch: (s: Record<string, unknown>): { etapa?: StepKey } => {
    const v = s["etapa"];
    return STEPS.some((x) => x.key === v) ? { etapa: v as StepKey } : {};
  },
  head: () => ({ meta: [{ title: "Gerenciar torneio — Placar Pro" }] }),
  component: Manage,
});

function Manage() {
  const { id } = Route.useParams();
  const etapa: StepKey = Route.useSearch().etapa ?? "dados";
  const { user, loading } = useRequireAuth();
  const q = useQuery({ ...bundleById(id), enabled: !!user });
  useTournamentRealtime(q.data?.tournament.id);

  if (loading || !user || q.isLoading) return <PageLoading />;
  const b = q.data;
  if (!b)
    return (
      <div className="min-h-screen">
        <AppHeader email={user.email} />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Empty>Torneio não encontrado ou você não tem acesso a ele.</Empty>
        </main>
      </div>
    );

  const t = b.tournament;
  const idx = STEPS.findIndex((s) => s.key === etapa);
  const prev = STEPS[idx - 1];
  const next = STEPS[idx + 1];
  const liveCount = b.matches.filter((m) => m.status === "ao_vivo" || m.status === "intervalo").length;

  return (
    <div className="min-h-screen pb-24">
      <AppHeader email={user.email} />
      <div className="border-b bg-card/50">
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <Link to="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ChevronLeft className="h-4 w-4" /> Meus torneios
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-3xl uppercase sm:text-4xl">{t.name}</h1>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{STATUS_LABEL[t.status]}</span>
            {liveCount > 0 && <LiveBadge />}
            <Button asChild size="sm" variant="ghost" className="ml-auto">
              <Link to="/t/$slug" params={{ slug: t.slug }}>
                <ExternalLink /> Página pública
              </Link>
            </Button>
          </div>
          <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-3">
            {STEPS.map((s, i) => (
              <Link
                key={s.key}
                to="/painel/$id"
                params={{ id }}
                search={{ etapa: s.key }}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                  s.key === etapa ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                )}
              >
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold", s.key === etapa ? "bg-primary-foreground/20" : "bg-secondary")}>
                  {i + 1}
                </span>
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {etapa === "dados" && <StepDados key={t.id} b={b} />}
        {etapa === "equipes" && <StepEquipes b={b} />}
        {etapa === "formato" && <StepFormato b={b} />}
        {etapa === "chave" && <StepChave b={b} />}
        {etapa === "jogos" && <StepJogos b={b} />}
        {etapa === "publicar" && <StepPublicar b={b} isOwner={t.owner_id === user.id} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          {prev ? (
            <Button asChild variant="ghost">
              <Link to="/painel/$id" params={{ id }} search={{ etapa: prev.key }}>
                <ArrowLeft /> {prev.label}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button asChild variant="secondary">
              <Link to="/painel/$id" params={{ id }} search={{ etapa: next.key }}>
                {next.label} <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
