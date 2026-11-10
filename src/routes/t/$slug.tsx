import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Settings2, Tv } from "lucide-react";
import { Brand, PageLoading } from "@/components/app-header";
import {
  BracketTab,
  liveNow,
  MatchList,
  results,
  RulesTab,
  StandingsView,
  StatsView,
  TeamFilter,
  TeamsTab,
  TournamentHero,
  upcoming,
  useMatchDialog,
} from "@/components/public-view";
import { LiveBadge } from "@/components/sport";
import { Empty } from "@/components/views";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { bundleById, bundleBySlug, type Bundle } from "@/lib/data";
import { useLiveChannel, useLivePolling } from "@/lib/live";
import { themeVars } from "@/lib/images";
import { divisionLabel } from "@/lib/tournament";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "ao-vivo", label: "Ao vivo" },
  { key: "proximos", label: "Próximos jogos" },
  { key: "chaveamento", label: "Chaveamento" },
  { key: "classificacao", label: "Classificação" },
  { key: "estatisticas", label: "Estatísticas" },
  { key: "equipes", label: "Equipes" },
  { key: "regulamento", label: "Regulamento" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export const Route = createFileRoute("/t/$slug")({
  validateSearch: (s: Record<string, unknown>): { aba?: TabKey; categoria?: string } => {
    const v = s["aba"];
    const c = s["categoria"];
    return {
      ...(TABS.some((x) => x.key === v) ? { aba: v as TabKey } : {}),
      ...(typeof c === "string" && c ? { categoria: c } : {}),
    };
  },
  head: () => ({ meta: [{"title": "Torneio ao vivo — Placar Pro"}, {"name": "description", "content": "Acompanhe placares, próximos jogos e resultados do torneio de vôlei."}, {"property": "og:title", "content": "Torneio ao vivo — Placar Pro"}, {"property": "og:description", "content": "Acompanhe placares, próximos jogos e resultados do torneio de vôlei."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: PublicPage,
});

/** Category shown: the one in the link, the category the slug points to, or the first one. */
function pickDivision(base: Bundle, wanted: string | undefined) {
  if (wanted && base.divisions.some((d) => d.id === wanted)) return wanted;
  if (base.tournament.parent_id) return base.tournament.id;
  return base.divisions[0]?.id ?? base.tournament.id;
}

function PublicPage() {
  const { slug } = Route.useParams();
  const { categoria } = Route.useSearch();
  const q = useQuery(bundleBySlug(slug));
  const selected = q.data ? pickDivision(q.data, categoria) : null;
  const other = !!q.data && !!selected && selected !== q.data.tournament.id;
  const dq = useQuery({ ...bundleById(selected ?? ""), enabled: other });
  const b = other ? dq.data : q.data;
  if (q.isLoading || (other && dq.isLoading)) return <PageLoading />;
  if (!q.data || !b)
    return (
      <div className="min-h-screen">
        <header className="mx-auto max-w-5xl px-4 py-4">
          <Brand />
        </header>
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Empty>Torneio não encontrado ou ainda não publicado pela organização.</Empty>
        </main>
      </div>
    );
  return <PublicTournament key={b.tournament.id} b={b} />;
}

function PublicTournament({ b }: { b: Bundle }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useSession();
  const live = liveNow(b);
  const tab: TabKey = search.aba ?? (live.length ? "ao-vivo" : "proximos");
  const storageKey = `placar-team-${b.tournament.id}`;
  const [team, setTeamState] = useState<string | null>(null);
  const [teamPage, setTeamPage] = useState<string | null>(null);
  const { open, dialog } = useMatchDialog(b);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v && b.teams.some((t) => t.id === v)) setTeamState(v);
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const setTeam = (v: string | null) => {
    setTeamState(v);
    try {
      if (v) localStorage.setItem(storageKey, v);
      else localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable */
    }
  };

  const canEdit = !!user && (user.id === b.root.owner_id || user.id === b.tournament.owner_id);
  // Co-organizers also count as organizers (checked once in the database, then cached).
  const memberQ = useQuery({
    queryKey: ["can-edit", b.tournament.id, user?.id],
    enabled: !!user && !canEdit,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_edit_tournament", { _tid: b.tournament.id });
      return !error && !!data;
    },
  });
  const isOrganizer = canEdit || !!memberQ.data;
  // Hybrid live strategy: organizers keep a WebSocket; everyone else gets a light refresh every
  // 12 s, and only on the games tabs (the other tabs show data that doesn't change mid-game).
  const gamesTab = tab === "ao-vivo" || tab === "proximos";
  useLiveChannel([b.tournament.id], isOrganizer);
  useLivePolling([b.tournament.id], { enabled: !isOrganizer && gamesTab, intervalMs: 12_000 });
  const noDivisions = !b.tournament.parent_id && b.divisions.length === 0;
  const showFilter = tab === "ao-vivo" || tab === "proximos" || tab === "chaveamento";

  return (
    <div className="min-h-screen pb-12" style={themeVars(b.root.primary_color)}>
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
          <Brand />
          <div className="flex gap-1">
            {canEdit && (
              <Button asChild size="sm" variant="ghost">
                <Link to="/painel/$id" params={{ id: b.tournament.id }}>
                  <Settings2 /> <span className="hidden sm:inline">Gerenciar</span>
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="ghost">
              <Link to="/tv/$slug" params={{ slug: b.root.slug }}>
                <Tv /> <span className="hidden sm:inline">Modo TV</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>
      {!b.root.published && (
        <div className="bg-warning/15 px-4 py-2 text-center text-xs text-warning">
          Prévia: este torneio ainda não foi publicado e só a organização consegue vê-lo.
        </div>
      )}
      <TournamentHero b={b} />

      {b.divisions.length > 1 && (
        <div className="border-b bg-card/40">
          <div className="mx-auto flex max-w-5xl gap-1.5 overflow-x-auto px-4 py-2">
            {b.divisions.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate({ search: (prev) => ({ ...prev, categoria: d.id }), replace: true })}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                  d.id === b.tournament.id ? "border-primary bg-primary/15 text-primary" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {divisionLabel(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => navigate({ search: (prev) => ({ ...prev, aba: t.key }), replace: true })}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition",
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.key === "ao-vivo" && live.length > 0 && <span className="live-dot" />}
              {t.label}
              {t.key === "ao-vivo" && live.length > 0 && <span className="text-xs opacity-80">({live.length})</span>}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        {noDivisions && <Empty>A organização ainda não cadastrou as categorias deste torneio.</Empty>}
        {showFilter && b.teams.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Acompanhar equipe</div>
            <TeamFilter b={b} value={team} onChange={setTeam} />
          </div>
        )}

        {tab === "ao-vivo" && (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-2xl uppercase">
                Ao vivo agora {live.length > 0 && <LiveBadge />}
              </h2>
              <MatchList b={b} matches={liveNow(b, team)} team={team} onOpen={open} empty="Nenhum jogo em andamento neste momento." />
            </section>
            <section>
              <h2 className="mb-3 text-2xl uppercase">Resultados</h2>
              <MatchList b={b} matches={results(b, team).slice(0, 6)} team={team} onOpen={open} empty="Nenhum jogo encerrado ainda." />
            </section>
          </div>
        )}
        {tab === "proximos" && (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-2xl uppercase">Próximos jogos</h2>
              <MatchList b={b} matches={upcoming(b, team)} team={team} onOpen={open} countdown empty="Nenhum jogo agendado." />
            </section>
            <section>
              <h2 className="mb-3 text-2xl uppercase">Resultados</h2>
              <MatchList b={b} matches={results(b, team)} team={team} onOpen={open} empty="Nenhum jogo encerrado ainda." />
            </section>
          </div>
        )}
        {tab === "chaveamento" && <BracketTab b={b} team={team} />}
        {tab === "classificacao" &&
          (b.tournament.format === "mata_mata" || b.tournament.format === "dupla_eliminacao" ? (
            <Empty>Este torneio é eliminatório. Veja a aba Chaveamento.</Empty>
          ) : (
            <StandingsView b={b} />
          ))}
        {tab === "estatisticas" && (
          <StatsView
            b={b}
            onTeam={(id) => {
              setTeamPage(id);
              navigate({ search: (prev) => ({ ...prev, aba: "equipes" }), replace: true });
            }}
          />
        )}
        {tab === "equipes" && <TeamsTab b={b} selected={teamPage} onSelect={setTeamPage} />}
        {tab === "regulamento" && <RulesTab b={b} />}
      </main>
      {dialog}
    </div>
  );
}
