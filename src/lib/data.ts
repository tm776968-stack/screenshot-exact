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
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  venues: Venue[];
  matches: Match[];
  eventTypes: EventType[];
  events: MatchEvent[];
}

async function loadBundle(t: Tournament): Promise<Bundle> {
  const id = t.id;
  const [teams, players, venues, matches, eventTypes, events] = await Promise.all([
    supabase.from("teams").select("*").eq("tournament_id", id).order("seed", { nullsFirst: false }).order("created_at"),
    supabase.from("players").select("*").eq("tournament_id", id).order("number"),
    supabase.from("venues").select("*").eq("tournament_id", id).order("name"),
    supabase.from("matches").select("*").eq("tournament_id", id).order("round").order("bracket_pos").order("scheduled_at"),
    supabase.from("event_types").select("*").eq("tournament_id", id).order("sort"),
    supabase.from("match_events").select("*").eq("tournament_id", id).order("created_at"),
  ]);
  for (const r of [teams, players, venues, matches, eventTypes, events]) if (r.error) throw r.error;
  return {
    tournament: t,
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
  const qc = useQueryClient();
  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase
      .channel(`t-${tournamentId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` }, () =>
        qc.invalidateQueries({ queryKey: ["bundle"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `tournament_id=eq.${tournamentId}` }, () =>
        qc.invalidateQueries({ queryKey: ["bundle"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tournamentId, qc]);
}

export function teamMap(teams: Team[]) {
  return new Map(teams.map((t) => [t.id, t]));
}
