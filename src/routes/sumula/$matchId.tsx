import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert, ChevronLeft, Coffee, Flag, Pause, Play, RotateCcw, Undo2 } from "lucide-react";
import { PageLoading } from "@/components/app-header";
import { useAction } from "@/components/manage/shared";
import { LiveBadge, MatchClock, TeamCrest, useNow } from "@/components/sport";
import { Empty, Timeline } from "@/components/views";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/auth";
import { bundleById, teamMap, useTournamentRealtime, type Bundle, type EventType, type Match, type Team } from "@/lib/data";
import { closeMatch, matchesInOrder, readExt } from "@/lib/manage";
import { clockSeconds, MATCH_STATUS_LABEL, STAGE_LABEL, suspendedPlayers } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sumula/$matchId")({
  head: () => ({ meta: [{ title: "Súmula ao vivo — Placar Pro" }] }),
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

const isKnockout = (stage: string) => !["liga", "grupo"].includes(stage);

function periodLabel(p: number, extra: boolean) {
  if (extra && p > 2) return `${p - 2}º tempo da prorrogação`;
  return `${p}º período`;
}

function Sumula() {
  const { matchId } = Route.useParams();
  const { user, loading } = useRequireAuth();
  const { loading: l2, b } = useMatchBundle(matchId, !!user);
  useTournamentRealtime(b?.tournament.id);
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

function SumulaView({ b, m }: { b: Bundle; m: Match }) {
  const teams = teamMap(b.teams);
  const home = m.home_team_id ? teams.get(m.home_team_id) ?? null : null;
  const away = m.away_team_id ? teams.get(m.away_team_id) ?? null : null;
  const s = readExt(b.tournament.settings);
  const { busy, run } = useAction();
  const now = useNow();
  const [pick, setPick] = useState<{ et: EventType; team: Team } | null>(null);
  const [closing, setClosing] = useState(false);
  const [wo, setWo] = useState(false);
  const live = m.status === "ao_vivo";
  const running = live && !!m.clock_started_at;
  const done = m.status === "encerrado" || m.status === "wo";
  const enabled = b.eventTypes.filter((e) => e.enabled);
  const matchEvents = b.events.filter((e) => e.match_id === m.id);
  const typeKey = useMemo(() => new Map(b.eventTypes.map((e) => [e.id, e.key])), [b.eventTypes]);
  const suspended = useMemo(
    () => suspendedPlayers(b.events, typeKey, matchesInOrder(b), m.id, s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.events, b.matches, typeKey, m.id],
  );
  const sentOff = new Set(matchEvents.filter((e) => typeKey.get(e.event_type_id) === "vermelho" && e.player_id).map((e) => e.player_id!));
  const suspendedHere = b.players.filter((p) => suspended.has(p.id) && (p.team_id === m.home_team_id || p.team_id === m.away_team_id));

  const update = (patch: Partial<Match>) =>
    run(async () => {
      const { error } = await supabase.from("matches").update(patch).eq("id", m.id);
      if (error) throw error;
    });
  const elapsed = () => clockSeconds(m);
  const startClock = () => update({ status: "ao_vivo", clock_started_at: new Date().toISOString() });
  const pauseClock = () => update({ clock_started_at: null, clock_elapsed: elapsed() });

  const label = m.stage === "grupo" ? `Grupo ${m.group_name} · Rodada ${m.round}` : m.stage === "liga" ? `Rodada ${m.round}` : STAGE_LABEL[m.stage];

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-2 px-3">
          <Link to="/painel/$id" params={{ id: b.tournament.id }} search={{ etapa: "jogos" }} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Jogos
          </Link>
          <span className="flex-1 truncate text-center text-xs text-muted-foreground">
            {b.tournament.name} · {label}
          </span>
          {live || m.status === "intervalo" ? <LiveBadge /> : <span className="text-xs text-muted-foreground">{MATCH_STATUS_LABEL[m.status]}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-3 pt-4">
        {/* Scoreboard */}
        <div className="rounded-2xl border bg-pitch p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TeamSide team={home} />
            <div className="text-center">
              <div className="scoreboard text-6xl">
                {m.home_score}
                <span className="mx-2 text-muted-foreground">:</span>
                {m.away_score}
              </div>
              {(m.home_pens != null || m.away_pens != null) && (
                <div className="text-xs text-muted-foreground">
                  Pênaltis {m.home_pens ?? 0} x {m.away_pens ?? 0}
                </div>
              )}
            </div>
            <TeamSide team={away} />
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className={cn("scoreboard text-3xl", running ? "text-primary" : "text-muted-foreground")}>
              <MatchClock match={m} />
            </span>
            <span className="text-sm text-muted-foreground">{m.status === "intervalo" ? "Intervalo" : periodLabel(m.period, s.extraTime)}</span>
          </div>
          {/* clock controls */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(m.status === "agendado" || m.status === "adiado") && (
              <Button size="lg" className="col-span-2 h-14 text-base" disabled={busy || !home || !away} onClick={() => update({ status: "ao_vivo", period: 1, clock_elapsed: 0, clock_started_at: new Date().toISOString() })}>
                <Play /> Iniciar jogo
              </Button>
            )}
            {live && (
              <>
                <Button size="lg" variant={running ? "secondary" : "default"} className="h-14 text-base" disabled={busy} onClick={running ? pauseClock : startClock}>
                  {running ? <Pause /> : <Play />} {running ? "Pausar" : "Retomar"}
                </Button>
                <Button size="lg" variant="secondary" className="h-14 text-base" disabled={busy} onClick={() => update({ status: "intervalo", clock_started_at: null, clock_elapsed: elapsed() })}>
                  <Coffee /> Intervalo
                </Button>
              </>
            )}
            {m.status === "intervalo" && (
              <Button size="lg" className="col-span-2 h-14 text-base" disabled={busy} onClick={() => update({ status: "ao_vivo", period: m.period + 1, clock_started_at: new Date().toISOString() })}>
                <Play /> Iniciar {periodLabel(m.period + 1, s.extraTime)}
              </Button>
            )}
            {(live || m.status === "intervalo") && (
              <Button size="lg" variant="destructive" className="col-span-2 h-12" disabled={busy} onClick={() => setClosing(true)}>
                <Flag /> Encerrar jogo
              </Button>
            )}
            {done && (
              <Button variant="outline" className="col-span-2" disabled={busy} onClick={() => update({ status: "ao_vivo" })}>
                Reabrir jogo
              </Button>
            )}
          </div>
          {(live || m.status === "intervalo") && (
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <button className="text-muted-foreground hover:text-primary" onClick={() => update({ clock_elapsed: 0, clock_started_at: running ? new Date().toISOString() : null })}>
                <RotateCcw className="mr-1 inline h-3 w-3" /> Zerar cronômetro
              </button>
              <button className="text-muted-foreground hover:text-primary" onClick={() => update({ period: Math.max(1, m.period - 1) })}>
                − período
              </button>
              <button className="text-muted-foreground hover:text-primary" onClick={() => update({ period: m.period + 1 })}>
                + período
              </button>
            </div>
          )}
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

        {/* Event buttons */}
        {home && away && (
          <div className="grid grid-cols-2 gap-3">
            {[home, away].map((team) => (
              <div key={team.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-sm font-semibold">
                  <TeamCrest team={team} size={20} /> <span className="truncate">{team.name}</span>
                </div>
                {enabled.map((et) => (
                  <button
                    key={et.id}
                    type="button"
                    disabled={busy || done}
                    onClick={() => setPick({ et, team })}
                    className="flex min-h-14 w-full items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm font-semibold transition active:scale-[0.98] active:border-primary disabled:opacity-40"
                  >
                    <span className="text-2xl">{et.icon}</span>
                    <span className="leading-tight">{et.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {enabled.length === 0 && <Empty>Nenhum evento de scout ativo. Ative em Formato e regras.</Empty>}

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl uppercase">Linha do tempo</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || matchEvents.length === 0}
              onClick={() => {
                const last = [...matchEvents].sort((x, y) => x.created_at.localeCompare(y.created_at)).at(-1);
                if (!last) return;
                run(async () => {
                  const { error } = await supabase.from("match_events").delete().eq("id", last.id);
                  if (error) throw error;
                }, "Último evento desfeito.");
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
          m={m}
          et={pick.et}
          team={pick.team}
          minute={Math.floor(clockSeconds(m, now) / 60) + 1}
          suspended={suspended}
          sentOff={sentOff}
          onClose={() => setPick(null)}
        />
      )}
      {closing && <CloseDialog b={b} m={m} onClose={() => setClosing(false)} />}
      {wo && home && away && <WoDialog b={b} m={m} home={home} away={away} onClose={() => setWo(false)} />}
    </div>
  );
}

function TeamSide({ team }: { team: Team | null }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <TeamCrest team={team} size={48} />
      <span className="w-full truncate text-sm font-semibold">{team?.name ?? "A definir"}</span>
    </div>
  );
}

function PlayerPicker({
  b,
  m,
  et,
  team,
  minute: initialMinute,
  suspended,
  sentOff,
  onClose,
}: {
  b: Bundle;
  m: Match;
  et: EventType;
  team: Team;
  minute: number;
  suspended: Set<string>;
  sentOff: Set<string>;
  onClose: () => void;
}) {
  const [minute, setMinute] = useState(String(initialMinute));
  const { busy, run } = useAction();
  const players = b.players.filter((p) => p.team_id === team.id).sort((x, y) => (x.number ?? 999) - (y.number ?? 999));
  async function save(playerId: string | null) {
    const ok = await run(async () => {
      const { error } = await supabase.from("match_events").insert({
        tournament_id: b.tournament.id,
        match_id: m.id,
        team_id: team.id,
        player_id: playerId,
        event_type_id: et.id,
        minute: minute === "" ? null : Number(minute),
        period: m.period,
      });
      if (error) throw error;
    });
    if (ok) onClose();
  }
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl uppercase">
            {et.icon} {et.name} · {team.name}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-2 flex items-center gap-2 px-4">
          <Label htmlFor="minute" className="shrink-0">
            Minuto
          </Label>
          <Input id="minute" type="number" inputMode="numeric" className="w-24" value={minute} onChange={(e) => setMinute(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {players.map((p) => {
            const susp = suspended.has(p.id);
            const off = sentOff.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => save(p.id)}
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
          <button type="button" disabled={busy} onClick={() => save(null)} className="min-h-14 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Sem jogador
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CloseDialog({ b, m, onClose }: { b: Bundle; m: Match; onClose: () => void }) {
  const s = readExt(b.tournament.settings);
  const tied = m.home_score === m.away_score;
  const needsPens = tied && (isKnockout(m.stage) || !s.allowDraw);
  const [hp, setHp] = useState(m.home_pens?.toString() ?? "");
  const [ap, setAp] = useState(m.away_pens?.toString() ?? "");
  const { busy, run } = useAction();
  const pensOk = !needsPens || (hp !== "" && ap !== "" && hp !== ap);
  const teams = teamMap(b.teams);
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
        </p>
        {needsPens && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isKnockout(m.stage) ? "Empate no mata-mata: informe o resultado dos pênaltis para definir quem avança." : "Este torneio não permite empate: informe os pênaltis."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{teams.get(m.home_team_id ?? "")?.name}</Label>
                <Input type="number" inputMode="numeric" min={0} value={hp} onChange={(e) => setHp(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{teams.get(m.away_team_id ?? "")?.name}</Label>
                <Input type="number" inputMode="numeric" min={0} value={ap} onChange={(e) => setAp(e.target.value)} />
              </div>
            </div>
          </div>
        )}
        {isKnockout(m.stage) && !tied && <p className="text-sm text-muted-foreground">O vencedor avança automaticamente na chave.</p>}
        <Button
          variant="destructive"
          size="lg"
          disabled={busy || !pensOk}
          onClick={async () => {
            const ok = await run(
              () => closeMatch(b, m, needsPens ? { homePens: Number(hp), awayPens: Number(ap) } : {}),
              "Jogo encerrado.",
            );
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
  const [goals, setGoals] = useState("3");
  const { busy, run } = useAction();
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
        <div className="space-y-1">
          <Label>Placar atribuído ao vencedor</Label>
          <Input type="number" min={1} value={goals} onChange={(e) => setGoals(e.target.value)} className="w-24" />
        </div>
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            const g = Math.max(1, Number(goals) || 1);
            const ok = await run(
              () => closeMatch(b, m, { status: "wo", homeScore: winner === home.id ? g : 0, awayScore: winner === away.id ? g : 0 }),
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
