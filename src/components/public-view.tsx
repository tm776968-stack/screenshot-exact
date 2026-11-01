import { useState } from "react";
import { CalendarDays, MapPin, Timer } from "lucide-react";
import { Countdown, LiveBadge, MatchCard, MatchClock, TeamCrest } from "@/components/sport";
import { Bracket, Empty, StandingsView, StatsView, TeamDetail, Timeline } from "@/components/views";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Bundle, Match, Team } from "@/lib/data";
import { teamMap } from "@/lib/data";
import { fmtDate, fmtDateTime, FORMATS, MATCH_STATUS_LABEL, readSettings, SPORTS, STAGE_LABEL, STATUS_LABEL, standings } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export const isLive = (m: Match) => m.status === "ao_vivo" || m.status === "intervalo";
export const isDone = (m: Match) => m.status === "encerrado" || m.status === "wo";
const hasTeams = (m: Match) => !!m.home_team_id && !!m.away_team_id;
const involves = (m: Match, team: string | null) => !team || m.home_team_id === team || m.away_team_id === team;

export function upcoming(b: Bundle, team: string | null = null) {
  return b.matches
    .filter((m) => (m.status === "agendado" || m.status === "adiado") && (m.home_team_id || m.away_team_id) && involves(m, team))
    .sort((x, y) => (x.scheduled_at ?? "9999").localeCompare(y.scheduled_at ?? "9999") || x.round - y.round);
}
export function results(b: Bundle, team: string | null = null) {
  return b.matches
    .filter((m) => isDone(m) && hasTeams(m) && involves(m, team))
    .sort((x, y) => (y.scheduled_at ?? "").localeCompare(x.scheduled_at ?? "") || y.round - x.round);
}
export function liveNow(b: Bundle, team: string | null = null) {
  return b.matches.filter((m) => isLive(m) && involves(m, team));
}

