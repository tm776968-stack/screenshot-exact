import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, GitBranch, WandSparkles } from "lucide-react";
import { LiveBadge, TeamCrest } from "@/components/sport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle, Match } from "@/lib/data";
import { teamMap } from "@/lib/data";
import { buildKnockoutFromGroups, buildSchedule, distributeTimes, insertMatches } from "@/lib/manage";
import { fromLocalInput, MATCH_STATUS_LABEL, STAGE_LABEL, toLocalInput } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { Field, Section, useAction } from "./shared";

function roundTitle(m: Match) {
  if (m.stage === "liga") return `Rodada ${m.round}`;
  if (m.stage === "grupo") return `Fase de grupos · Rodada ${m.round}`;
  if (m.stage === "vencedores") return `Chave dos vencedores · Rodada ${m.round}`;
  if (m.stage === "perdedores") return `Chave dos perdedores · Rodada ${m.round}`;
  return STAGE_LABEL[m.stage] ?? m.stage;
}

export function StepJogos({ b }: { b: Bundle }) {
  const { busy, run } = useAction();
  const teams = teamMap(b.teams);
  const [start, setStart] = useState(() => (b.tournament.start_date ? `${b.tournament.start_date}T09:00` : ""));
  const [minutes, setMinutes] = useState(60);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const format = b.tournament.format;
  const hasGroupStage = b.matches.some((m) => m.stage === "grupo");
  const hasKnockout = b.matches.some((m) => !["grupo", "liga"].includes(m.stage));
  const started = b.matches.some((m) => m.status !== "agendado" && m.home_team_id && m.away_team_id && m.status !== "adiado");

  const STAGE_RANK: Record<string, number> = { liga: 0, grupo: 0, vencedores: 1, perdedores: 2, terceiro: 4, grande_final: 5 };
  const rank = (m: Match) => STAGE_RANK[m.stage] ?? 3;
  const visible = b.matches
    .filter((m) => m.home_team_id || m.away_team_id || m.stage !== "grupo")
    .sort((x, y) => rank(x) - rank(y) || x.round - y.round || (x.group_name ?? "").localeCompare(y.group_name ?? "") || (x.bracket_pos ?? 0) - (y.bracket_pos ?? 0));
  const sections: { title: string; items: Match[] }[] = [];
  for (const m of visible) {
    const title = roundTitle(m);
    const sec = sections.find((s) => s.title === title);
    if (sec) sec.items.push(m);
    else sections.push({ title, items: [m] });
  }

  async function generate() {
    const { matches, error } = buildSchedule(b);
    if (error) {
      await run(async () => {
        throw new Error(error);
      });
      return;
    }
    if (b.matches.length && !confirm(started ? "Já existem jogos com resultado. Gerar de novo apaga TODOS os jogos e eventos. Continuar?" : "Substituir a tabela atual?")) return;
    await run(() => insertMatches(b, matches), `${matches.length} jogos gerados.`);
  }

  return (
    <div className="space-y-4">
      <Section
        title="Tabela de jogos"
        description="Gerada a partir do formato, das regras e do chaveamento salvos nas etapas anteriores."
        actions={
          <Button onClick={generate} disabled={busy}>
            <WandSparkles /> {b.matches.length ? "Gerar de novo" : "Gerar tabela"}
          </Button>
        }
      >
        {format === "grupos_mata_mata" && hasGroupStage && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm">
              {hasKnockout ? "O mata-mata já foi montado. Pode montar de novo se a classificação mudou." : "Quando a fase de grupos terminar, monte o mata-mata com os classificados."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (hasKnockout && !confirm("Substituir os jogos do mata-mata?")) return;
                run(() => buildKnockoutFromGroups(b), "Mata-mata montado com os classificados.");
              }}
            >
              <GitBranch /> Montar mata-mata
            </Button>
          </div>
        )}
        <div className="grid gap-3 rounded-lg border bg-background/40 p-3 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end">
          <Field label="Primeiro jogo">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Minutos por jogo">
            <Input type="number" min={5} value={minutes} onChange={(e) => setMinutes(Math.max(5, Number(e.target.value)))} />
          </Field>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={onlyEmpty} onCheckedChange={setOnlyEmpty} /> Só sem horário
          </label>
          <Button
            variant="secondary"
            disabled={busy || !start || !b.matches.length}
            onClick={() => run(() => distributeTimes(b, fromLocalInput(start)!, minutes, onlyEmpty), "Horários distribuídos.")}
          >
            <CalendarClock /> Distribuir horários
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-4">
            Com {b.venues.length || 1} local{b.venues.length > 1 ? "is" : ""}, {b.venues.length || 1} jogo{b.venues.length > 1 ? "s acontecem" : " acontece"} ao mesmo tempo.
          </p>
        </div>
      </Section>

      {sections.map((sec) => (
        <div key={sec.title}>
          <h3 className="mb-2 px-1 text-lg uppercase text-muted-foreground">{sec.title}</h3>
          <div className="space-y-2">
            {sec.items.map((m) => (
              <MatchRow key={m.id} b={b} m={m} teams={teams} />
            ))}
          </div>
        </div>
      ))}
      {!b.matches.length && <p className="px-1 text-sm text-muted-foreground">Nenhum jogo ainda. Clique em “Gerar tabela”.</p>}
    </div>
  );
}

