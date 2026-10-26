import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Bundle, Match, Team } from "@/lib/data";
import { teamMap } from "@/lib/data";
import { readSettings, standings, STAGE_LABEL } from "@/lib/tournament";
import { TeamCrest } from "@/components/sport";

/* ---------- Bracket ---------- */
export function Bracket({ b, focusTeam }: { b: Bundle; focusTeam?: string | null }) {
  const [hover, setHover] = useState<string | null>(focusTeam ?? null);
  const active = hover ?? focusTeam ?? null;
  const teams = teamMap(b.teams);
  const ko = b.matches.filter((m) => !["liga", "grupo", "terceiro"].includes(m.stage));
  const third = b.matches.find((m) => m.stage === "terceiro");
  const rounds = [...new Set(ko.map((m) => m.round))].sort((a, b) => a - b);
  if (!ko.length) return <Empty>O chaveamento ainda não foi gerado.</Empty>;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4">
      <div className="flex min-w-max gap-6">
        {rounds.map((r) => {
          const ms = ko.filter((m) => m.round === r).sort((a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0));
          return (
            <div key={r} className="flex w-56 flex-col">
              <div className="mb-3 font-display text-sm uppercase tracking-wider text-muted-foreground">{STAGE_LABEL[ms[0]?.stage ?? ""]}</div>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {ms.map((m) => (
                  <BracketMatch key={m.id} m={m} teams={teams} active={active} onHover={setHover} />
                ))}
              </div>
            </div>
          );
        })}
        {third && (
          <div className="flex w-56 flex-col justify-end">
            <div className="mb-3 font-display text-sm uppercase tracking-wider text-muted-foreground">3º lugar</div>
            <BracketMatch m={third} teams={teams} active={active} onHover={setHover} />
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatch({ m, teams, active, onHover }: { m: Match; teams: Map<string, Team>; active: string | null; onHover: (id: string | null) => void }) {
  const inPath = active && (m.home_team_id === active || m.away_team_id === active);
  const done = m.status === "encerrado" || m.status === "wo";
  return (
    <div className={cn("rounded-lg border bg-card text-sm transition", inPath && "border-primary shadow-glow")}>
      {[
        [m.home_team_id, m.home_score, m.home_pens],
        [m.away_team_id, m.away_score, m.away_pens],
      ].map(([id, s, p], i) => {
        const t = id ? teams.get(id as string) : null;
        return (
          <div
            key={i}
            onMouseEnter={() => onHover((id as string) ?? null)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onHover((id as string) ?? null)}
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              i === 0 && "border-b",
              done && m.winner_team_id === id && "font-bold",
              done && m.winner_team_id && m.winner_team_id !== id && "text-muted-foreground",
              id && id === active && "text-primary",
            )}
          >
            <TeamCrest team={t} size={20} />
            <span className="flex-1 truncate">{t?.name ?? "—"}</span>
            {(done || m.status === "ao_vivo") && id && (
              <span className="scoreboard">
                {s as number}
                {p != null && <span className="text-xs text-muted-foreground"> ({p as number})</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Standings ---------- */
export function StandingsView({ b }: { b: Bundle }) {
  const s = readSettings(b.tournament.settings);
  const teams = teamMap(b.teams);
  const groupMatches = b.matches.filter((m) => m.stage === "grupo" || m.stage === "liga");
  if (!groupMatches.length) return <Empty>A classificação aparece quando a tabela de jogos for gerada.</Empty>;
  const groups = [...new Set(groupMatches.map((m) => m.group_name ?? ""))].sort();
  const qualifiers = b.tournament.format === "grupos_mata_mata" ? s.qualifiersPerGroup : 0;
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const ms = groupMatches.filter((m) => (m.group_name ?? "") === g);
        const ids = [...new Set(ms.flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean) as string[])];
        const rows = standings(ids, ms, s);
        return (
          <div key={g} className="overflow-hidden rounded-xl border bg-card">
            {g && <div className="border-b px-4 py-2 font-display text-lg">Grupo {g}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="[&>th]:px-2 [&>th]:py-2">
                    <th className="w-8 text-left">#</th>
                    <th className="text-left">Equipe</th>
                    <th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.team_id} className={cn("border-t text-center [&>td]:px-2 [&>td]:py-2", i < qualifiers && "bg-primary/10")}>
                      <td className={cn("text-left font-bold", i < qualifiers && "text-primary")}>{i + 1}</td>
                      <td className="text-left">
                        <span className="flex items-center gap-2">
                          <TeamCrest team={teams.get(r.team_id)} size={22} />
                          <span className="truncate font-semibold">{teams.get(r.team_id)?.name}</span>
                        </span>
                      </td>
                      <td className="font-bold">{r.points}</td><td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td>
                      <td>{r.gf}</td><td>{r.ga}</td><td>{r.gd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {qualifiers > 0 && <p className="text-xs text-muted-foreground"><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-primary/30 align-middle" /> Zona de classificação</p>}
    </div>
  );
}

/* ---------- Stats / rankings ---------- */
export function StatsView({ b, onTeam }: { b: Bundle; onTeam?: ((id: string) => void) | undefined }) {
  const teams = teamMap(b.teams);
  const players = new Map(b.players.map((p) => [p.id, p]));
  const enabled = b.eventTypes.filter((e) => e.enabled);
  const [typeId, setTypeId] = useState<string | null>(enabled[0]?.id ?? null);
  const ranking = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of b.events) if (e.event_type_id === typeId && e.player_id) c.set(e.player_id, (c.get(e.player_id) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [b.events, typeId]);

  const done = b.matches.filter((m) => (m.status === "encerrado" || m.status === "wo") && m.home_team_id && m.away_team_id);
  const teamAgg = b.teams.map((t) => {
    let gf = 0, ga = 0, n = 0;
    for (const m of done) {
      if (m.home_team_id === t.id) { gf += m.home_score; ga += m.away_score; n++; }
      if (m.away_team_id === t.id) { gf += m.away_score; ga += m.home_score; n++; }
    }
    return { t, gf, ga, n };
  }).filter((x) => x.n > 0);
  const attack = [...teamAgg].sort((a, b) => b.gf - a.gf).slice(0, 5);
  const defense = [...teamAgg].sort((a, b) => a.ga - b.ga).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {enabled.map((e) => (
          <button key={e.id} onClick={() => setTypeId(e.id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", typeId === e.id ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
            {e.icon} {e.name}
          </button>
        ))}
      </div>
      <div className="rounded-xl border bg-card">
        {ranking.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro ainda.</div>}
        {ranking.map(([pid, n], i) => {
          const p = players.get(pid);
          const t = p ? teams.get(p.team_id) : null;
          return (
            <div key={pid} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
              <span className={cn("w-6 font-display text-lg", i < 3 && "text-primary")}>{i + 1}</span>
              <TeamCrest team={t} size={24} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p?.nickname || p?.name}</div>
                <button onClick={() => t && onTeam?.(t.id)} className="text-xs text-muted-foreground hover:text-primary">{t?.name}</button>
              </div>
              <span className="scoreboard text-2xl">{n}</span>
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniRank title="Melhor ataque" rows={attack.map((x) => ({ t: x.t, v: x.gf }))} onTeam={onTeam} />
        <MiniRank title="Melhor defesa" rows={defense.map((x) => ({ t: x.t, v: x.ga }))} onTeam={onTeam} suffix="sofridos" />
      </div>
    </div>
  );
}

function MiniRank({ title, rows, onTeam, suffix }: { title: string; rows: { t: Team; v: number }[]; onTeam?: ((id: string) => void) | undefined; suffix?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 font-display text-lg">{title}</div>
      {rows.length === 0 && <div className="text-sm text-muted-foreground">Sem jogos encerrados.</div>}
      {rows.map((r, i) => (
        <button key={r.t.id} onClick={() => onTeam?.(r.t.id)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm">
          <span className="w-4 text-muted-foreground">{i + 1}</span>
          <TeamCrest team={r.t} size={20} />
          <span className="flex-1 truncate">{r.t.name}</span>
          <span className="font-bold">{r.v}</span>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Team detail ---------- */
export function TeamDetail({ b, teamId }: { b: Bundle; teamId: string }) {
  const t = b.teams.find((x) => x.id === teamId);
  if (!t) return null;
  const players = b.players.filter((p) => p.team_id === teamId);
  const types = new Map(b.eventTypes.map((e) => [e.id, e]));
  const statsFor = (pid: string) => {
    const c = new Map<string, number>();
    for (const e of b.events) if (e.player_id === pid) c.set(e.event_type_id, (c.get(e.event_type_id) ?? 0) + 1);
    return [...c.entries()];
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <TeamCrest team={t} size={48} />
        <div>
          <h2 className="text-2xl">{t.name}</h2>
          {t.manager && <p className="text-sm text-muted-foreground">Responsável: {t.manager}</p>}
        </div>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {players.length === 0 && <div className="p-4 text-sm text-muted-foreground">Elenco não cadastrado.</div>}
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            {p.photo_url ? <img src={p.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-display">{p.number ?? "–"}</span>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.nickname || p.name} {p.number != null && <span className="text-muted-foreground">#{p.number}</span>}</div>
              <div className="text-xs text-muted-foreground">{p.position}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-1 text-xs">
              {statsFor(p.id).map(([tid, n]) => (
                <span key={tid} className="rounded bg-secondary px-1.5 py-0.5">{types.get(tid)?.icon} {n}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Timeline ---------- */
export function Timeline({ b, match }: { b: Bundle; match: Match }) {
  const types = new Map(b.eventTypes.map((e) => [e.id, e]));
  const players = new Map(b.players.map((p) => [p.id, p]));
  const evs = b.events.filter((e) => e.match_id === match.id).sort((a, b) => (a.period ?? 0) - (b.period ?? 0) || (a.minute ?? 0) - (b.minute ?? 0) || a.created_at.localeCompare(b.created_at));
  if (!evs.length) return <div className="py-6 text-center text-sm text-muted-foreground">Nenhum evento registrado.</div>;
  return (
    <ol className="space-y-2">
      {evs.map((e) => {
        const home = e.team_id === match.home_team_id;
        const p = e.player_id ? players.get(e.player_id) : null;
        return (
          <li key={e.id} className={cn("flex items-center gap-2 text-sm", !home && "flex-row-reverse text-right")}>
            <span className="w-12 shrink-0 text-center font-display text-muted-foreground">{e.minute != null ? `${e.minute}'` : "–"}</span>
            <span className="rounded-lg bg-secondary px-3 py-1.5">
              {types.get(e.event_type_id)?.icon} <b>{types.get(e.event_type_id)?.name}</b>
              {p && <span className="text-muted-foreground"> · {p.nickname || p.name}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
