import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Bundle, Match, Tournament } from "@/lib/data";
import {
  DEFAULT_SETTINGS,
  doubleElimination,
  eventPresets,
  groupQualifiers,
  knockout,
  readSettings,
  roundRobin,
  slugify,
  type DoubleElimMatch,
  type NewMatch,
  type Settings,
} from "@/lib/tournament";

export type LoserRoutes = Record<string, { to: string; slot: "home" | "away" }>;
export type ExtSettings = Settings & { loserRoutes?: LoserRoutes; heads?: number };

export function readExt(raw: unknown): ExtSettings {
  return readSettings(raw) as ExtSettings;
}

export async function saveSettings(t: Tournament, patch: Partial<ExtSettings>) {
  const next = { ...readExt(t.settings), ...patch };
  const { error } = await supabase
    .from("tournaments")
    .update({ settings: next as unknown as Json })
    .eq("id", t.id);
  if (error) throw error;
  return next;
}

export async function createTournament(name: string, sport: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Faça login novamente.");
  const slug = `${slugify(name) || "torneio"}-${Math.random().toString(36).slice(2, 6)}`;
  // The id is generated here instead of reading the row back: the read policy checks the
  // tournaments table itself, which can't see the new row inside the same INSERT statement.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("tournaments").insert({
    id,
    name,
    sport,
    slug,
    owner_id: u.user.id,
    settings: DEFAULT_SETTINGS as unknown as Json,
  });
  if (error) throw error;
  await resetEventTypes(id, sport);
  return { id, slug };
}

/** Replaces the scout event types with the sport's default set. */
export async function resetEventTypes(tournamentId: string, sport: string) {
  await supabase.from("event_types").delete().eq("tournament_id", tournamentId);
  const rows = eventPresets(sport).map((p, i) => ({ ...p, tournament_id: tournamentId, sort: i, enabled: true }));
  const { error } = await supabase.from("event_types").insert(rows);
  if (error) throw error;
}

function orderedTeams(b: Bundle) {
  return [...b.teams].sort((x, y) => (x.seed ?? 9999) - (y.seed ?? 9999) || x.created_at.localeCompare(y.created_at));
}

/** Builds the full match list for the tournament format (group stage only for grupos_mata_mata). */
export function buildSchedule(b: Bundle): { matches: (NewMatch | DoubleElimMatch)[]; error?: string } {
  const s = readExt(b.tournament.settings);
  const teams = orderedTeams(b);
  const ids = teams.map((t) => t.id);
  if (ids.length < 2) return { matches: [], error: "Cadastre pelo menos 2 equipes." };
  switch (b.tournament.format) {
    case "mata_mata":
      return { matches: knockout(ids, s.thirdPlace) };
    case "dupla_eliminacao": {
      const ms = doubleElimination(ids);
      if (!ms.length)
        return { matches: [], error: "A dupla eliminação precisa de 4, 8, 16 ou 32 equipes." };
      return { matches: ms };
    }
    case "grupos_mata_mata": {
      const groups = [...new Set(teams.map((t) => t.group_name).filter(Boolean) as string[])].sort();
      if (groups.length < 2) return { matches: [], error: "Distribua as equipes nos grupos na etapa de chaveamento." };
      const out: NewMatch[] = [];
      for (const g of groups) {
        const gIds = teams.filter((t) => t.group_name === g).map((t) => t.id);
        out.push(...roundRobin(gIds, s.doubleRound, g).map((m) => ({ ...m, key: `${g}-${m.key}` })));
      }
      return { matches: out };
    }
    default:
      return { matches: roundRobin(ids, s.doubleRound) };
  }
}

/** Inserts generated matches. `onlyStages` limits what gets deleted first. */
export async function insertMatches(
  b: Bundle,
  matches: (NewMatch | DoubleElimMatch)[],
  opts: { deleteStages?: string[] } = {},
) {
  const tid = b.tournament.id;
  let del = supabase.from("matches").delete().eq("tournament_id", tid);
  if (opts.deleteStages) del = del.in("stage", opts.deleteStages);
  const { error: delErr } = await del;
  if (delErr) throw delErr;

  const idByKey = new Map(matches.map((m) => [m.key, crypto.randomUUID()]));
  const rows = matches.map((m) => ({
    id: idByKey.get(m.key)!,
    tournament_id: tid,
    stage: m.stage,
    round: m.round,
    group_name: m.group_name ?? null,
    bracket_pos: m.bracket_pos ?? null,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    status: m.status ?? "agendado",
    next_match_id: m.next_key ? idByKey.get(m.next_key) ?? null : null,
    next_slot: m.next_slot ?? null,
  }));
  if (rows.length) {
    const { error } = await supabase.from("matches").insert(rows);
    if (error) throw error;
  }
  const loserRoutes: LoserRoutes = {};
  for (const m of matches as DoubleElimMatch[]) {
    if (m.loser_key && m.loser_slot) loserRoutes[idByKey.get(m.key)!] = { to: idByKey.get(m.loser_key)!, slot: m.loser_slot };
  }
  if (!opts.deleteStages) await saveSettings(b.tournament, { loserRoutes });
}

