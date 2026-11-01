import { useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Tournament = Tables<"tournaments">;
export type Team = Tables<"teams">;
export type Player = Tables<"players">;
export type Venue = Tables<"venues">;
export type Match = Tables<"matches">;
export type EventType = Tables<"event_types">;
export type MatchEvent = Tables<"match_events">;

export interface Bundle {
  /** The category (or a tournament without categories). Teams, matches and settings belong to it. */
  tournament: Tournament;
  /** The main tournament: name, place, dates, look, rules and publication. Same as `tournament` when it has no parent. */
  root: Tournament;
  /** All categories of the main tournament, in creation order. */
  divisions: Tournament[];
  teams: Team[];
  players: Player[];
  venues: Venue[];
  matches: Match[];
  eventTypes: EventType[];
  events: MatchEvent[];
}

async function loadBundle(t: Tournament): Promise<Bundle> {
  const id = t.id;
  let root = t;
  if (t.parent_id) {
    const p = await supabase.from("tournaments").select("*").eq("id", t.parent_id).maybeSingle();
    if (p.error) throw p.error;
    if (p.data) root = p.data;
  }
  const [divisions, teams, players, venues, matches, eventTypes, events] = await Promise.all([
    supabase.from("tournaments").select("*").eq("parent_id", root.id).order("created_at"),
    supabase.from("teams").select("*").eq("tournament_id", id).order("seed", { nullsFirst: false }).order("created_at"),
    supabase.from("players").select("*").eq("tournament_id", id).order("number"),
    // Courts are shared by every category of the tournament.
    supabase.from("venues").select("*").eq("tournament_id", root.id).order("name"),
    supabase.from("matches").select("*").eq("tournament_id", id).order("round").order("bracket_pos").order("scheduled_at"),
    supabase.from("event_types").select("*").eq("tournament_id", id).order("sort"),
    supabase.from("match_events").select("*").eq("tournament_id", id).order("created_at"),
  ]);
  for (const r of [divisions, teams, players, venues, matches, eventTypes, events]) if (r.error) throw r.error;
  return {
    tournament: t,
    root,
    divisions: divisions.data!,
    teams: teams.data!,
    players: players.data!,
    venues: venues.data!,
    matches: matches.data!,
    eventTypes: eventTypes.data!,
    events: events.data!,
  };
}

export const bundleBySlug = (slug: string) =>
  queryOptions({
    queryKey: ["bundle", "slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return loadBundle(data);
    },
  });

export const bundleById = (id: string) =>
  queryOptions({
    queryKey: ["bundle", "id", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return loadBundle(data);
    },
  });

/** Live updates for matches and events of a tournament. */
export function useTournamentRealtime(tournamentId: string | undefined) {
  useTournamentsRealtime(tournamentId ? [tournamentId] : []);
}

/** Live updates for several categories at once (TV mode). */
export function useTournamentsRealtime(tournamentIds: string[]) {
  const qc = useQueryClient();
  const key = [...tournamentIds].sort().join(",");
  useEffect(() => {
    if (!key) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["bundle"] });
    let ch = supabase.channel(`t-${Math.random().toString(36).slice(2)}`);
    for (const id of key.split(",")) {
      ch = ch
        .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `tournament_id=eq.${id}` }, refresh);
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [key, qc]);
}

export function teamMap(teams: Team[]) {
  return new Map(teams.map((t) => [t.id, t]));
}
