import { queryOptions } from "@tanstack/react-query";
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

/**
 * Teams, players, courts, rules and categories rarely change during the games, and live changes
 * (scores, sets, status, events) are patched straight into the cache by src/lib/live.ts.
 * So a loaded bundle stays fresh: switching tabs or categories doesn't reload it, and returning
 * to the window doesn't trigger a full reload (live.ts revalidates lightly instead).
 */
const BUNDLE_CACHE = { staleTime: 5 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false } as const;

export const bundleBySlug = (slug: string) =>
  queryOptions({
    queryKey: ["bundle", "slug", slug],
    ...BUNDLE_CACHE,
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return loadBundle(data);
    },
  });

/** Loads a tournament or category with everything in it (outside React Query). */
export async function fetchBundle(id: string): Promise<Bundle | null> {
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? loadBundle(data) : null;
}

export const bundleById = (id: string) =>
  queryOptions({
    queryKey: ["bundle", "id", id],
    ...BUNDLE_CACHE,
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return loadBundle(data);
    },
  });

export function teamMap(teams: Team[]) {
  return new Map(teams.map((t) => [t.id, t]));
}