/** Knockout phase built from the current group standings. */
export async function buildKnockoutFromGroups(b: Bundle) {
  const s = readExt(b.tournament.settings);
  const groups: Record<string, string[]> = {};
  for (const t of b.teams) if (t.group_name) (groups[t.group_name] ??= []).push(t.id);
  const qualified = groupQualifiers(groups, b.matches, s);
  if (qualified.length < 2) throw new Error("Não há classificados suficientes.");
  const ko = knockout(qualified, s.thirdPlace).map((m) => ({ ...m, round: m.round + 100 }));
  await insertMatches(b, ko, { deleteStages: ["final", "semi", "quartas", "oitavas", "mata", "terceiro"] });
}

/** Spreads match times from a start date, rotating through the venues. */
export async function distributeTimes(b: Bundle, startIso: string, minutes: number, onlyEmpty: boolean) {
  const venues = b.venues.length ? b.venues : [null];
  const ms = [...b.matches]
    .filter((m) => m.home_team_id || m.away_team_id)
    .filter((m) => m.status === "agendado" || m.status === "adiado")
    .filter((m) => !onlyEmpty || !m.scheduled_at)
    .sort((x, y) => x.round - y.round || (x.group_name ?? "").localeCompare(y.group_name ?? "") || (x.bracket_pos ?? 0) - (y.bracket_pos ?? 0));
  let t = new Date(startIso).getTime();
  for (let i = 0; i < ms.length; i++) {
    const v = venues[i % venues.length];
    const { error } = await supabase
      .from("matches")
      .update({ scheduled_at: new Date(t).toISOString(), venue_id: v?.id ?? null })
      .eq("id", ms[i]!.id);
    if (error) throw error;
    if ((i + 1) % venues.length === 0) t += minutes * 60000;
  }
}

/** Closes a match: status + penalties, then routes the loser in double elimination. */
export async function closeMatch(
  b: Bundle,
  m: Match,
  opts: { status?: "encerrado" | "wo"; homePens?: number | null; awayPens?: number | null; homeScore?: number; awayScore?: number } = {},
) {
  const elapsed = m.clock_elapsed + (m.clock_started_at ? Math.floor((Date.now() - new Date(m.clock_started_at).getTime()) / 1000) : 0);
  const patch = {
    status: opts.status ?? "encerrado",
    clock_started_at: null,
    clock_elapsed: elapsed,
    home_pens: opts.homePens ?? null,
    away_pens: opts.awayPens ?? null,
    ...(opts.homeScore != null ? { home_score: opts.homeScore } : {}),
    ...(opts.awayScore != null ? { away_score: opts.awayScore } : {}),
  };
  const { data, error } = await supabase.from("matches").update(patch).eq("id", m.id).select().single();
  if (error) throw error;
  const route = readExt(b.tournament.settings).loserRoutes?.[m.id];
  if (route && data.winner_team_id) {
    const loser = data.winner_team_id === data.home_team_id ? data.away_team_id : data.home_team_id;
    const { error: e2 } = await supabase
      .from("matches")
      .update(route.slot === "home" ? { home_team_id: loser } : { away_team_id: loser })
      .eq("id", route.to);
    if (e2) throw e2;
  }
  return data;
}

/** Match order used for suspensions: by date, then round. */
export function matchesInOrder(b: Bundle) {
  return [...b.matches].sort(
    (x, y) =>
      (x.scheduled_at ?? "9999").localeCompare(y.scheduled_at ?? "9999") || x.round - y.round || (x.bracket_pos ?? 0) - (y.bracket_pos ?? 0),
  );
}

export function publicUrl(slug: string) {
  if (typeof window === "undefined") return `/t/${slug}`;
  return `${window.location.origin}/t/${slug}`;
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Algo deu errado. Tente novamente.";
}
