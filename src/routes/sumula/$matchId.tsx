import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, ChevronLeft, Flag, Play, Plus, Trophy, Undo2 } from "lucide-react";
import { PageLoading } from "@/components/app-header";
import { useAction } from "@/components/manage/shared";
import { LiveBadge, SetsLine, TeamCrest } from "@/components/sport";
import { Empty, Timeline } from "@/components/views";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/auth";
import { bundleById, teamMap, type Bundle, type EventType, type Match, type Team } from "@/lib/data";
import { refreshLive, useLiveChannel } from "@/lib/live";
import { closeMatch, matchesInOrder, readExt, syncVolleyScore } from "@/lib/manage";
import { divisionLabel, MATCH_STATUS_LABEL, readSets, setsToWin, STAGE_LABEL, suspendedPlayers, targetFor } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sumula/$matchId")({
  head: () => ({ meta: [{"title": "Súmula ao vivo — Placar Pro"}, {"name": "description", "content": "Registre os pontos e acompanhe os sets de uma partida de vôlei."}, {"property": "og:title", "content": "Súmula ao vivo — Placar Pro"}, {"property": "og:description", "content": "Registre os pontos e acompanhe os sets de uma partida de vôlei."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: Sumula,
});

function useMatchBundle(matchId: string, enabled: boolean) {
  const tq = useQuery({
    queryKey: ["match-tournament", matchId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("tournament_id").eq("id", matchId).maybeSingle();
      if (error) throw error;
      return data?.tournament_id ?? null;
    },
  });
  const bq = useQuery({ ...bundleById(tq.data ?? ""), enabled: !!tq.data });
  return { loading: tq.isLoading || (!!tq.data && bq.isLoading), b: bq.data ?? null };
}

function Sumula() {
  const { matchId } = Route.useParams();
  const { user, loading } = useRequireAuth();
  const { loading: l2, b } = useMatchBundle(matchId, !!user);
  useLiveChannel(b ? [b.tournament.id] : []);
  if (loading || !user || l2) return <PageLoading />;
  const m = b?.matches.find((x) => x.id === matchId);
  if (!b || !m)
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <Empty>Jogo não encontrado ou você não tem acesso a ele.</Empty>
      </main>
    );
  return <SumulaView b={b} m={m} />;
}

/**
 * Scoresheet actions refresh only the matches and the events of live matches afterwards,
 * instead of reloading the whole tournament on every point.
 */
function useLiveAction(b: Bundle) {
  const qc = useQueryClient();
  return useAction({ refresh: () => refreshLive(qc, [b.tournament.id]) });
}

function SumulaView({ b, m }: { b: Bundle; m: Match }) {
  const teams = teamMap(b.teams);
  const home = m.home_team_id ? teams.get(m.home_team_id) ?? null : null;
  const away = m.away_team_id ? teams.get(m.away_team_id) ?? null : null;
  const s = readExt(b.tournament.settings);
  const { busy, run } = useLiveAction(b);
  const [pick, setPick] = useState<{ et: EventType; team: Team } | null>(null);
  const [closing, setClosing] = useState(false);
  const [wo, setWo] = useState(false);
  const live = m.status === "ao_vivo" || m.status === "intervalo";
  const done = m.status === "encerrado" || m.status === "wo";
  const enabled = b.eventTypes.filter((e) => e.enabled);
  const quickPoint = enabled.find((e) => e.key === "ponto") ?? enabled.find((e) => e.points > 0 && e.score_target === "own") ?? null;
  const scoutTypes = enabled.filter((e) => e.id !== quickPoint?.id);
  const matchEvents = b.events.filter((e) => e.match_id === m.id);
  const typeKey = useMemo(() => new Map(b.eventTypes.map((e) => [e.id, e.key])), [b.eventTypes]);
  const suspended = useMemo(
    () => suspendedPlayers(b.events, typeKey, matchesInOrder(b), m.id, s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.events, b.matches, typeKey, m.id],
  );
  const sentOff = new Set(matchEvents.filter((e) => typeKey.get(e.event_type_id) === "vermelho" && e.player_id).map((e) => e.player_id!));
  const suspendedHere = b.players.filter((p) => suspended.has(p.id) && (p.team_id === m.home_team_id || p.team_id === m.away_team_id));

  const sets = readSets(m.sets);
  const cur = live ? sets[sets.length - 1] ?? { h: 0, a: 0 } : null;
  const need = setsToWin(s.bestOf);
  const decided = m.home_score >= need || m.away_score >= need;
  const winnerTeam = m.home_score >= need ? home : m.away_score >= need ? away : null;
  const target = targetFor(m.period, s);

  const update = (patch: Partial<Match>) =>
    run(async () => {
      const { error } = await supabase.from("matches").update(patch).eq("id", m.id);
      if (error) throw error;
    });

  async function addEvent(et: EventType, team: Team, playerId: string | null) {
    return run(async () => {
      const { error } = await supabase.from("match_events").insert({
        tournament_id: b.tournament.id,
        match_id: m.id,
        team_id: team.id,
        player_id: playerId,
        event_type_id: et.id,
        period: m.period,
      });
      if (error) throw error;
      if (et.points > 0) await syncVolleyScore(b, m.id);
    });
  }

  const label = m.stage === "grupo" ? `Grupo ${m.group_name} · Rodada ${m.round}` : m.stage === "liga" ? `Rodada ${m.round}` : STAGE_LABEL[m.stage];

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-2 px-3">
          <Link to="/painel/$id" params={{ id: b.tournament.id }} search={{ etapa: "jogos" }} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Jogos
          </Link>
          <span className="flex-1 truncate text-center text-xs text-muted-foreground">
            {b.tournament.parent_id ? divisionLabel(b.tournament) : b.tournament.name} · {label}
          </span>
          {live ? <LiveBadge /> : <span className="text-xs text-muted-foreground">{MATCH_STATUS_LABEL[m.status]}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-3 pt-4">
        {/* Scoreboard */}
        <div className="rounded-2xl border bg-pitch p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TeamSide team={home} sets={m.home_score} />
            <div className="text-center">
              {cur ? (
                <>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.period}º set · até {target}</div>
                  <div className="scoreboard text-7xl">
                    {cur.h}
                    <span className="mx-2 text-muted-foreground">:</span>
                    {cur.a}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Sets</div>
                  <div className="scoreboard text-6xl">
                    {m.home_score}
                    <span className="mx-2 text-muted-foreground">:</span>
                    {m.away_score}
                  </div>
                </>
              )}
            </div>
            <TeamSide team={away} sets={m.away_score} />
          </div>
          <div className="mt-3 flex justify-center">
            <SetsLine match={m} className="text-sm" />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Melhor de {s.bestOf} · sets de {s.setPoints}
            {s.bestOf > 1 && ` · decisivo de ${s.tieBreakPoints}`}
            {s.winBy2 && " · vantagem de 2"}
          </p>

          {/* Rally points */}
          {live && home && away && quickPoint && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[home, away].map((t) => (
                <Button key={t.id} size="lg" className="h-20 flex-col gap-0 text-base" disabled={busy || decided} onClick={() => addEvent(quickPoint, t, null)}>
                  <span className="flex items-center gap-1 text-lg font-bold">
                    <Plus /> Ponto
                  </span>
                  <span className="max-w-full truncate text-xs opacity-80">{t.name}</span>
                </Button>
              ))}
            </div>
          )}

          {decided && live && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 p-3 text-sm">
              <Trophy className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1">
                <b>{winnerTeam?.name}</b> venceu por {Math.max(m.home_score, m.away_score)} sets a {Math.min(m.home_score, m.away_score)}. Encerre o jogo para confirmar.
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(m.status === "agendado" || m.status === "adiado") && (
              <Button
                size="lg"
                className="col-span-2 h-14 text-base"
                disabled={busy || !home || !away}
                onClick={async () => {
                  await update({ status: "ao_vivo", period: Math.max(1, m.period) });
                  // Starts the first set (or picks up points already registered).
                  await run(() => syncVolleyScore(b, m.id));
                }}
              >
                <Play /> Iniciar jogo
              </Button>
            )}
            {live && (
              <Button size="lg" variant={decided ? "default" : "destructive"} className="col-span-2 h-12" disabled={busy} onClick={() => setClosing(true)}>
                <Flag /> Encerrar jogo
              </Button>
            )}
            {done && (
              <Button variant="outline" className="col-span-2" disabled={busy} onClick={() => update({ status: "ao_vivo" })}>
                Reabrir jogo
              </Button>
            )}
          </div>
          {(m.status === "agendado" || m.status === "adiado") && (
            <div className="mt-2 flex justify-center gap-4 text-xs">
              {m.status === "agendado" && (
                <button className="text-muted-foreground hover:text-primary" onClick={() => update({ status: "adiado" })}>
                  Marcar como adiado
                </button>
              )}
              <button className="text-muted-foreground hover:text-primary" onClick={() => setWo(true)}>
                Registrar W.O.
              </button>
            </div>
          )}
        </div>

        {suspendedHere.length > 0 && (
          <div className="flex gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
            <TriangleAlert className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <b className="text-warning">Suspensos neste jogo:</b>{" "}
              {suspendedHere.map((p) => `${p.nickname || p.name} (${teams.get(p.team_id)?.name})`).join(", ")}
            </div>
          </div>
        )}

        {/* Scout */}
        {home && away && scoutTypes.length > 0 && (
          <div>
            <h2 className="mb-2 px-1 text-xl uppercase">Scout</h2>
            <p className="mb-2 px-1 text-xs text-muted-foreground">Eventos que valem ponto já somam no set. Toque e escolha o atleta.</p>
            <div className="grid grid-cols-2 gap-3">
              {[home, away].map((team) => (
                <div key={team.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-sm font-semibold">
                    <TeamCrest team={team} size={20} /> <span className="truncate">{team.name}</span>
                  </div>
                  {scoutTypes.map((et) => (
                    <button
                      key={et.id}
                      type="button"
                      disabled={busy || done || (!live && et.points > 0) || (decided && et.points > 0)}
                      onClick={() => setPick({ et, team })}
                      className="flex min-h-14 w-full items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm font-semibold transition active:scale-[0.98] active:border-primary disabled:opacity-40"
                    >
                      <span className="text-2xl">{et.icon}</span>
                      <span className="leading-tight">
                        {et.name}
                        {et.points > 0 && <span className="block text-[11px] font-normal text-muted-foreground">+{et.points} {et.score_target === "own" ? team.name : "adversário"}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {enabled.length === 0 && <Empty>Nenhum evento de scout ativo. Ative em Formato e regras.</Empty>}

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl uppercase">Lance a lance</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || matchEvents.length === 0 || done}
              onClick={() => {
                const last = [...matchEvents].sort((x, y) => x.created_at.localeCompare(y.created_at)).at(-1);
                if (!last) return;
                run(async () => {
                  const { error } = await supabase.from("match_events").delete().eq("id", last.id);
                  if (error) throw error;
                  await syncVolleyScore(b, m.id);
                }, "Último lance desfeito.");
              }}
            >
              <Undo2 /> Desfazer último
            </Button>
          </div>
          <Timeline b={b} match={m} />
        </div>
      </main>

      {pick && (
        <PlayerPicker
          b={b}
          et={pick.et}
          team={pick.team}
          suspended={suspended}
          sentOff={sentOff}
          onSave={async (playerId) => {
            const ok = await addEvent(pick.et, pick.team, playerId);
            if (ok) setPick(null);
          }}
          busy={busy}
          onClose={() => setPick(null)}
        />
      )}
      {closing && <CloseDialog b={b} m={m} onClose={() => setClosing(false)} />}
      {wo && home && away && <WoDialog b={b} m={m} home={home} away={away} onClose={() => setWo(false)} />}
    </div>
  );
}

function TeamSide({ team, sets }: { team: Team | null; sets: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <TeamCrest team={team} size={48} />
      <span className="w-full truncate text-sm font-semibold">{team?.name ?? "A definir"}</span>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
        <b className="scoreboard text-base">{sets}</b> set{sets === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function PlayerPicker({
  b,
  et,
  team,
  suspended,
  sentOff,
  busy,
  onSave,
  onClose,
}: {
  b: Bundle;
  et: EventType;
  team: Team;
  suspended: Set<string>;
  sentOff: Set<string>;
  busy: boolean;
  onSave: (playerId: string | null) => void;
  onClose: () => void;
}) {
  const players = b.players.filter((p) => p.team_id === team.id).sort((x, y) => (x.number ?? 999) - (y.number ?? 999));
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl uppercase">
            {et.icon} {et.name} · {team.name}
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {players.map((p) => {
            const susp = suspended.has(p.id);
            const off = sentOff.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => onSave(p.id)}
                className={cn("flex min-h-14 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left active:border-primary", (susp || off) && "border-warning/60")}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg">{p.number ?? "–"}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.nickname || p.name}</span>
                  {susp && <span className="block text-xs text-warning">Suspenso</span>}
                  {off && <span className="block text-xs text-warning">Expulso</span>}
                </span>
              </button>
            );
          })}
          <button type="button" disabled={busy} onClick={() => onSave(null)} className="min-h-14 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Sem atleta
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CloseDialog({ b, m, onClose }: { b: Bundle; m: Match; onClose: () => void }) {
  const s = readExt(b.tournament.settings);
  const need = setsToWin(s.bestOf);
  const tied = m.home_score === m.away_score;
  const decided = m.home_score >= need || m.away_score >= need;
  const { busy, run } = useLiveAction(b);
  const knockout = !["liga", "grupo"].includes(m.stage);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Encerrar jogo</DialogTitle>
        </DialogHeader>
        <p className="text-center">
          <span className="scoreboard text-4xl">
            {m.home_score} x {m.away_score}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">sets</span>
        </p>
        <div className="flex justify-center">
          <SetsLine match={m} className="text-sm" />
        </div>
        {tied ? (
          <p className="rounded-lg bg-warning/15 p-3 text-sm text-warning">
            Os sets estão empatados. No vôlei não há empate: continue marcando os pontos até alguém vencer {need} set{need > 1 ? "s" : ""}.
          </p>
        ) : !decided ? (
          <p className="rounded-lg bg-warning/15 p-3 text-sm text-warning">
            Pelas regras (melhor de {s.bestOf}) a partida ainda não terminou. Encerre só se o jogo foi interrompido; vence quem tem mais sets.
          </p>
        ) : (
          knockout && <p className="text-sm text-muted-foreground">O vencedor avança automaticamente na chave.</p>
        )}
        <Button
          variant="destructive"
          size="lg"
          disabled={busy || tied}
          onClick={async () => {
            const ok = await run(() => closeMatch(b, m), "Jogo encerrado.");
            if (ok) onClose();
          }}
        >
          <Flag /> Confirmar encerramento
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function WoDialog({ b, m, home, away, onClose }: { b: Bundle; m: Match; home: Team; away: Team; onClose: () => void }) {
  const [winner, setWinner] = useState<string>(home.id);
  const { busy, run } = useLiveAction(b);
  const s = readExt(b.tournament.settings);
  const need = setsToWin(s.bestOf);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">W.O.</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Qual equipe compareceu e vence por W.O.?</p>
        <div className="grid grid-cols-2 gap-2">
          {[home, away].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setWinner(t.id)}
              className={cn("flex items-center gap-2 rounded-xl border p-3 text-left", winner === t.id && "border-primary bg-primary/10")}
            >
              <TeamCrest team={t} size={28} /> <span className="truncate font-semibold">{t.name}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          O vencedor recebe {need} set{need > 1 ? "s" : ""} a 0.
        </p>
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            const ok = await run(
              () => closeMatch(b, m, { status: "wo", homeScore: winner === home.id ? need : 0, awayScore: winner === away.id ? need : 0 }),
              "W.O. registrado.",
            );
            if (ok) onClose();
          }}
        >
          Confirmar W.O.
        </Button>
      </DialogContent>
    </Dialog>
  );
}