function MatchRow({ b, m, teams }: { b: Bundle; m: Match; teams: ReturnType<typeof teamMap> }) {
  const { run } = useAction();
  const h = m.home_team_id ? teams.get(m.home_team_id) : null;
  const a = m.away_team_id ? teams.get(m.away_team_id) : null;
  const live = m.status === "ao_vivo" || m.status === "intervalo";
  const done = m.status === "encerrado" || m.status === "wo";
  const bye = (m.home_team_id && !m.away_team_id) || (!m.home_team_id && m.away_team_id);
  const update = (patch: Partial<Match>) =>
    run(async () => {
      const { error } = await supabase.from("matches").update(patch).eq("id", m.id);
      if (error) throw error;
    });
  if (bye && done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <TeamCrest team={h ?? a} size={20} /> {(h ?? a)?.name} avança direto (folga)
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border bg-card p-3", live && "border-live/50")}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {[
            [h, m.home_score, m.home_pens],
            [a, m.away_score, m.away_pens],
          ].map(([t, sc, p], i) => (
            <div key={i} className="flex items-center gap-2">
              <TeamCrest team={t as typeof h} size={22} />
              <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", !t && "text-muted-foreground")}>{(t as typeof h)?.name ?? "A definir"}</span>
              {(live || done) && (
                <span className="scoreboard text-xl">
                  {sc as number}
                  {p != null && <span className="text-xs text-muted-foreground"> ({p as number})</span>}
                </span>
              )}
            </div>
          ))}
        </div>
        {h && a && (
          <Button asChild size="sm" variant={live ? "default" : "secondary"}>
            <Link to="/sumula/$matchId" params={{ matchId: m.id }}>
              <ClipboardList /> Súmula
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_9rem]">
        <Input
          type="datetime-local"
          className="col-span-2 h-8 text-xs sm:col-span-1"
          defaultValue={toLocalInput(m.scheduled_at)}
          key={m.scheduled_at ?? "none"}
          onBlur={(e) => {
            const v = fromLocalInput(e.target.value);
            if (v !== m.scheduled_at) update({ scheduled_at: v });
          }}
        />
        <Select value={m.venue_id ?? "none"} onValueChange={(v) => update({ venue_id: v === "none" ? null : v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem local</SelectItem>
            {b.venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex h-8 items-center justify-end text-xs">
          {live ? (
            <LiveBadge />
          ) : m.status === "agendado" || m.status === "adiado" ? (
            <Select value={m.status} onValueChange={(v) => update({ status: v as Match["status"] })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="adiado">Adiado</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground">{MATCH_STATUS_LABEL[m.status]}</span>
          )}
        </div>
      </div>
    </div>
  );
}