export function TournamentHero({ b }: { b: Bundle }) {
  const t = b.tournament;
  const sport = SPORTS.find((s) => s.value === t.sport)?.label ?? t.sport;
  const format = FORMATS.find((f) => f.value === t.format)?.label;
  return (
    <div className="relative overflow-hidden border-b bg-pitch">
      {t.banner_url && <img src={t.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="relative mx-auto flex max-w-5xl items-center gap-4 px-4 py-6">
        {t.logo_url ? (
          <img src={t.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-glow sm:h-20 sm:w-20" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-2xl text-primary-foreground sm:h-20 sm:w-20">
            {t.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl uppercase leading-none sm:text-5xl">{t.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">{STATUS_LABEL[t.status]}</span>
            <span>
              {sport}
              {format && ` · ${format}`}
            </span>
            {(t.start_date || t.end_date) && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(t.start_date)}
                {t.end_date && t.end_date !== t.start_date && ` a ${fmtDate(t.end_date)}`}
              </span>
            )}
            {t.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {t.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Opens a match with its event timeline. */
export function useMatchDialog(b: Bundle) {
  const [id, setId] = useState<string | null>(null);
  const m = id ? b.matches.find((x) => x.id === id) : null;
  const teams = teamMap(b.teams);
  const dialog = m ? (
    <Dialog open onOpenChange={(v) => !v && setId(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-sm uppercase text-muted-foreground">
            {m.stage === "grupo" ? `Grupo ${m.group_name}` : m.stage === "liga" ? `Rodada ${m.round}` : STAGE_LABEL[m.stage]}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <DialogSide team={m.home_team_id ? teams.get(m.home_team_id) : null} />
          <div>
            <div className="scoreboard text-5xl">{isLive(m) || isDone(m) ? `${m.home_score}:${m.away_score}` : "vs"}</div>
            {m.home_pens != null && (
              <div className="text-xs text-muted-foreground">
                Pênaltis {m.home_pens} x {m.away_pens}
              </div>
            )}
            <div className="mt-1 text-xs">
              {isLive(m) ? (
                <span className="inline-flex items-center gap-2">
                  <LiveBadge /> {m.status === "intervalo" ? "Intervalo" : <MatchClock match={m} />}
                </span>
              ) : (
                <span className="text-muted-foreground">{isDone(m) ? MATCH_STATUS_LABEL[m.status] : fmtDateTime(m.scheduled_at)}</span>
              )}
            </div>
          </div>
          <DialogSide team={m.away_team_id ? teams.get(m.away_team_id) : null} />
        </div>
        <div className="mt-2 border-t pt-4">
          <Timeline b={b} match={m} />
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
  return { open: setId, dialog };
}

function DialogSide({ team }: { team: Team | null | undefined }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <TeamCrest team={team} size={44} />
      <span className="w-full truncate text-sm font-semibold">{team?.name ?? "A definir"}</span>
    </div>
  );
}

export function MatchList({
  b,
  matches,
  empty,
  team,
  onOpen,
  countdown,
}: {
  b: Bundle;
  matches: Match[];
  empty: string;
  team: string | null;
  onOpen: (id: string) => void;
  countdown?: boolean;
}) {
  const teams = teamMap(b.teams);
  if (!matches.length) return <Empty>{empty}</Empty>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((m) => (
        <div key={m.id}>
          <MatchCard match={m} teams={teams} venues={b.venues} highlightTeam={team} onClick={() => onOpen(m.id)} />
          {countdown && m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now() && m.status === "agendado" && (
            <div className="mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5 text-primary" /> Começa em <Countdown to={m.scheduled_at} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BracketTab({ b, team }: { b: Bundle; team: string | null }) {
  if (b.tournament.format === "pontos_corridos") return <Empty>Este torneio é disputado em pontos corridos. Veja a aba Classificação.</Empty>;
  if (b.tournament.format === "dupla_eliminacao")
    return (
      <div className="space-y-6">
        <BracketBlock title="Chave dos vencedores">
          <Bracket b={b} focusTeam={team} stages={["vencedores"]} />
        </BracketBlock>
        <BracketBlock title="Chave dos perdedores">
          <Bracket b={b} focusTeam={team} stages={["perdedores"]} />
        </BracketBlock>
        <BracketBlock title="Grande final">
          <Bracket b={b} focusTeam={team} stages={["grande_final"]} />
        </BracketBlock>
      </div>
    );
  if (b.tournament.format === "grupos_mata_mata" && !b.matches.some((m) => !["grupo", "liga"].includes(m.stage)))
    return <Empty>O mata-mata é montado ao fim da fase de grupos.</Empty>;
  return <Bracket b={b} focusTeam={team} />;
}

function BracketBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xl uppercase">{title}</h3>
      {children}
    </div>
  );
}

export function TeamsTab({ b, selected, onSelect }: { b: Bundle; selected: string | null; onSelect: (id: string | null) => void }) {
  const s = readSettings(b.tournament.settings);
  if (selected) {
    const done = b.matches.filter((m) => isDone(m) && hasTeams(m));
    const row = standings([selected], done, s)[0];
    const all = b.matches.filter((m) => hasTeams(m) && involves(m, selected));
    const teams = teamMap(b.teams);
    return (
      <div className="space-y-4">
        <button onClick={() => onSelect(null)} className="text-sm text-muted-foreground hover:text-primary">
          ← Todas as equipes
        </button>
        <TeamDetail b={b} teamId={selected} />
        {row && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {[
              ["Jogos", row.played],
              ["Vitórias", row.wins],
              ["Empates", row.draws],
              ["Derrotas", row.losses],
              ["Pró", row.gf],
              ["Contra", row.ga],
              ["Saldo", row.gd],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border bg-card p-2 text-center">
                <div className="scoreboard text-2xl">{v}</div>
                <div className="text-[11px] text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <h3 className="text-xl uppercase">Jogos</h3>
          {all.map((m) => (
            <MatchCard key={m.id} match={m} teams={teams} venues={b.venues} highlightTeam={selected} />
          ))}
        </div>
      </div>
    );
  }
  if (!b.teams.length) return <Empty>Nenhuma equipe cadastrada.</Empty>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {b.teams.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition hover:border-primary/50">
          <TeamCrest team={t} size={56} />
          <span className="w-full truncate font-semibold">{t.name}</span>
          <span className="text-xs text-muted-foreground">{b.players.filter((p) => p.team_id === t.id).length} jogadores</span>
        </button>
      ))}
    </div>
  );
}

export function RulesTab({ b }: { b: Bundle }) {
  if (!b.tournament.rules) return <Empty>O regulamento ainda não foi publicado.</Empty>;
  return <div className="whitespace-pre-wrap rounded-xl border bg-card p-5 text-sm leading-relaxed">{b.tournament.rules}</div>;
}

export function TeamFilter({ b, value, onChange }: { b: Bundle; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <button
        onClick={() => onChange(null)}
        className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", !value ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
      >
        Todas
      </button>
      {b.teams.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(value === t.id ? null : t.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
            value === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          <TeamCrest team={t} size={18} /> {t.name}
        </button>
      ))}
    </div>
  );
}

export { StandingsView, StatsView };
