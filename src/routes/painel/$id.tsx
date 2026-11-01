import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronLeft, ExternalLink } from "lucide-react";
import { AppHeader, PageLoading } from "@/components/app-header";
import { StepCategorias } from "@/components/manage/step-categorias";
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
import { divisionLabel, readSettings, STATUS_LABEL, teamSizeLabel } from "@/lib/tournament";
import { cn } from "@/lib/utils";

/** Steps of the main tournament. */
const ROOT_STEPS = [
  { key: "dados", label: "Dados" },
  { key: "categorias", label: "Categorias e naipes" },
  { key: "publicar", label: "Publicar" },
] as const;
/** Steps of one category. */
const DIVISION_STEPS = [
  { key: "equipes", label: "Equipes" },
  { key: "formato", label: "Formato e regras" },
  { key: "chave", label: "Chaveamento" },
  { key: "jogos", label: "Jogos" },
] as const;
type StepKey = (typeof ROOT_STEPS)[number]["key"] | (typeof DIVISION_STEPS)[number]["key"];
const ALL_KEYS: string[] = [...ROOT_STEPS, ...DIVISION_STEPS].map((s) => s.key);

export const Route = createFileRoute("/painel/$id")({
  validateSearch: (s: Record<string, unknown>): { etapa?: StepKey } => {
    const v = s["etapa"];
    return typeof v === "string" && ALL_KEYS.includes(v) ? { etapa: v as StepKey } : {};
  },
  head: () => ({ meta: [{"title": "Gerenciar torneio — Placar Pro"}, {"name": "description", "content": "Gerencie equipes, partidas e a publicação do seu torneio de vôlei."}, {"property": "og:title", "content": "Gerenciar torneio — Placar Pro"}, {"property": "og:description", "content": "Gerencie equipes, partidas e a publicação do seu torneio de vôlei."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: Manage,
});

function Manage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
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
  const root = b.root;
  const isDivision = !!t.parent_id;
  const steps: readonly { key: StepKey; label: string }[] = isDivision ? DIVISION_STEPS : ROOT_STEPS;
  const etapa: StepKey = steps.some((s) => s.key === search.etapa) ? search.etapa! : steps[0]!.key;
  const idx = steps.findIndex((s) => s.key === etapa);
  const prev = steps[idx - 1];
  const next = steps[idx + 1];
  const liveCount = b.matches.filter((m) => m.status === "ao_vivo" || m.status === "intervalo").length;
  const s = readSettings(t.settings);

  return (
    <div className="min-h-screen pb-24">
      <AppHeader email={user.email} />
      <div className="border-b bg-card/50">
        <div className="mx-auto max-w-5xl px-4 pt-4">
          {isDivision ? (
            <Link to="/painel/$id" params={{ id: root.id }} search={{ etapa: "categorias" }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ChevronLeft className="h-4 w-4" /> {root.name}
            </Link>
          ) : (
            <Link to="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ChevronLeft className="h-4 w-4" /> Meus torneios
            </Link>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-3xl uppercase sm:text-4xl">{isDivision ? divisionLabel(t) : root.name}</h1>
            {isDivision ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{teamSizeLabel(s.teamSize)}</span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{STATUS_LABEL[t.status]}</span>
            )}
            {liveCount > 0 && <LiveBadge />}
            <Button asChild size="sm" variant="ghost" className="ml-auto">
              <Link to="/t/$slug" params={{ slug: root.slug }} search={isDivision ? { categoria: t.id } : {}}>
                <ExternalLink /> Página pública
              </Link>
            </Button>
          </div>
          {isDivision && b.divisions.length > 1 && (
            <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
              {b.divisions.map((d) => (
                <Link
                  key={d.id}
                  to="/painel/$id"
                  params={{ id: d.id }}
                  search={{ etapa }}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs",
                    d.id === t.id ? "border-primary text-primary" : "text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {divisionLabel(d)}
                </Link>
              ))}
            </div>
          )}
          <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-3">
            {steps.map((st, i) => (
              <Link
                key={st.key}
                to="/painel/$id"
                params={{ id }}
                search={{ etapa: st.key }}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                  st.key === etapa ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                )}
              >
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold", st.key === etapa ? "bg-primary-foreground/20" : "bg-secondary")}>
                  {i + 1}
                </span>
                {st.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {etapa === "dados" && <StepDados key={t.id} b={b} />}
        {etapa === "categorias" && <StepCategorias b={b} />}
        {etapa === "publicar" && <StepPublicar b={b} isOwner={t.owner_id === user.id} />}
        {etapa === "equipes" && <StepEquipes b={b} />}
        {etapa === "formato" && <StepFormato b={b} />}
        {etapa === "chave" && <StepChave b={b} />}
        {etapa === "jogos" && <StepJogos b={b} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          {prev ? (
            <Button asChild variant="ghost">
              <Link to="/painel/$id" params={{ id }} search={{ etapa: prev.key }}>
                <ArrowLeft /> {prev.label}
              </Link>
            </Button>
          ) : isDivision ? (
            <Button asChild variant="ghost">
              <Link to="/painel/$id" params={{ id: root.id }} search={{ etapa: "categorias" }}>
                <ArrowLeft /> Categorias
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild variant="secondary">
              <Link to="/painel/$id" params={{ id }} search={{ etapa: next.key }}>
                {next.label} <ArrowRight />
              </Link>
            </Button>
          ) : isDivision ? (
            <Button asChild variant="secondary">
              <Link to="/painel/$id" params={{ id: root.id }} search={{ etapa: "publicar" }}>
                Publicar torneio <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
