import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Match, Team, Venue } from "@/lib/data";
import { clockSeconds, fmtClock, fmtDateTime, MATCH_STATUS_LABEL, STAGE_LABEL } from "@/lib/tournament";

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-live", className)}>
      <span className="live-dot" /> Ao vivo
    </span>
  );
}

export function TeamCrest({ team, size = 28 }: { team?: Team | null; size?: number }) {
  if (team?.logo_url)
    return <img src={team.logo_url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover bg-muted" />;
  return (
    <span
      style={{ width: size, height: size, background: team?.color ?? undefined }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-display text-xs font-bold text-foreground")}
    >
      {team?.name?.slice(0, 2).toUpperCase() ?? "?"}
    </span>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function MatchClock({ match }: { match: Match }) {
  const now = useNow();
  return <span className="tabular-nums">{fmtClock(clockSeconds(match, now))}</span>;
}

export function Countdown({ to }: { to: string }) {
  const now = useNow();
  const diff = Math.max(0, new Date(to).getTime() - now);
  if (diff === 0) return <span>em instantes</span>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return <span className="tabular-nums">{d > 0 ? `${d}d ${h}h ${m}min` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`}</span>;
}

export function MatchCard({
  match,
  teams,
  venues,
  onClick,
  highlightTeam,
}: {
  match: Match;
  teams: Map<string, Team>;
  venues: Venue[];
  onClick?: () => void;
  highlightTeam?: string | null;
}) {
  const h = match.home_team_id ? teams.get(match.home_team_id) : null;
  const a = match.away_team_id ? teams.get(match.away_team_id) : null;
  const live = match.status === "ao_vivo" || match.status === "intervalo";
  const done = match.status === "encerrado" || match.status === "wo";
  const venue = venues.find((v) => v.id === match.venue_id);
  const label = match.stage === "grupo" ? `Grupo ${match.group_name} · Rodada ${match.round}` : match.stage === "liga" ? `Rodada ${match.round}` : STAGE_LABEL[match.stage];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border bg-card p-4 text-left transition hover:border-primary/50",
        live && "border-live/40",
        !onClick && "cursor-default",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {live ? (
          <span className="flex items-center gap-2">
            <LiveBadge />
            <span className="font-display text-sm text-foreground">
              {match.status === "intervalo" ? "Intervalo" : <><MatchClock match={match} /> · {match.period}º</>}
            </span>
          </span>
        ) : (
          <span>{done ? MATCH_STATUS_LABEL[match.status] : fmtDateTime(match.scheduled_at)}</span>
        )}
      </div>
      {[
        { t: h, s: match.home_score, p: match.home_pens, id: match.home_team_id },
        { t: a, s: match.away_score, p: match.away_pens, id: match.away_team_id },
      ].map((row, i) => (
        <div key={i} className={cn("flex items-center gap-3 py-1", highlightTeam && row.id === highlightTeam && "text-primary")}>
          <TeamCrest team={row.t} />
          <span className={cn("flex-1 truncate font-semibold", done && match.winner_team_id && match.winner_team_id !== row.id && "text-muted-foreground")}>
            {row.t?.name ?? "A definir"}
          </span>
          {(live || done) && (
            <span className="scoreboard text-2xl">
              {row.s}
              {row.p != null && <span className="ml-1 text-sm text-muted-foreground">({row.p})</span>}
            </span>
          )}
        </div>
      ))}
      {venue && <div className="mt-2 text-xs text-muted-foreground">📍 {venue.name}</div>}
    </button>
  );
}
